import type {
  ConfirmationPayload,
  LedgerEntry,
  LotStatus,
  MaterialLot,
  PaymentStatus,
  SyncOp,
  SyncQueueItem,
  TraceabilityRecord,
  Transaction,
  TransactionStatus,
} from '../data/models';

// ---------------------------------------------------------------------------
// Queue flushing
// ---------------------------------------------------------------------------

/** Thrown by the transport when there is no connectivity — stops the flush. */
export class OfflineError extends Error {
  constructor(message = 'offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

export const MAX_ATTEMPTS = 5;

export interface FlushResult {
  sent: number[]; // queue ids delivered — delete these
  failed: { id: number; error: string; attempts: number }[]; // rejected by server — keep, bump attempts
  dropped: number[]; // exceeded MAX_ATTEMPTS — delete these
  halted: boolean; // stopped early because we went offline
}

/**
 * Sends queued ops strictly in write order. Going offline mid-flush halts
 * immediately so later ops never overtake earlier ones; a server-side
 * rejection is recorded against that item and the flush carries on.
 */
export async function flushQueue(
  items: SyncQueueItem[],
  send: (op: SyncOp) => Promise<void>,
): Promise<FlushResult> {
  const result: FlushResult = { sent: [], failed: [], dropped: [], halted: false };
  const ordered = [...items].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  for (const item of ordered) {
    const id = item.id!;
    try {
      await send(item.op);
      result.sent.push(id);
    } catch (err) {
      if (err instanceof OfflineError) {
        result.halted = true;
        break;
      }
      const attempts = item.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) result.dropped.push(id);
      else result.failed.push({ id, error: err instanceof Error ? err.message : String(err), attempts });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// State transitions (applied locally, and when pulling remote updates)
// ---------------------------------------------------------------------------

const LOT_ORDER: LotStatus[] = ['draft', 'valued', 'matched', 'handed_over', 'confirmed', 'paid'];
const TX_ORDER: TransactionStatus[] = ['pending', 'handed_over', 'confirmed'];

/** Statuses only move forward — a stale remote copy can never roll a lot back. */
export function advanceLotStatus(current: LotStatus, next: LotStatus): LotStatus {
  return LOT_ORDER.indexOf(next) > LOT_ORDER.indexOf(current) ? next : current;
}

export function advanceTxStatus(current: TransactionStatus, next: TransactionStatus): TransactionStatus {
  if (current === 'disputed' || next === 'disputed') return 'disputed';
  return TX_ORDER.indexOf(next) > TX_ORDER.indexOf(current) ? next : current;
}

export const isPaid = (s: PaymentStatus) => s === 'paid_cash' || s === 'paid_digital';

export interface HandoverBundle {
  lot: MaterialLot;
  transaction: Transaction;
  record: TraceabilityRecord;
  ledger: LedgerEntry;
}

/** Recycler confirmed the handover: record confirmed, transaction confirmed, ledger settled if paid. */
export function applyConfirmation(b: HandoverBundle, c: ConfirmationPayload): HandoverBundle {
  const alreadyPaid = isPaid(b.transaction.paymentStatus);
  const paymentStatus = alreadyPaid ? b.transaction.paymentStatus : c.paymentStatus;
  const finalPrice = c.finalPrice ?? b.transaction.finalPrice ?? b.transaction.quotedPrice;
  const paid = isPaid(paymentStatus);

  return {
    lot: { ...b.lot, status: advanceLotStatus(b.lot.status, paid ? 'paid' : 'confirmed') },
    transaction: {
      ...b.transaction,
      finalPrice,
      paymentStatus,
      transactionStatus: advanceTxStatus(b.transaction.transactionStatus, 'confirmed'),
    },
    record: {
      ...b.record,
      status: 'confirmed',
      recyclerConfirmation: b.record.recyclerConfirmation ?? {
        confirmedAt: c.confirmedAt,
        confirmedBy: c.confirmedBy,
      },
    },
    ledger: {
      ...b.ledger,
      amount: finalPrice,
      type: paid ? 'earning' : 'due',
      status: paid ? 'settled' : 'pending',
    },
  };
}

/** Collector marks cash (or digital) received. */
export function applyPayment(
  b: Pick<HandoverBundle, 'lot' | 'transaction' | 'ledger'>,
  paymentStatus: Exclude<PaymentStatus, 'pending'>,
): Pick<HandoverBundle, 'lot' | 'transaction' | 'ledger'> {
  const amount = b.transaction.finalPrice ?? b.transaction.quotedPrice;
  return {
    lot: { ...b.lot, status: advanceLotStatus(b.lot.status, 'paid') },
    transaction: { ...b.transaction, paymentStatus, finalPrice: amount },
    ledger: { ...b.ledger, amount, type: 'earning', status: 'settled' },
  };
}

// ---------------------------------------------------------------------------
// Ledger summary
// ---------------------------------------------------------------------------

export interface LedgerSummary {
  total: number; // everything earned or owed
  settled: number;
  pending: number;
}

export function summarizeLedger(entries: LedgerEntry[]): LedgerSummary {
  let settled = 0;
  let pending = 0;
  for (const e of entries) {
    if (e.status === 'settled') settled += e.amount;
    else pending += e.amount;
  }
  return { total: settled + pending, settled, pending };
}

/** Strip blobs before anything leaves the device (photos stay local in the demo). */
export function lotForSync(lot: MaterialLot): Omit<MaterialLot, 'imageBlob'> {
  const { imageBlob: _omit, ...rest } = lot;
  return rest;
}

export function recordForSync(record: TraceabilityRecord): Omit<TraceabilityRecord, 'photoBlobs'> {
  const { photoBlobs: _omit, ...rest } = record;
  return rest;
}
