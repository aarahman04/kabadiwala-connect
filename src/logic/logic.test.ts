import { describe, expect, it } from 'vitest';
import type { LedgerEntry, MaterialLot, Recycler, SyncOp, SyncQueueItem, TraceabilityRecord, Transaction } from '../data/models';
import { seedPrices, seedRecyclers } from '../data/seed';
import { detectPriceAnomaly } from './anomaly';
import { haversineKm } from './geo';
import {
  computeHandoverHash,
  handoverHashInput,
  normalizeReference,
  referenceFromHash,
  sha256Fallback,
  sha256Hex,
  verifyHandover,
} from './hashing';
import { eligibleRecyclers, rankRecyclers, scoreRecyclers } from './ranking';
import {
  advanceLotStatus,
  applyConfirmation,
  applyPayment,
  flushQueue,
  OfflineError,
  summarizeLedger,
} from './sync';
import { buildPriceBoard, priceTrend, trendChangePct, valueLot, valueRange } from './valuation';

const origin = { lat: 21.1458, lng: 79.0882 };

function recycler(id: string, over: Partial<Recycler> = {}): Recycler {
  return {
    recyclerId: id,
    name: id,
    location: { ...origin, address: '' },
    materialsAccepted: ['PCB'],
    authorizationStatus: 'authorized',
    contact: '',
    offeredRates: { PCB: 100 },
    pickupAvailable: false,
    serviceArea: '',
    ...over,
  };
}

const lot = { category: 'PCB' as const, location: origin };

describe('ranking', () => {
  it('filters out unauthorized, pending and non-accepting recyclers', () => {
    const list = [
      recycler('ok'),
      recycler('pending', { authorizationStatus: 'pending' }),
      recycler('unauth', { authorizationStatus: 'unauthorized' }),
      recycler('wrong', { materialsAccepted: ['CABLE'], offeredRates: { CABLE: 200 } }),
    ];
    expect(eligibleRecyclers(lot, list).map((r) => r.recyclerId)).toEqual(['ok']);
  });

  it('applies 0.5 rate + 0.3 proximity + 0.2 pickup weighting', () => {
    const near = recycler('near', { location: { lat: origin.lat + 0.01, lng: origin.lng, address: '' } }); // ~1.1 km
    const far = recycler('far', {
      location: { lat: origin.lat + 0.1, lng: origin.lng, address: '' }, // ~11 km
      offeredRates: { PCB: 200 },
      pickupAvailable: true,
    });
    const [first, second] = scoreRecyclers(lot, [near, far]);
    const dNear = haversineKm(origin, near.location);
    const dFar = haversineKm(origin, far.location);
    // far: full rate + proximity relative to nearest + pickup; near: half rate + full proximity
    expect(first.recycler.recyclerId).toBe('far');
    expect(first.score).toBeCloseTo(0.5 + 0.3 * (dNear / dFar) + 0.2, 6);
    expect(second.score).toBeCloseTo(0.25 + 0.3, 6);
  });

  it('prefers nearer recycler when rates and pickup tie', () => {
    const a = recycler('a', { location: { lat: origin.lat + 0.05, lng: origin.lng, address: '' } });
    const b = recycler('b', { location: { lat: origin.lat + 0.02, lng: origin.lng, address: '' } });
    expect(rankRecyclers({ ...lot } as MaterialLot, [a, b]).map((r) => r.recyclerId)).toEqual(['b', 'a']);
  });

  it('never ranks seeded pending/unauthorized recyclers', () => {
    const ranked = rankRecyclers({ ...lot } as MaterialLot, seedRecyclers());
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((r) => r.authorizationStatus === 'authorized')).toBe(true);
  });

  it('haversine is roughly right (Nagpur → Butibori ≈ 23 km)', () => {
    expect(haversineKm(origin, { lat: 20.942, lng: 79.004 })).toBeGreaterThan(20);
    expect(haversineKm(origin, { lat: 20.942, lng: 79.004 })).toBeLessThan(26);
  });
});

describe('valuation', () => {
  const now = Date.UTC(2026, 8, 28);
  const prices = seedPrices(now);

  it('seeds 30–40 price rows across all 7 categories', () => {
    expect(prices.length).toBeGreaterThanOrEqual(30);
    expect(prices.length).toBeLessThanOrEqual(40);
    expect(new Set(prices.map((p) => p.category)).size).toBe(7);
  });

  it('copper cable trends up ~8% over the window', () => {
    const change = trendChangePct(priceTrend(prices, 'CABLE'));
    expect(change).toBeGreaterThan(5);
    expect(change).toBeLessThan(11);
  });

  it('board excludes recycler quotes and values a lot', () => {
    const board = buildPriceBoard(prices);
    const pcb = board.PCB!;
    expect(pcb.pricePerUnit).toBeGreaterThan(110); // the ₹60 quote from rc-09 must not drag it down
    expect(valueLot(2, pcb)).toBe(Math.round(2 * pcb.pricePerUnit));
    expect(valueLot(0, pcb)).toBe(0);
    expect(valueRange(2, pcb)).toEqual({ low: 2 * pcb.marketRangeLow, high: 2 * pcb.marketRangeHigh });
  });
});

describe('anomaly', () => {
  it('flags >40% below the market low', () => {
    expect(detectPriceAnomaly(60, 110, 180)).toMatchObject({ flagged: true, direction: 'below', deviationPct: 45 });
  });
  it('does not flag moderate deviation', () => {
    expect(detectPriceAnomaly(80, 110, 180).flagged).toBe(false);
    expect(detectPriceAnomaly(150, 110, 180)).toMatchObject({ flagged: false, direction: 'within' });
  });
  it('flags >40% above the market high', () => {
    expect(detectPriceAnomaly(260, 110, 180)).toMatchObject({ flagged: true, direction: 'above' });
  });
});

describe('hashing', () => {
  const fields = {
    lotId: 'lot-1',
    weight: 3.5,
    timestamp: 1_700_000_000_000,
    location: { lat: 21.1458, lng: 79.0882 },
    collectorId: 'col-1',
    recyclerId: 'rc-02',
  };

  it('fallback SHA-256 matches known vectors and WebCrypto', async () => {
    const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    expect(hex(sha256Fallback(new TextEncoder().encode('abc')))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hex(sha256Fallback(new Uint8Array()))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    const long = 'x'.repeat(1000);
    expect(hex(sha256Fallback(new TextEncoder().encode(long)))).toBe(await sha256Hex(long));
  });

  it('hash is deterministic and covers every field', async () => {
    const h = await computeHandoverHash(fields);
    expect(h).toHaveLength(64);
    expect(await computeHandoverHash(fields)).toBe(h);
    expect(await computeHandoverHash({ ...fields, weight: 3.6 })).not.toBe(h);
    expect(await computeHandoverHash({ ...fields, recyclerId: 'rc-03' })).not.toBe(h);
    expect(handoverHashInput(fields)).toBe('lot-1|3.50|1700000000000|21.145800|79.088200|col-1|rc-02');
  });

  it('reference code format and verification', async () => {
    const h = await computeHandoverHash(fields);
    const ref = referenceFromHash(h);
    expect(ref).toMatch(/^KC-[0-9A-F]{6}$/);
    expect(await verifyHandover(fields, { handoverHash: h, handoverReference: ref })).toBe(true);
    expect(await verifyHandover({ ...fields, weight: 10 }, { handoverHash: h, handoverReference: ref })).toBe(false);
  });

  it('normalizes typed codes', () => {
    expect(normalizeReference('kc-8f3a2c')).toBe('KC-8F3A2C');
    expect(normalizeReference('8F3A2C')).toBe('KC-8F3A2C');
    expect(normalizeReference(' kc 8f3 a2c ')).toBe('KC-8F3A2C');
  });
});

describe('sync queue', () => {
  const op = (n: number): SyncOp => ({ kind: 'markPaid', transactionId: `t${n}`, paymentStatus: 'paid_cash' });
  const item = (id: number, attempts = 0): SyncQueueItem => ({ id, op: op(id), createdAt: id, attempts });

  it('sends in id order', async () => {
    const seen: string[] = [];
    const r = await flushQueue([item(3), item(1), item(2)], async (o) => {
      seen.push((o as { transactionId: string }).transactionId);
    });
    expect(seen).toEqual(['t1', 't2', 't3']);
    expect(r).toMatchObject({ sent: [1, 2, 3], halted: false });
  });

  it('halts on OfflineError so later ops never overtake', async () => {
    const r = await flushQueue([item(1), item(2), item(3)], async (o) => {
      if ((o as { transactionId: string }).transactionId === 't2') throw new OfflineError();
    });
    expect(r).toMatchObject({ sent: [1], halted: true, failed: [] });
  });

  it('records server rejections and drops after max attempts', async () => {
    const r = await flushQueue([item(1), item(2, 4)], async () => {
      throw new Error('bad');
    });
    expect(r.failed).toEqual([{ id: 1, error: 'bad', attempts: 1 }]);
    expect(r.dropped).toEqual([2]);
  });
});

describe('state transitions', () => {
  const baseLot = { lotId: 'l1', collectorId: 'c', category: 'PCB', imageBlob: new Blob(), approxWeightKg: 2, estimatedValue: 280, status: 'handed_over', createdAt: 0 } as MaterialLot;
  const baseTx: Transaction = {
    transactionId: 't1',
    lotId: 'l1',
    collectorId: 'c',
    recyclerId: 'r',
    quotedPrice: 300,
    collectionLocation: origin,
    dateTime: 0,
    paymentStatus: 'pending',
    transactionStatus: 'handed_over',
  };
  const baseRecord = { lotId: 'l1', photoBlobs: [], weight: 2, timestamp: 0, location: origin, handoverReference: 'KC-000000', handoverHash: '', status: 'pending_confirmation', collectorId: 'c', recyclerId: 'r', transactionId: 't1' } as TraceabilityRecord;
  const baseLedger: LedgerEntry = { entryId: 'e1', lotId: 'l1', amount: 300, type: 'due', status: 'pending', date: 0 };
  const bundle = { lot: baseLot, transaction: baseTx, record: baseRecord, ledger: baseLedger };

  it('cash confirmation settles the ledger at the final price', () => {
    const next = applyConfirmation(bundle, {
      handoverReference: 'KC-000000',
      confirmedBy: 'Vidarbha',
      confirmedAt: 5,
      finalPrice: 320,
      paymentStatus: 'paid_cash',
    });
    expect(next.transaction).toMatchObject({ transactionStatus: 'confirmed', finalPrice: 320, paymentStatus: 'paid_cash' });
    expect(next.record).toMatchObject({ status: 'confirmed', recyclerConfirmation: { confirmedBy: 'Vidarbha', confirmedAt: 5 } });
    expect(next.ledger).toMatchObject({ amount: 320, type: 'earning', status: 'settled' });
    expect(next.lot.status).toBe('paid');
  });

  it('pay-later confirmation leaves ledger pending as a due', () => {
    const next = applyConfirmation(bundle, { handoverReference: 'x', confirmedBy: 'r', confirmedAt: 1, paymentStatus: 'pending' });
    expect(next.ledger).toMatchObject({ amount: 300, type: 'due', status: 'pending' });
    expect(next.lot.status).toBe('confirmed');
  });

  it('confirmation does not override a payment the collector already recorded', () => {
    const paid = { ...bundle, transaction: { ...baseTx, paymentStatus: 'paid_digital' as const } };
    const next = applyConfirmation(paid, { handoverReference: 'x', confirmedBy: 'r', confirmedAt: 1, paymentStatus: 'paid_cash' });
    expect(next.transaction.paymentStatus).toBe('paid_digital');
  });

  it('manual cash toggle settles', () => {
    const next = applyPayment(bundle, 'paid_cash');
    expect(next.ledger).toMatchObject({ type: 'earning', status: 'settled', amount: 300 });
    expect(next.lot.status).toBe('paid');
  });

  it('statuses never move backwards', () => {
    expect(advanceLotStatus('paid', 'confirmed')).toBe('paid');
    expect(advanceLotStatus('valued', 'matched')).toBe('matched');
  });

  it('ledger summary splits settled vs pending', () => {
    expect(
      summarizeLedger([
        { ...baseLedger, amount: 100, status: 'settled' },
        { ...baseLedger, amount: 50, status: 'pending' },
      ]),
    ).toEqual({ total: 150, settled: 100, pending: 50 });
  });
});
