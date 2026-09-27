import { getDB, getSetting, notifyChange, setSetting } from './db';
import type {
  CollectorProfile,
  LedgerEntry,
  MaterialCategory,
  MaterialLot,
  PriceEntry,
  Recycler,
  TraceabilityRecord,
  Transaction,
} from './models';
import { computeHandoverHash, referenceFromHash } from '../logic/hashing';
import { newId } from './ids';

// All names, IDs and phone numbers below are fictional demo data for Nagpur.

const DAY = 24 * 60 * 60 * 1000;
export const SEED_CITY = 'Nagpur';

export function seedRecyclers(): Recycler[] {
  return [
    {
      recyclerId: 'rc-01',
      name: 'GreenLoop E-Recyclers',
      location: { lat: 21.106, lng: 78.978, address: 'Plot 14, MIDC Hingna, Nagpur' },
      materialsAccepted: ['PCB', 'CABLE', 'BATTERY', 'LCD_PANEL', 'MOTOR_MAGNET'],
      authorizationStatus: 'authorized',
      authorizationId: 'MPCB-EW-DEMO-0141',
      contact: '+91 90000 00101',
      offeredRates: { PCB: 150, CABLE: 215, BATTERY: 58, LCD_PANEL: 19, MOTOR_MAGNET: 40 },
      pickupAvailable: true,
      serviceArea: 'Hingna, Wadi, Pratap Nagar',
    },
    {
      recyclerId: 'rc-02',
      name: 'Vidarbha E-Waste Solutions',
      location: { lat: 20.942, lng: 79.004, address: 'D-22, Butibori MIDC, Nagpur' },
      materialsAccepted: ['CRT', 'LCD_PANEL', 'PCB', 'CABLE', 'BATTERY', 'MOTOR_MAGNET', 'MIXED_PLASTIC'],
      authorizationStatus: 'authorized',
      authorizationId: 'MPCB-EW-DEMO-0087',
      contact: '+91 90000 00102',
      offeredRates: { CRT: 10, LCD_PANEL: 20, PCB: 160, CABLE: 225, BATTERY: 60, MOTOR_MAGNET: 42, MIXED_PLASTIC: 15 },
      pickupAvailable: true,
      serviceArea: 'All Nagpur district',
    },
    {
      recyclerId: 'rc-03',
      name: 'Orange City Metal Recovery',
      location: { lat: 21.172, lng: 79.133, address: 'Near Kalamna Market, Nagpur' },
      materialsAccepted: ['CABLE', 'MOTOR_MAGNET', 'PCB'],
      authorizationStatus: 'authorized',
      authorizationId: 'MPCB-EW-DEMO-0203',
      contact: '+91 90000 00103',
      offeredRates: { CABLE: 230, MOTOR_MAGNET: 45, PCB: 140 },
      pickupAvailable: false,
      serviceArea: 'Kalamna, Pardi, Wardhaman Nagar',
    },
    {
      recyclerId: 'rc-04',
      name: 'Sitabuldi Electronics Scrap Hub',
      location: { lat: 21.143, lng: 79.083, address: 'Modi No. 3, Sitabuldi, Nagpur' },
      materialsAccepted: ['CRT', 'LCD_PANEL', 'PCB', 'CABLE', 'MIXED_PLASTIC'],
      authorizationStatus: 'authorized',
      authorizationId: 'MPCB-EW-DEMO-0319',
      contact: '+91 90000 00104',
      offeredRates: { CRT: 8, LCD_PANEL: 17, PCB: 135, CABLE: 205, MIXED_PLASTIC: 13 },
      pickupAvailable: false,
      serviceArea: 'Sitabuldi, Dharampeth, Sadar',
    },
    {
      recyclerId: 'rc-05',
      name: 'Wadi Battery Recyclers',
      location: { lat: 21.155, lng: 79.02, address: 'Amravati Road, Wadi, Nagpur' },
      materialsAccepted: ['BATTERY', 'CABLE'],
      authorizationStatus: 'authorized',
      authorizationId: 'MPCB-EW-DEMO-0277',
      contact: '+91 90000 00105',
      offeredRates: { BATTERY: 62, CABLE: 200 },
      pickupAvailable: true,
      serviceArea: 'Wadi, Hingna, Dabha',
    },
    {
      recyclerId: 'rc-06',
      name: 'Itwari Kabad Traders',
      location: { lat: 21.156, lng: 79.113, address: 'Itwari, Nagpur' },
      materialsAccepted: ['PCB', 'CABLE', 'CRT'],
      authorizationStatus: 'pending',
      contact: '+91 90000 00106',
      offeredRates: { PCB: 170, CABLE: 240, CRT: 12 },
      pickupAvailable: true,
      serviceArea: 'Itwari, Gandhibagh',
    },
    {
      recyclerId: 'rc-07',
      name: 'Kamptee Road Scrap Yard',
      location: { lat: 21.19, lng: 79.1, address: 'Kamptee Road, Nagpur' },
      materialsAccepted: ['CRT', 'PCB', 'CABLE', 'BATTERY', 'MIXED_PLASTIC'],
      authorizationStatus: 'unauthorized',
      contact: '+91 90000 00107',
      offeredRates: { CRT: 14, PCB: 180, CABLE: 250, BATTERY: 70, MIXED_PLASTIC: 18 },
      pickupAvailable: true,
      serviceArea: 'Kamptee Road, Indora',
    },
    {
      recyclerId: 'rc-08',
      name: 'Kapsi Plastic & E-Scrap',
      location: { lat: 21.125, lng: 79.18, address: 'Bhandara Road, Kapsi, Nagpur' },
      materialsAccepted: ['MIXED_PLASTIC', 'CRT', 'LCD_PANEL'],
      authorizationStatus: 'authorized',
      authorizationId: 'MPCB-EW-DEMO-0352',
      contact: '+91 90000 00108',
      offeredRates: { MIXED_PLASTIC: 16, CRT: 11, LCD_PANEL: 21 },
      pickupAvailable: true,
      serviceArea: 'Kapsi, Pardi, Bhandara Road',
    },
    {
      // Authorized but quoting well under market — exercises the anomaly badge.
      recyclerId: 'rc-09',
      name: 'Manewada Scrap Mart',
      location: { lat: 21.11, lng: 79.112, address: 'Manewada Square, Nagpur' },
      materialsAccepted: ['PCB', 'CABLE', 'BATTERY'],
      authorizationStatus: 'authorized',
      authorizationId: 'MPCB-EW-DEMO-0398',
      contact: '+91 90000 00109',
      offeredRates: { PCB: 60, CABLE: 95, BATTERY: 50 },
      pickupAvailable: true,
      serviceArea: 'Manewada, Besa, Hudkeshwar',
    },
    {
      recyclerId: 'rc-10',
      name: 'Pardi E-Recycle Centre',
      location: { lat: 21.16, lng: 79.145, address: 'Pardi Naka, Nagpur' },
      materialsAccepted: ['LCD_PANEL', 'PCB', 'BATTERY'],
      authorizationStatus: 'pending',
      contact: '+91 90000 00110',
      offeredRates: { LCD_PANEL: 22, PCB: 155, BATTERY: 64 },
      pickupAvailable: false,
      serviceArea: 'Pardi, Kalamna',
    },
  ];
}

interface PriceProfile {
  base: number; // ₹/kg at the start of the window
  driftPct: number; // total change over the window
  low: number;
  high: number;
}

const PRICE_PROFILES: Record<MaterialCategory, PriceProfile> = {
  CRT: { base: 9, driftPct: 0, low: 6, high: 12 },
  LCD_PANEL: { base: 18.5, driftPct: -3, low: 12, high: 24 },
  PCB: { base: 142, driftPct: 4, low: 110, high: 180 },
  CABLE: { base: 200, driftPct: 8, low: 170, high: 250 }, // copper drifting up
  BATTERY: { base: 54, driftPct: 2, low: 40, high: 70 },
  MOTOR_MAGNET: { base: 38, driftPct: 0, low: 28, high: 48 },
  MIXED_PLASTIC: { base: 14.2, driftPct: -2, low: 10, high: 18 },
};

const SAMPLE_DAYS_AGO = [60, 45, 30, 15, 1];

/** Deterministic wobble so the demo looks the same every time. */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.03; // ±1.5%
}

export function seedPrices(now = Date.now()): PriceEntry[] {
  const rows: PriceEntry[] = [];
  (Object.keys(PRICE_PROFILES) as MaterialCategory[]).forEach((category, ci) => {
    const p = PRICE_PROFILES[category];
    SAMPLE_DAYS_AGO.forEach((daysAgo, si) => {
      const progress = si / (SAMPLE_DAYS_AGO.length - 1);
      const isLast = si === SAMPLE_DAYS_AGO.length - 1;
      const trend = p.base * (1 + (p.driftPct / 100) * progress);
      const price = isLast ? trend : trend * (1 + jitter(ci * 10 + si));
      rows.push({
        category,
        location: SEED_CITY,
        date: now - daysAgo * DAY,
        buyingPrice: Math.round(price * 100) / 100,
        unit: 'kg',
        marketRangeLow: p.low,
        marketRangeHigh: p.high,
      });
    });
  });

  // A few recycler-specific quotes (kept out of the market board average).
  const quotes: [string, MaterialCategory, number][] = [
    ['rc-02', 'PCB', 160],
    ['rc-03', 'CABLE', 230],
    ['rc-09', 'PCB', 60],
  ];
  for (const [recyclerId, category, quotedPrice] of quotes) {
    const p = PRICE_PROFILES[category];
    rows.push({
      category,
      location: SEED_CITY,
      date: now - 3 * DAY,
      buyingPrice: quotedPrice,
      quotedPrice,
      unit: 'kg',
      recyclerId,
      marketRangeLow: p.low,
      marketRangeHigh: p.high,
    });
  }
  return rows;
}

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
