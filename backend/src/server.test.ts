/**
 * Real HTTP round-trips: the client's api.ts talking to the server over a
 * socket, with collector and recycler acting as two separate devices.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './app';
import { MemoryStore, PostgresStore, type Store } from './store';

// Set KC_TEST_DATABASE_URL to run this whole suite against real Postgres.
const PG_URL = process.env.KC_TEST_DATABASE_URL;
const makeStore = (): Store => (PG_URL ? new PostgresStore(PG_URL) : new MemoryStore());
import type { MaterialLot, TraceabilityRecord, Transaction } from '../../src/data/models';
import { computeHandoverHash, referenceFromHash } from '../../src/logic/hashing';

const storage = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => void storage.set(k, v),
    removeItem: (k: string) => void storage.delete(k),
  },
});
Object.defineProperty(globalThis.navigator, 'onLine', { get: () => true, configurable: true });

const api = await import('../../src/services/api');

let server: Server;
let base: string;

beforeAll(async () => {
  server = createServer(createApp({ store: makeStore(), adminToken: 't0ken' }));
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  api.setApiBase(base);
});
afterAll(() => {
  api.setApiBase(undefined);
  server.close();
});

async function handover(collectorId: string, recyclerId: string, category: MaterialLot['category'], weight: number, quoted: number) {
  const lotId = `lot-${Math.random().toString(36).slice(2)}`;
  const timestamp = Date.now();
  const location = { lat: 21.1, lng: 79.05 };
  const handoverHash = await computeHandoverHash({ lotId, weight, timestamp, location, collectorId, recyclerId });
  const lot: Omit<MaterialLot, 'imageBlob'> = {
    lotId, collectorId, category, approxWeightKg: weight, estimatedValue: quoted, status: 'handed_over', createdAt: timestamp,
  };
  const tx: Transaction = {
    transactionId: `tx-${lotId}`, lotId, collectorId, recyclerId, quotedPrice: quoted, collectionLocation: location,
    dateTime: timestamp, paymentStatus: 'pending', transactionStatus: 'handed_over',
  };
  const record: Omit<TraceabilityRecord, 'photoBlobs'> = {
    lotId, weight, timestamp, location, handoverReference: referenceFromHash(handoverHash), handoverHash,
    status: 'pending_confirmation', collectorId, recyclerId, transactionId: tx.transactionId,
  };
  return { lot, tx, record };
}

describe('backend over HTTP', () => {
  it('serves seeded datasets', async () => {
    expect((await api.fetchRecyclers()).length).toBe(10);
    expect((await api.fetchPrices()).length).toBe(38);
    const health = await (await fetch(`${base}/api/health`)).json();
    expect(health).toMatchObject({ ok: true, store: PG_URL ? 'postgres' : 'memory' });
  });

  it('collector phone → server → recycler phone → server → collector phone', async () => {
    const { lot, tx, record } = await handover('collector-A', 'rc-01', 'CABLE', 4, 860);

    // Collector device syncs its queue.
    await api.pushOp({ kind: 'upsertLot', lot });
    await api.pushOp({ kind: 'upsertTransaction', transaction: tx });
    await api.pushOp({ kind: 'upsertTraceability', record });

    // A different device (recycler) looks the code up and sees it.
    const found = await api.lookupHandover(record.handoverReference);
    expect(found?.record.weight).toBe(4);
    expect(found?.lot?.category).toBe('CABLE');
    expect((await api.fetchRecyclerHandovers('rc-01')).map((h) => h.record.handoverReference)).toContain(
      record.handoverReference,
    );

    await api.pushOp({
      kind: 'confirmHandover',
      confirmation: { handoverReference: record.handoverReference, confirmedBy: 'GreenLoop', confirmedAt: Date.now(), finalPrice: 880, paymentStatus: 'paid_cash' },
    });

    // Collector device pulls the confirmation.
    const updates = await api.pullUpdates('collector-A');
    expect(updates).toHaveLength(1);
    expect(updates[0].confirmation).toMatchObject({ finalPrice: 880, paymentStatus: 'paid_cash' });
    expect(await api.pullUpdates('collector-B')).toHaveLength(0);

    // The sale became a dated row in the price dataset.
    const prices = await api.fetchPrices();
    expect(prices.some((p) => p.recyclerId === 'rc-01' && p.category === 'CABLE' && p.buyingPrice === 220)).toBe(true);
  });

  it('pickup request: collector asks, recycler accepts -> on the way -> arriving, collector sees each step', async () => {
    const { lot, tx, record } = await handover('collector-P', 'rc-02', 'CABLE', 3, 675);
    await api.pushOp({ kind: 'upsertLot', lot: { ...lot, status: 'matched' } });
    await api.pushOp({ kind: 'upsertTransaction', transaction: { ...tx, transactionStatus: 'pending' } });
    await api.pushOp({ kind: 'requestPickup', transactionId: tx.transactionId, contactPhone: '+91 98x 00 11', at: 1 });
    await api.pushOp({ kind: 'requestPickup', transactionId: tx.transactionId, at: 2 }); // repeat is a no-op

    // Recycler device sees it in its inbox (phone sanitized, lot attached).
    const inbox = await api.fetchPickupRequests('rc-02');
    const mine = inbox.find((r) => r.transaction.transactionId === tx.transactionId)!;
    expect(mine.transaction.pickup).toMatchObject({ status: 'requested', requestedAt: 1, contactPhone: '+91 98 00 11' });
    expect(mine.lot?.category).toBe('CABLE');
    expect(await api.fetchPickupRequests('rc-01')).toHaveLength(0);

    // Another facility can't act on it; steps can't go backwards.
    await expect(
      api.pushOp({ kind: 'updatePickup', transactionId: tx.transactionId, recyclerId: 'rc-01', status: 'accepted', at: 3 }),
    ).rejects.toThrow(/different recycler/);
    for (const [status, at] of [['accepted', 3], ['on_the_way', 4], ['arriving', 5], ['accepted', 6]] as const) {
      await api.pushOp({ kind: 'updatePickup', transactionId: tx.transactionId, recyclerId: 'rc-02', status, at });
    }
    const [p] = (await api.fetchPickups('collector-P')).filter((x) => x.transactionId === tx.transactionId);
    expect(p.pickup.status).toBe('arriving');
    expect(p.pickup.history.map((h) => h.status)).toEqual(['requested', 'accepted', 'on_the_way', 'arriving']);

    // A stale client copy of the transaction can't rewind the pickup.
    await api.pushOp({ kind: 'upsertTransaction', transaction: { ...tx, pickup: { ...p.pickup, status: 'requested' } } });
    expect((await api.fetchPickups('collector-P'))[0].pickup.status).toBe('arriving');

    // Handover + confirmation completes the pickup and empties the inbox.
    await api.pushOp({ kind: 'upsertTraceability', record });
    await api.pushOp({
      kind: 'confirmHandover',
      confirmation: { handoverReference: record.handoverReference, confirmedBy: 'V', confirmedAt: 9, paymentStatus: 'paid_cash' },
    });
    expect((await api.fetchPickups('collector-P'))[0].pickup.status).toBe('completed');
    expect((await api.fetchPickupRequests('rc-02')).some((r) => r.transaction.transactionId === tx.transactionId)).toBe(false);
  });

  it('pickup is refused for a drop-off-only recycler', async () => {
    const { tx } = await handover('collector-P', 'rc-03', 'CABLE', 1, 230); // rc-03: no pickup
    await api.pushOp({ kind: 'upsertTransaction', transaction: { ...tx, transactionStatus: 'pending' } });
    await expect(api.pushOp({ kind: 'requestPickup', transactionId: tx.transactionId, at: 1 })).rejects.toThrow(/pickup/);
  });

  it('refuses tampered records, unauthorized recyclers and junk', async () => {
    const { record, tx } = await handover('collector-A', 'rc-01', 'PCB', 2, 300);
    await expect(api.pushOp({ kind: 'upsertTraceability', record: { ...record, weight: 20 } })).rejects.toThrow(/hash/);
    await expect(api.pushOp({ kind: 'upsertTransaction', transaction: { ...tx, recyclerId: 'rc-07' } })).rejects.toThrow(
      /not authorized/,
    );
    const bad = await fetch(`${base}/api/ops`, { method: 'POST', body: '{nope' });
    expect(bad.status).toBe(400);
  });

  it('flags an abnormal final price', async () => {
    const { lot, tx, record } = await handover('collector-C', 'rc-02', 'PCB', 5, 800);
    await api.pushOp({ kind: 'upsertLot', lot });
    await api.pushOp({ kind: 'upsertTransaction', transaction: tx });
    await api.pushOp({ kind: 'upsertTraceability', record });
    await api.pushOp({
      kind: 'confirmHandover',
      confirmation: { handoverReference: record.handoverReference, confirmedBy: 'x', confirmedAt: Date.now(), finalPrice: 150, paymentStatus: 'paid_cash' },
    });
    const flags = await (await fetch(`${base}/api/export/flags.json`)).json();
    expect(flags).toContainEqual(expect.objectContaining({ transactionId: tx.transactionId, reason: 'below_market' }));
    expect((await api.lookupHandover(record.handoverReference))?.flag?.reason).toBe('below_market');
  });

  it.runIf(!!PG_URL)('state survives a server restart (fresh store reads the tables back)', async () => {
    const reloaded = await new PostgresStore(PG_URL!).load();
    expect(Object.keys(reloaded.lots).length).toBeGreaterThanOrEqual(2);
    expect(Object.values(reloaded.traceability).some((r) => r.status === 'confirmed')).toBe(true);
    expect(Object.keys(reloaded.flags).length).toBeGreaterThanOrEqual(1);
    expect(reloaded.audit.length).toBeGreaterThan(5);
  });

  it('recycler rate update feeds the recycler and price datasets', async () => {
    await api.pushOp({ kind: 'updateRecyclerRates', recyclerId: 'rc-04', offeredRates: { PCB: 150 }, at: Date.now() });
    const r = (await api.fetchRecyclers()).find((x) => x.recyclerId === 'rc-04')!;
    expect(r.offeredRates.PCB).toBe(150);
    expect((await api.fetchPrices()).some((p) => p.recyclerId === 'rc-04' && p.quotedPrice === 150)).toBe(true);
  });

  it('exports pseudonymized CSV datasets', async () => {
    const res = await fetch(`${base}/api/export/transactions.csv`);
    expect(res.headers.get('content-type')).toMatch(/text\/csv/);
    const csv = await res.text();
    expect(csv.split('\n')[0]).toContain('transactionId');
    expect(csv).not.toContain('collector-A');
    expect(csv).toMatch(/C-[0-9a-f]{10}/);
    const collectors = await (await fetch(`${base}/api/export/collectors.json`)).json();
    expect(collectors.length).toBeGreaterThanOrEqual(2);
  });

  it('CORS preflight and admin reset', async () => {
    const pre = await fetch(`${base}/api/ops`, { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect((await fetch(`${base}/api/admin/reset`, { method: 'POST' })).status).toBe(403);
    const ok = await fetch(`${base}/api/admin/reset`, { method: 'POST', headers: { authorization: 'Bearer t0ken' } });
    expect(ok.status).toBe(200);
    expect((await api.fetchPrices()).length).toBe(38);
  });

  it('unreachable server surfaces as offline, not a server rejection', async () => {
    api.setApiBase('http://127.0.0.1:9');
    const { OfflineError } = await import('../../src/logic/sync');
    await expect(api.fetchRecyclers()).rejects.toBeInstanceOf(OfflineError);
    api.setApiBase(base);
  });
});
