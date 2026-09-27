/**
 * Every local write goes through here. Each action updates its stores and
 * enqueues the matching SyncOp in the same IndexedDB transaction, so a write
 * and its queue entry can never diverge — even if the tab dies mid-way.
 */
import type { IDBPTransaction } from 'idb';
import { getDB, notifyChange, type KCSchema, type StoreName } from './db';
import { newId } from './ids';
import type {
  ConfirmationPayload,
  LatLng,
  LedgerEntry,
  MaterialCategory,
  MaterialLot,
  PaymentStatus,
  Recycler,
  SyncOp,
  TraceabilityRecord,
  Transaction,
} from './models';
import { computeHandoverHash, referenceFromHash } from '../logic/hashing';
import { advanceLotStatus, advanceTxStatus, applyPayment, isPaid, lotForSync, recordForSync } from '../logic/sync';
import { advancePickup } from '../services/serverCore';
import { requestSync } from './syncRunner';

type WriteTx = IDBPTransaction<KCSchema, StoreName[], 'readwrite'>;

async function writeWithQueue(stores: StoreName[], body: (tx: WriteTx) => Promise<SyncOp[]>): Promise<void> {
  const db = await getDB();
  const all = [...new Set<StoreName>([...stores, 'syncQueue'])];
  const tx = db.transaction(all, 'readwrite');
  const ops = await body(tx);
  const now = Date.now();
  for (const op of ops) await tx.objectStore('syncQueue').add({ op, createdAt: now, attempts: 0 });
  await tx.done;
  notifyChange(...all);
  requestSync();
}

// ---------------------------------------------------------------------------
// Collector actions
// ---------------------------------------------------------------------------

export interface NewLotInput {
  collectorId: string;
  imageBlob: Blob;
  category: MaterialCategory;
  approxWeightKg: number;
  estimatedValue: number;
  location?: LatLng;
  photoThumbnail?: string;
  aiSuggestion?: MaterialLot['aiSuggestion'];
  description?: string;
  condition?: string;
  sourceType?: string;
}

export async function createLot(input: NewLotInput): Promise<MaterialLot> {
  const lot: MaterialLot = {
    lotId: newId(),
    collectorId: input.collectorId,
    category: input.category,
    description: input.description,
    condition: input.condition,
    sourceType: input.sourceType,
    imageBlob: input.imageBlob,
    approxWeightKg: input.approxWeightKg,
    estimatedValue: input.estimatedValue,
    status: 'valued',
    createdAt: Date.now(),
    location: input.location,
    photoThumbnail: input.photoThumbnail,
    aiSuggestion: input.aiSuggestion,
  };
  await writeWithQueue(['materials'], async (tx) => {
    await tx.objectStore('materials').put(lot);
    return [{ kind: 'upsertLot', lot: lotForSync(lot) }];
  });
  return lot;
}

/** Collector picks a recycler: creates (or re-points) the pending transaction. */
export async function selectRecycler(lotId: string, recycler: Recycler, fallbackLocation: LatLng): Promise<Transaction> {
  let result!: Transaction;
  await writeWithQueue(['materials', 'transactions'], async (tx) => {
    const lot = await tx.objectStore('materials').get(lotId);
    if (!lot) throw new Error(`lot ${lotId} not found`);
    const rate = recycler.offeredRates[lot.category] ?? 0;
    const existing = await tx.objectStore('transactions').index('byLot').get(lotId);
    if (existing && existing.transactionStatus !== 'pending') {
      throw new Error('handover already done for this lot');
    }
    result = {
      transactionId: existing?.transactionId ?? newId(),
      lotId,
      collectorId: lot.collectorId,
      recyclerId: recycler.recyclerId,
      quotedPrice: Math.round(rate * lot.approxWeightKg),
      collectionLocation: lot.location ?? fallbackLocation,
      dateTime: Date.now(),
      paymentStatus: 'pending',
      transactionStatus: 'pending',
    };
    const updatedLot = { ...lot, status: advanceLotStatus(lot.status, 'matched') };
    await tx.objectStore('transactions').put(result);
    await tx.objectStore('materials').put(updatedLot);
    return [
      { kind: 'upsertLot', lot: lotForSync(updatedLot) },
      { kind: 'upsertTransaction', transaction: result },
    ];
  });
  return result;
}

export interface HandoverInput {
  lotId: string;
  photo: Blob;
  location: LatLng;
  locationApproximate: boolean;
  thumbnails?: string[];
}

/** Generates the hashed TraceabilityRecord — works fully offline. */
export async function completeHandover(input: HandoverInput): Promise<TraceabilityRecord> {
  const db = await getDB();
  const lot = await db.get('materials', input.lotId);
  const transaction = await db.getFromIndex('transactions', 'byLot', input.lotId);
  if (!lot || !transaction) throw new Error('lot or transaction missing');

  const existing = await db.get('traceability', input.lotId);
  if (existing) return existing; // idempotent: double-tap can't mint two codes

  // Hash first (async crypto can't run inside an open IDB transaction).
  const timestamp = Date.now();
  const handoverHash = await computeHandoverHash({
    lotId: lot.lotId,
    weight: lot.approxWeightKg,
    timestamp,
    location: input.location,
    collectorId: lot.collectorId,
    recyclerId: transaction.recyclerId,
  });
  const record: TraceabilityRecord = {
    lotId: lot.lotId,
    photoBlobs: [lot.imageBlob, input.photo],
    weight: lot.approxWeightKg,
    timestamp,
    location: input.location,
    handoverReference: referenceFromHash(handoverHash),
    handoverHash,
    status: 'pending_confirmation',
    collectorId: lot.collectorId,
    recyclerId: transaction.recyclerId,
    transactionId: transaction.transactionId,
    locationApproximate: input.locationApproximate,
    photoThumbnails: input.thumbnails?.length ? input.thumbnails : undefined,
  };
  const updatedTx: Transaction = {
    ...transaction,
    handoverLocation: input.location,
    dateTime: timestamp,
    transactionStatus: advanceTxStatus(transaction.transactionStatus, 'handed_over'),
  };
  const updatedLot: MaterialLot = { ...lot, status: advanceLotStatus(lot.status, 'handed_over') };
  const ledger: LedgerEntry = {
    entryId: newId(),
    lotId: lot.lotId,
    amount: transaction.quotedPrice,
    type: 'due',
    status: 'pending',
    date: timestamp,
  };

  await writeWithQueue(['traceability', 'transactions', 'materials', 'ledger'], async (tx) => {
    await tx.objectStore('traceability').put(record);
    await tx.objectStore('transactions').put(updatedTx);
    await tx.objectStore('materials').put(updatedLot);
    await tx.objectStore('ledger').put(ledger);
    return [
      { kind: 'upsertLot', lot: lotForSync(updatedLot) },
      { kind: 'upsertTransaction', transaction: updatedTx },
      { kind: 'upsertTraceability', record: recordForSync(record) },
    ];
  });
  return record;
}

/** Manual "cash received" toggle — cash is first-class, not a fallback. */
export async function markPaid(lotId: string, paymentStatus: Exclude<PaymentStatus, 'pending'>): Promise<void> {
  await writeWithQueue(['materials', 'transactions', 'ledger'], async (tx) => {
    const lot = await tx.objectStore('materials').get(lotId);
    const transaction = await tx.objectStore('transactions').index('byLot').get(lotId);
    const ledger = await tx.objectStore('ledger').index('byLot').get(lotId);
    if (!lot || !transaction || !ledger) throw new Error('nothing to mark paid');
    // Idempotent: overlapping readwrite transactions run one after another, so
    // a double tap (or cash-then-digital) sees the first payment and stops here.
    if (isPaid(transaction.paymentStatus)) return [];
    const next = applyPayment({ lot, transaction, ledger }, paymentStatus);
    await tx.objectStore('materials').put(next.lot);
    await tx.objectStore('transactions').put(next.transaction);
    await tx.objectStore('ledger').put(next.ledger);
    return [
      { kind: 'upsertLot', lot: lotForSync(next.lot) },
      { kind: 'markPaid', transactionId: transaction.transactionId, paymentStatus },
    ];
  });
}

/**
 * Ask the chosen recycler to come and collect. Recorded locally at once and
 * queued; the recycler's accept / on-the-way / arriving updates come back on
 * sync. Idempotent: an active request is not re-sent.
 */
export async function requestPickup(lotId: string, contactPhone?: string): Promise<void> {
  await writeWithQueue(['transactions'], async (tx) => {
    const transaction = await tx.objectStore('transactions').index('byLot').get(lotId);
    if (!transaction) throw new Error('choose a recycler first');
    if (transaction.pickup && transaction.pickup.status !== 'declined') return [];
    const at = Date.now();
    const pickup = advancePickup(undefined, 'requested', at)!;
    await tx.objectStore('transactions').put({
      ...transaction,
      pickup: { ...pickup, contactPhone: contactPhone?.trim() || undefined },
    });
    return [{ kind: 'requestPickup', transactionId: transaction.transactionId, contactPhone, at }];
  });
}

// ---------------------------------------------------------------------------
// Recycler actions
// ---------------------------------------------------------------------------

/** Recycler answers a pickup request: accept / decline / on the way / arriving. */
export async function updatePickup(
  transactionId: string,
  recyclerId: string,
  status: 'accepted' | 'declined' | 'on_the_way' | 'arriving',
): Promise<void> {
  await writeWithQueue([], async () => [{ kind: 'updatePickup', transactionId, recyclerId, status, at: Date.now() }]);
}

/**
 * Recycler confirms a handover code. This only goes to the server (queued if
 * offline) — the collector's records flip to confirmed when *their* device
 * syncs, which is exactly the flow the demo shows.
 */
export async function recyclerConfirm(confirmation: ConfirmationPayload): Promise<void> {
  await writeWithQueue([], async (tx) => {
    // A second tap on "Confirm" must not queue a second confirmation.
    const queued = await tx.objectStore('syncQueue').getAll();
    const duplicate = queued.some(
      (q) => q.op.kind === 'confirmHandover' && q.op.confirmation.handoverReference === confirmation.handoverReference,
    );
    return duplicate ? [] : [{ kind: 'confirmHandover', confirmation }];
  });
}

// ---------------------------------------------------------------------------
// Demo helpers
// ---------------------------------------------------------------------------

export async function resetLocalData(): Promise<void> {
  const db = await getDB();
  db.close();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(db.name);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}
