// Pure seed data — no IndexedDB/DOM imports, so the Node server can share it.
import type { MaterialCategory, PriceEntry, Recycler } from './models';

// All names, IDs and phone numbers below are fictional demo data for Nagpur.

export const DAY = 24 * 60 * 60 * 1000;
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

export const PRICE_PROFILES: Record<MaterialCategory, PriceProfile> = {
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
