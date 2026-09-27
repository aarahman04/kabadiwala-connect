import { getDB, getSetting, notifyChange, setSetting } from './db';
import type {
  CollectorProfile,
  LedgerEntry,
  MaterialLot,
  TraceabilityRecord,
  Transaction,
} from './models';
import { computeHandoverHash, referenceFromHash } from '../logic/hashing';
import { newId } from './ids';
import { DAY, PRICE_PROFILES, SEED_CITY, seedPrices, seedRecyclers } from './seedData';

export { SEED_CITY, seedPrices, seedRecyclers };

export function placeholderImage(label: string): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150"><rect width="200" height="150" fill="#e5e7eb"/><text x="100" y="90" font-size="48" text-anchor="middle">${label}</text></svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

/** One confirmed, paid handover so the ledger isn't empty on first launch. */
export async function seedDemoHandover(collectorId: string, now = Date.now()) {
  const recycler = seedRecyclers()[1]; // Vidarbha E-Waste Solutions
  const lotId = 'demo-lot-0001';
  const weight = 3.5;
  const timestamp = now - 15 * DAY;
  const location = { lat: 21.1458, lng: 79.0882 };
  const amount = Math.round(weight * (recycler.offeredRates.PCB ?? 0));
  const handoverHash = await computeHandoverHash({
    lotId,
    weight,
    timestamp,
    location,
    collectorId,
    recyclerId: recycler.recyclerId,
  });
  const image = placeholderImage('🟩');

  const lot: MaterialLot = {
    lotId,
    collectorId,
    category: 'PCB',
    description: 'Mixed motherboards',
    imageBlob: image,
    approxWeightKg: weight,
    estimatedValue: Math.round(weight * PRICE_PROFILES.PCB.base),
    status: 'paid',
    createdAt: timestamp - 2 * 60 * 60 * 1000,
    location,
  };
  const transaction: Transaction = {
    transactionId: 'demo-tx-0001',
    lotId,
    collectorId,
    recyclerId: recycler.recyclerId,
    quotedPrice: amount,
    finalPrice: amount,
    collectionLocation: location,
    handoverLocation: location,
    dateTime: timestamp,
    paymentStatus: 'paid_cash',
    transactionStatus: 'confirmed',
  };
  const record: TraceabilityRecord = {
    lotId,
    photoBlobs: [image],
    weight,
    timestamp,
    location,
    handoverReference: referenceFromHash(handoverHash),
    handoverHash,
    recyclerConfirmation: { confirmedAt: timestamp + 20 * 60 * 1000, confirmedBy: recycler.name },
    status: 'confirmed',
    collectorId,
    recyclerId: recycler.recyclerId,
    transactionId: transaction.transactionId,
  };
  const ledger: LedgerEntry = {
    entryId: 'demo-ledger-0001',
    lotId,
    amount,
    type: 'earning',
    status: 'settled',
    date: timestamp,
  };
  return { lot, transaction, record, ledger };
}

/**
 * First-launch setup: create the local collector profile and populate every
 * store. Idempotent — guarded by a settings flag.
 */
let seeding: Promise<CollectorProfile> | null = null;

export function ensureSeeded(): Promise<CollectorProfile> {
  // Memoized: React StrictMode runs effects twice and we must not double-insert prices.
  seeding ??= runSeed();
  return seeding;
}

async function runSeed(): Promise<CollectorProfile> {
  const db = await getDB();
  let collectorId = await getSetting<string>('collectorId');
  if (!collectorId) {
    collectorId = newId();
    const profile: CollectorProfile = { collectorId, preferredLanguage: 'hi', operatingLocation: SEED_CITY };
    await db.put('collectors', profile);
    await setSetting('collectorId', collectorId);
    await setSetting('language', profile.preferredLanguage);
  }

  if (!(await getSetting<boolean>('seeded'))) {
    const now = Date.now();
    const demo = await seedDemoHandover(collectorId, now);
    const tx = db.transaction(
      ['recyclers', 'prices', 'materials', 'transactions', 'traceability', 'ledger'],
      'readwrite',
    );
    await Promise.all([
      ...seedRecyclers().map((r) => tx.objectStore('recyclers').put(r)),
      ...seedPrices(now).map((p) => tx.objectStore('prices').add(p)),
      tx.objectStore('materials').put(demo.lot),
      tx.objectStore('transactions').put(demo.transaction),
      tx.objectStore('traceability').put(demo.record),
      tx.objectStore('ledger').put(demo.ledger),
      tx.done,
    ]);
    await setSetting('seeded', true);
    notifyChange('recyclers', 'prices', 'materials', 'transactions', 'traceability', 'ledger');
  }

  return (await db.get('collectors', collectorId))!;
}
