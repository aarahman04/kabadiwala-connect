/**
 * End-to-end "definition of done" against real IndexedDB semantics
 * (fake-indexeddb): offline lot → match → handover → recycler confirm,
 * then reconnect + sync → transaction confirmed and ledger settled.
 */
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';

// Minimal browser globals for the mock API (localStorage + connectivity).
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
});
let online = false;
Object.defineProperty(globalThis.navigator, 'onLine', { get: () => online, configurable: true });

const { getDB } = await import('./db');
const { ensureSeeded } = await import('./seed');
const { createLot, selectRecycler, completeHandover, recyclerConfirm, markPaid, requestPickup, updatePickup } = await import('./actions');
const { runSync } = await import('./syncRunner');
const { lookupHandover } = await import('./recyclerLookup');

describe('offline handover → sync → confirmed', () => {
  let collectorId: string;
  beforeAll(async () => {
    collectorId = (await ensureSeeded()).collectorId;
  });

  it('seeds datasets and a confirmed demo transaction', async () => {
    const db = await getDB();
    expect((await db.getAll('recyclers')).length).toBeGreaterThanOrEqual(8);
    expect((await db.getAll('ledger')).filter((e) => e.status === 'settled')).toHaveLength(1);
    expect((await db.getAll('transactions'))[0].transactionStatus).toBe('confirmed');
  });

  it('runs the whole demo flow', { timeout: 30_000 }, async () => {
    const db = await getDB();
    const recycler = (await db.get('recyclers', 'rc-01'))!;

    // --- airplane mode ---
    const lot = await createLot({
      collectorId,
      imageBlob: new Blob(['x']),
      category: 'CABLE',
      approxWeightKg: 4,
      estimatedValue: 840,
    });
    const tx = await selectRecycler(lot.lotId, recycler, { lat: 21.14, lng: 79.08 });
    expect(tx.quotedPrice).toBe(4 * 215);

    const record = await completeHandover({
      lotId: lot.lotId,
      photo: new Blob(['y']),
      location: { lat: 21.1, lng: 79.0 },
      locationApproximate: false,
    });
    expect(record.handoverReference).toMatch(/^KC-[0-9A-F]{6}$/);
    expect(await completeHandover({ lotId: lot.lotId, photo: new Blob(), location: record.location, locationApproximate: false })).toEqual(record);

    // Recycler on the same device verifies the code offline and confirms (queued).
    const found = await lookupHandover(record.handoverReference.toLowerCase());
    expect(found).toMatchObject({ source: 'local', hashValid: true, weight: 4, alreadyConfirmed: false });
    await recyclerConfirm({
      handoverReference: record.handoverReference,
      confirmedBy: recycler.name,
      confirmedAt: Date.now(),
      finalPrice: 880,
      paymentStatus: 'paid_cash',
    });

    await runSync(); // offline: no-op
    expect((await db.getAll('syncQueue')).length).toBeGreaterThan(0);
    expect((await db.get('transactions', tx.transactionId))!.transactionStatus).toBe('handed_over');
    const pendingLedger = await db.getFromIndex('ledger', 'byLot', lot.lotId);
    expect(pendingLedger).toMatchObject({ status: 'pending', type: 'due', amount: 860 });

    // --- back online, "Sync now" ---
    online = true;
    await runSync();

    expect(await db.getAll('syncQueue')).toHaveLength(0);
    expect(await db.get('transactions', tx.transactionId)).toMatchObject({
      transactionStatus: 'confirmed',
      paymentStatus: 'paid_cash',
      finalPrice: 880,
    });
    expect(await db.get('traceability', lot.lotId)).toMatchObject({
      status: 'confirmed',
      recyclerConfirmation: { confirmedBy: recycler.name },
    });
    expect(await db.getFromIndex('ledger', 'byLot', lot.lotId)).toMatchObject({
      status: 'settled',
      type: 'earning',
      amount: 880,
    });
    expect((await db.get('materials', lot.lotId))!.status).toBe('paid');
  });

  it('double-tapped payment and confirm buttons queue exactly one op each', async () => {
    const db = await getDB();
    online = false;
    const recycler = (await db.get('recyclers', 'rc-05'))!;
    const lot = await createLot({ collectorId, imageBlob: new Blob(), category: 'BATTERY', approxWeightKg: 3, estimatedValue: 160 });
    await selectRecycler(lot.lotId, recycler, { lat: 21.14, lng: 79.08 });
    const record = await completeHandover({ lotId: lot.lotId, photo: new Blob(), location: { lat: 21.1, lng: 79.0 }, locationApproximate: false });
    const before = (await db.getAll('syncQueue')).length;

    // cash + digital tapped in quick succession, plus a repeat cash tap
    await Promise.all([markPaid(lot.lotId, 'paid_cash'), markPaid(lot.lotId, 'paid_digital'), markPaid(lot.lotId, 'paid_cash')]);
    const confirm = { handoverReference: record.handoverReference, confirmedBy: 'W', confirmedAt: 1, paymentStatus: 'paid_cash' as const };
    await Promise.all([recyclerConfirm(confirm), recyclerConfirm(confirm)]);

    const added = (await db.getAll('syncQueue')).slice(before).map((q) => q.op.kind);
    expect(added.filter((k) => k === 'markPaid')).toHaveLength(1);
    expect(added.filter((k) => k === 'confirmHandover')).toHaveLength(1);
    expect((await db.get('transactions', record.transactionId))!.paymentStatus).toBe('paid_cash');
    online = true;
    await runSync();
  }, 30_000);

  it('pickup request made offline reaches the recycler; their progress flows back', { timeout: 30_000 }, async () => {
    const db = await getDB();
    online = false;
    const recycler = (await db.get('recyclers', 'rc-02'))!;
    const lot = await createLot({ collectorId, imageBlob: new Blob(), category: 'LCD_PANEL', approxWeightKg: 8, estimatedValue: 150 });
    const tx = await selectRecycler(lot.lotId, recycler, { lat: 21.14, lng: 79.08 });
    await requestPickup(lot.lotId, '98765 43210');
    await requestPickup(lot.lotId); // double tap
    expect((await db.getAll('syncQueue')).filter((q) => q.op.kind === 'requestPickup')).toHaveLength(1);
    expect((await db.get('transactions', tx.transactionId))!.pickup?.status).toBe('requested');

    online = true;
    await runSync();
    const { fetchPickupRequests } = await import('../services/api');
    expect((await fetchPickupRequests('rc-02')).map((r) => r.transaction.transactionId)).toContain(tx.transactionId);

    await updatePickup(tx.transactionId, 'rc-02', 'accepted');
    await updatePickup(tx.transactionId, 'rc-02', 'on_the_way');
    await runSync();
    const local = (await db.get('transactions', tx.transactionId))!;
    expect(local.pickup?.status).toBe('on_the_way');
    expect(local.pickup?.contactPhone).toBe('98765 43210');
  });

  it('confirmation that reaches the server before the handover still matches', async () => {
    const db = await getDB();
    const recycler = (await db.get('recyclers', 'rc-02'))!;
    online = false;
    const lot = await createLot({ collectorId, imageBlob: new Blob(), category: 'PCB', approxWeightKg: 2, estimatedValue: 290 });
    await selectRecycler(lot.lotId, recycler, { lat: 21.14, lng: 79.08 });
    const record = await completeHandover({ lotId: lot.lotId, photo: new Blob(), location: { lat: 21.1, lng: 79.0 }, locationApproximate: true });

    // Recycler's own device is online; server doesn't know the code yet.
    const { pushOp } = await import('../services/api');
    online = true;
    await pushOp({
      kind: 'confirmHandover',
      confirmation: { handoverReference: record.handoverReference, confirmedBy: 'X', confirmedAt: 1, paymentStatus: 'paid_digital' },
    });
    await runSync();
    expect((await db.get('transactions', record.transactionId))!).toMatchObject({
      transactionStatus: 'confirmed',
      paymentStatus: 'paid_digital',
    });
  });
});
