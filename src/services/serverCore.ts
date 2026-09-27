/**
 * The backend's behaviour, as pure functions over a ServerState object.
 * Shared by the in-browser mock (services/api.ts, localStorage) and the real
 * Node server (server/index.ts, Postgres) so the two can never drift.
 * No DOM, no IndexedDB, no network.
 */
import type {
  ConfirmationPayload,
  MaterialCategory,
  MaterialLot,
  PriceEntry,
  Recycler,
  SyncOp,
  TraceabilityRecord,
  Transaction,
} from '../data/models';
import { MATERIAL_CATEGORIES } from '../data/models';
import { SEED_CITY, seedPrices, seedRecyclers } from '../data/seedData';
import { detectPriceAnomaly } from '../logic/anomaly';
import { verifyHandover } from '../logic/hashing';
import { priceBoardRow } from '../logic/valuation';

export type ServerLot = Omit<MaterialLot, 'imageBlob'>;
export type ServerRecord = Omit<TraceabilityRecord, 'photoBlobs'>;

export interface TransactionFlag {
  transactionId: string;
  reason: 'below_market' | 'above_market' | 'far_from_quote';
  deviationPct: number;
  at: number;
}

export interface AuditEvent {
  at: number;
  kind: SyncOp['kind'];
  ref: string; // lotId / transactionId / handover reference
}

export interface ServerState {
  recyclers: Recycler[];
  prices: PriceEntry[];
  lots: Record<string, ServerLot>;
  transactions: Record<string, Transaction>;
  traceability: Record<string, ServerRecord>; // keyed by handoverReference
  // Confirmations can arrive before the collector's handover record syncs (the
  // recycler was online, the collector wasn't) — held here until matched.
  confirmations: Record<string, ConfirmationPayload>;
  flags: Record<string, TransactionFlag>; // keyed by transactionId
  audit: AuditEvent[];
}

export function initialServerState(now = Date.now()): ServerState {
  return {
    recyclers: seedRecyclers(),
    prices: seedPrices(now),
    lots: {},
    transactions: {},
    traceability: {},
    confirmations: {},
    flags: {},
    audit: [],
  };
}

/** Older persisted states predate some collections. */
export function normalizeState(s: Partial<ServerState>): ServerState {
  const base = initialServerState();
  return { ...base, ...s, flags: s.flags ?? {}, audit: s.audit ?? [] };
}

/** A request the server refuses (bad data). Distinct from being offline. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const QUOTE_DEVIATION_THRESHOLD = 0.4;
const MAX_WEIGHT_KG = 5000;
const REF_PATTERN = /^KC-[0-9A-F]{6}$/;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

function isCategory(c: unknown): c is MaterialCategory {
  return MATERIAL_CATEGORIES.includes(c as MaterialCategory);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Validate and apply one client write. Mutates `s`. */
export async function applyOp(s: ServerState, op: SyncOp, now = Date.now()): Promise<void> {
  switch (op.kind) {
    case 'upsertLot': {
      const lot = op.lot;
      check(typeof lot.lotId === 'string' && lot.lotId, 'lotId required');
      check(isCategory(lot.category), 'unknown material category');
      check(lot.approxWeightKg > 0 && lot.approxWeightKg <= MAX_WEIGHT_KG, 'weight out of range');
      check(lot.estimatedValue >= 0, 'estimatedValue must be ≥ 0');
      s.lots[lot.lotId] = { ...lot, status: s.lots[lot.lotId]?.status === 'paid' ? 'paid' : lot.status };
      audit(s, op.kind, lot.lotId, now);
      break;
    }
    case 'upsertTransaction': {
      const tx = op.transaction;
      check(tx.transactionId && tx.lotId, 'transactionId and lotId required');
      check(tx.quotedPrice >= 0, 'quotedPrice must be ≥ 0');
      const recycler = s.recyclers.find((r) => r.recyclerId === tx.recyclerId);
      check(recycler, `unknown recycler ${tx.recyclerId}`);
      check(recycler.authorizationStatus === 'authorized', 'recycler is not authorized');
      const existing = s.transactions[tx.transactionId];
      // Server-side confirmation / payment wins over a stale client copy.
      s.transactions[tx.transactionId] =
        existing?.transactionStatus === 'confirmed'
          ? {
              ...tx,
              transactionStatus: 'confirmed',
              finalPrice: existing.finalPrice,
              paymentStatus: existing.paymentStatus !== 'pending' ? existing.paymentStatus : tx.paymentStatus,
            }
          : tx;
      audit(s, op.kind, tx.transactionId, now);
      break;
    }
    case 'upsertTraceability': {
      const r = op.record;
      check(REF_PATTERN.test(r.handoverReference), 'bad handover reference');
      check(
        !r.photoThumbnails ||
          (r.photoThumbnails.length <= 4 &&
            r.photoThumbnails.every((t) => typeof t === 'string' && t.startsWith('data:image/') && t.length < 60_000)),
        'photo thumbnails must be ≤4 small data:image URLs',
      );
      // Re-derive the fingerprint: a record edited after creation is refused.
      const valid = await verifyHandover(
        {
          lotId: r.lotId,
          weight: r.weight,
          timestamp: r.timestamp,
          location: r.location,
          collectorId: r.collectorId,
          recyclerId: r.recyclerId,
        },
        r,
      );
      check(valid, 'handover hash does not match record');
      const prev = s.traceability[r.handoverReference];
      s.traceability[r.handoverReference] =
        prev?.status === 'confirmed' ? { ...r, status: 'confirmed', recyclerConfirmation: prev.recyclerConfirmation } : r;
      audit(s, op.kind, r.handoverReference, now);
      const pending = s.confirmations[r.handoverReference];
      if (pending) confirm(s, pending, now);
      break;
    }
    case 'confirmHandover': {
      const c = op.confirmation;
      check(REF_PATTERN.test(c.handoverReference), 'bad handover reference');
      check(c.finalPrice == null || c.finalPrice >= 0, 'finalPrice must be ≥ 0');
      s.confirmations[c.handoverReference] = c;
      audit(s, op.kind, c.handoverReference, now);
      confirm(s, c, now);
      break;
    }
    case 'markPaid': {
      const tx = s.transactions[op.transactionId];
      check(tx, `unknown transaction ${op.transactionId}`);
      if (tx.paymentStatus === 'pending') tx.paymentStatus = op.paymentStatus;
      tx.finalPrice ??= tx.quotedPrice;
      audit(s, op.kind, op.transactionId, now);
      break;
    }
    case 'updateRecyclerRates': {
      const recycler = s.recyclers.find((r) => r.recyclerId === op.recyclerId);
      check(recycler, `unknown recycler ${op.recyclerId}`);
      for (const [key, rate] of Object.entries(op.offeredRates)) {
        check(isCategory(key), `unknown category ${key}`);
        const category = key as MaterialCategory;
        check(typeof rate === 'number' && rate > 0 && rate < 100_000, 'rate out of range');
        recycler.offeredRates[category] = rate;
        if (!recycler.materialsAccepted.includes(category)) recycler.materialsAccepted.push(category);
        const band = priceBoardRow(s.prices, category);
        // Every rate change becomes a dated row in the price dataset.
        s.prices.push({
          category,
          location: SEED_CITY,
          date: op.at,
          buyingPrice: rate,
          quotedPrice: rate,
          unit: 'kg',
          recyclerId: recycler.recyclerId,
          marketRangeLow: band?.marketRangeLow ?? rate,
          marketRangeHigh: band?.marketRangeHigh ?? rate,
        });
      }
      audit(s, op.kind, op.recyclerId, now);
      break;
    }
  }
}

function audit(s: ServerState, kind: SyncOp['kind'], ref: string, at: number): void {
  s.audit.push({ at, kind, ref });
}

function confirm(s: ServerState, c: ConfirmationPayload, now: number): void {
  const record = s.traceability[c.handoverReference];
  if (!record) return; // held in s.confirmations until the record arrives
  record.status = 'confirmed';
  record.recyclerConfirmation ??= { confirmedAt: c.confirmedAt, confirmedBy: c.confirmedBy };
  const tx = s.transactions[record.transactionId];
  if (!tx) return;
  tx.transactionStatus = 'confirmed';
  tx.finalPrice = c.finalPrice ?? tx.finalPrice ?? tx.quotedPrice;
  if (tx.paymentStatus === 'pending') tx.paymentStatus = c.paymentStatus;

  const lot = s.lots[record.lotId];
  const category = lot?.category;
  if (!category || !(record.weight > 0)) return;
  const perKg = tx.finalPrice / record.weight;

  // Completed sales feed the price dataset (kept out of the market board average).
  const band = priceBoardRow(s.prices, category);
  s.prices.push({
    category,
    location: SEED_CITY,
    date: c.confirmedAt,
    buyingPrice: Math.round(perKg * 100) / 100,
    quotedPrice: Math.round((tx.quotedPrice / record.weight) * 100) / 100,
    unit: 'kg',
    recyclerId: tx.recyclerId,
    marketRangeLow: band?.marketRangeLow ?? perKg,
    marketRangeHigh: band?.marketRangeHigh ?? perKg,
  });

  const flag = transactionAnomaly(tx, record.weight, band?.marketRangeLow, band?.marketRangeHigh);
  if (flag) s.flags[tx.transactionId] = { ...flag, at: now };
}

/** Abnormal final value: far outside the market band, or far from what was quoted. */
export function transactionAnomaly(
  tx: Pick<Transaction, 'transactionId' | 'quotedPrice' | 'finalPrice'>,
  weightKg: number,
  marketLow?: number,
  marketHigh?: number,
): Omit<TransactionFlag, 'at'> | null {
  const final = tx.finalPrice ?? tx.quotedPrice;
  if (marketLow != null && marketHigh != null && weightKg > 0) {
    const a = detectPriceAnomaly(final / weightKg, marketLow, marketHigh);
    if (a.flagged) {
      return {
        transactionId: tx.transactionId,
        reason: a.direction === 'below' ? 'below_market' : 'above_market',
        deviationPct: a.deviationPct,
      };
    }
  }
  if (tx.quotedPrice > 0) {
    const dev = Math.abs(final - tx.quotedPrice) / tx.quotedPrice;
    if (dev > QUOTE_DEVIATION_THRESHOLD) {
      return { transactionId: tx.transactionId, reason: 'far_from_quote', deviationPct: Math.round(dev * 100) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface RemoteHandoverUpdate {
  transactionId: string;
  lotId: string;
  confirmation: ConfirmationPayload;
}

/** Confirmations for this collector's handovers. */
export function updatesFor(s: ServerState, collectorId: string): RemoteHandoverUpdate[] {
  return Object.values(s.traceability)
    .filter((r) => r.collectorId === collectorId && r.status === 'confirmed')
    .map((r) => {
      const tx = s.transactions[r.transactionId];
      const confirmation: ConfirmationPayload = s.confirmations[r.handoverReference] ?? {
        handoverReference: r.handoverReference,
        confirmedAt: r.recyclerConfirmation?.confirmedAt ?? Date.now(),
        confirmedBy: r.recyclerConfirmation?.confirmedBy ?? 'recycler',
        finalPrice: tx?.finalPrice,
        paymentStatus: tx?.paymentStatus ?? 'pending',
      };
      return { transactionId: r.transactionId, lotId: r.lotId, confirmation };
    });
}

export interface RemoteHandover {
  record: ServerRecord;
  transaction?: Transaction;
  lot?: ServerLot;
  flag?: TransactionFlag;
}

export function handoverByReference(s: ServerState, reference: string): RemoteHandover | null {
  const record = s.traceability[reference];
  if (!record) return null;
  return {
    record,
    transaction: s.transactions[record.transactionId],
    lot: s.lots[record.lotId],
    flag: s.flags[record.transactionId],
  };
}

/** All handovers going to one recycler — the recycler-side worklist. */
export function handoversForRecycler(s: ServerState, recyclerId: string): RemoteHandover[] {
  return Object.values(s.traceability)
    .filter((r) => r.recyclerId === recyclerId)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map((r) => handoverByReference(s, r.handoverReference)!);
}
