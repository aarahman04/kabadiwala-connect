/**
 * Mock backend. Pretends to be a network API (latency, offline failures) but
 * persists to localStorage so the offline/sync flow is real and demoable.
 * Swapping in a real backend = reimplementing these exported functions with
 * fetch(); nothing else in the app talks to "the server".
 *
 * Note: localStorage is per-device, so the collector and recycler views must
 * run in the same browser (two tabs, or ?role=recycler) to share this server.
 */
import type {
  ConfirmationPayload,
  MaterialLot,
  PriceEntry,
  Recycler,
  SyncOp,
  TraceabilityRecord,
  Transaction,
} from '../data/models';
import { seedPrices, seedRecyclers } from '../data/seed';
import { OfflineError } from '../logic/sync';

const SERVER_KEY = 'kc-mock-server-v1';
export const SIMULATE_OFFLINE_KEY = 'kc-simulate-offline';

interface ServerState {
  recyclers: Recycler[];
  prices: PriceEntry[];
  lots: Record<string, Omit<MaterialLot, 'imageBlob'>>;
  transactions: Record<string, Transaction>;
  traceability: Record<string, Omit<TraceabilityRecord, 'photoBlobs'>>; // keyed by handoverReference
  // Confirmations can arrive before the collector's handover record syncs (the
  // recycler was online, the collector wasn't) — held here until matched.
  confirmations: Record<string, ConfirmationPayload>;
}

function load(): ServerState {
  const raw = localStorage.getItem(SERVER_KEY);
  if (raw) return JSON.parse(raw) as ServerState;
  const fresh: ServerState = {
    recyclers: seedRecyclers(),
    prices: seedPrices(),
    lots: {},
    transactions: {},
    traceability: {},
    confirmations: {},
  };
  save(fresh);
  return fresh;
}

function save(state: ServerState): void {
  localStorage.setItem(SERVER_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Connectivity
// ---------------------------------------------------------------------------

/** Demo switch for laptops where toggling real wifi is awkward. */
export function isSimulatedOffline(): boolean {
  return localStorage.getItem(SIMULATE_OFFLINE_KEY) === '1';
}

export function setSimulatedOffline(offline: boolean): void {
  if (offline) localStorage.setItem(SIMULATE_OFFLINE_KEY, '1');
  else localStorage.removeItem(SIMULATE_OFFLINE_KEY);
  window.dispatchEvent(new Event(offline ? 'offline' : 'online'));
}

export function isOnline(): boolean {
  return navigator.onLine && !isSimulatedOffline();
}

async function network<T>(handler: () => T): Promise<T> {
  if (!isOnline()) throw new OfflineError();
  await new Promise((r) => setTimeout(r, 250 + Math.random() * 450));
  if (!isOnline()) throw new OfflineError(); // dropped mid-request
  return handler();
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export function fetchRecyclers(): Promise<Recycler[]> {
  return network(() => load().recyclers);
}

export function fetchPrices(): Promise<PriceEntry[]> {
  return network(() => load().prices);
}

/** Apply one queued client write. */
export function pushOp(op: SyncOp): Promise<void> {
  return network(() => {
    const s = load();
    switch (op.kind) {
      case 'upsertLot':
        s.lots[op.lot.lotId] = op.lot;
        break;
      case 'upsertTransaction': {
        const existing = s.transactions[op.transaction.transactionId];
        // Server-side confirmation wins over a stale client copy.
        s.transactions[op.transaction.transactionId] =
          existing?.transactionStatus === 'confirmed' ? { ...op.transaction, ...pickConfirmed(existing) } : op.transaction;
        break;
      }
      case 'upsertTraceability': {
        const ref = op.record.handoverReference;
        s.traceability[ref] = { ...op.record, ...(s.traceability[ref]?.status === 'confirmed' ? pickRecordConfirmed(s.traceability[ref]) : {}) };
        const pending = s.confirmations[ref];
        if (pending) confirmOnServer(s, pending);
        break;
      }
      case 'confirmHandover':
        s.confirmations[op.confirmation.handoverReference] = op.confirmation;
        confirmOnServer(s, op.confirmation);
        break;
      case 'markPaid': {
        const tx = s.transactions[op.transactionId];
        if (!tx) throw new Error(`unknown transaction ${op.transactionId}`);
        tx.paymentStatus = op.paymentStatus;
        tx.finalPrice ??= tx.quotedPrice;
        break;
      }
    }
    save(s);
  });
}

function pickConfirmed(t: Transaction): Partial<Transaction> {
  return { transactionStatus: t.transactionStatus, finalPrice: t.finalPrice, paymentStatus: t.paymentStatus };
}

function pickRecordConfirmed(r: Omit<TraceabilityRecord, 'photoBlobs'>) {
  return { status: r.status, recyclerConfirmation: r.recyclerConfirmation };
}

function confirmOnServer(s: ServerState, c: ConfirmationPayload): void {
  const record = s.traceability[c.handoverReference];
  if (!record) return; // held in s.confirmations until the record arrives
  record.status = 'confirmed';
  record.recyclerConfirmation ??= { confirmedAt: c.confirmedAt, confirmedBy: c.confirmedBy };
  const tx = s.transactions[record.transactionId];
  if (tx) {
    tx.transactionStatus = 'confirmed';
    tx.finalPrice = c.finalPrice ?? tx.finalPrice ?? tx.quotedPrice;
    if (tx.paymentStatus === 'pending') tx.paymentStatus = c.paymentStatus;
  }
}

export interface RemoteHandoverUpdate {
  transactionId: string;
  lotId: string;
  confirmation: ConfirmationPayload;
}

/** Confirmations the collector hasn't necessarily seen yet. */
export function pullUpdates(collectorId: string): Promise<RemoteHandoverUpdate[]> {
  return network(() => {
    const s = load();
    return Object.values(s.traceability)
      .filter((r) => r.collectorId === collectorId && r.status === 'confirmed')
      .map((r) => {
        const tx = s.transactions[r.transactionId];
        const stored = s.confirmations[r.handoverReference];
        const confirmation: ConfirmationPayload = stored ?? {
          handoverReference: r.handoverReference,
          confirmedAt: r.recyclerConfirmation?.confirmedAt ?? Date.now(),
          confirmedBy: r.recyclerConfirmation?.confirmedBy ?? 'recycler',
          finalPrice: tx?.finalPrice,
          paymentStatus: tx?.paymentStatus ?? 'pending',
        };
        return { transactionId: r.transactionId, lotId: r.lotId, confirmation };
      });
  });
}

export interface RemoteHandover {
  record: Omit<TraceabilityRecord, 'photoBlobs'>;
  transaction?: Transaction;
  lot?: Omit<MaterialLot, 'imageBlob'>;
}

/** Recycler-side lookup of a handover code that isn't on this device. */
export function lookupHandover(reference: string): Promise<RemoteHandover | null> {
  return network(() => {
    const s = load();
    const record = s.traceability[reference];
    if (!record) return null;
    return { record, transaction: s.transactions[record.transactionId], lot: s.lots[record.lotId] };
  });
}

/** Demo helper: wipe the mock server (used by "Reset demo"). */
export function resetServer(): void {
  localStorage.removeItem(SERVER_KEY);
}
