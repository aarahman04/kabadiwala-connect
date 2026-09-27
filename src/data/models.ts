// Core datasets — these map 1:1 to the problem statement's required datasets.
// Each has its own IndexedDB object store (see db.ts).

export type MaterialCategory =
  | 'CRT'
  | 'LCD_PANEL'
  | 'PCB'
  | 'CABLE'
  | 'BATTERY'
  | 'MOTOR_MAGNET'
  | 'MIXED_PLASTIC';

export const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'CRT',
  'LCD_PANEL',
  'PCB',
  'CABLE',
  'BATTERY',
  'MOTOR_MAGNET',
  'MIXED_PLASTIC',
];

export type Language = 'en' | 'hi' | 'mr';

export interface LatLng {
  lat: number;
  lng: number;
}

export type LotStatus = 'draft' | 'valued' | 'matched' | 'handed_over' | 'confirmed' | 'paid';

export interface MaterialLot {
  lotId: string; // uuid, generated client-side offline
  collectorId: string;
  category: MaterialCategory;
  subCategory?: string;
  description?: string;
  imageBlob: Blob; // stored in IndexedDB, not uploaded for demo
  approxWeightKg: number;
  condition?: string;
  sourceType?: string;
  estimatedValue: number; // computed from PriceBoard
  status: LotStatus;
  createdAt: number;
  location?: LatLng;
}

export interface PriceEntry {
  category: MaterialCategory;
  subCategory?: string;
  location: string;
  date: number;
  buyingPrice: number;
  quotedPrice?: number;
  unit: 'kg' | 'unit';
  recyclerId?: string;
  marketRangeLow: number;
  marketRangeHigh: number;
}

export type AuthorizationStatus = 'authorized' | 'pending' | 'unauthorized';

export interface Recycler {
  recyclerId: string;
  name: string;
  location: LatLng & { address: string };
  materialsAccepted: MaterialCategory[];
  authorizationStatus: AuthorizationStatus;
  authorizationId?: string;
  contact: string;
  offeredRates: Partial<Record<MaterialCategory, number>>;
  pickupAvailable: boolean;
  serviceArea: string;
}

export type PaymentStatus = 'pending' | 'paid_cash' | 'paid_digital';
export type TransactionStatus = 'pending' | 'handed_over' | 'confirmed' | 'disputed';

export interface Transaction {
  transactionId: string;
  lotId: string;
  collectorId: string;
  recyclerId: string;
  quotedPrice: number;
  finalPrice?: number;
  collectionLocation: LatLng;
  handoverLocation?: LatLng;
  dateTime: number;
  paymentStatus: PaymentStatus;
  transactionStatus: TransactionStatus;
}

export interface RecyclerConfirmation {
  confirmedAt: number;
  confirmedBy: string;
}

export interface TraceabilityRecord {
  lotId: string;
  photoBlobs: Blob[];
  weight: number;
  timestamp: number;
  location: LatLng;
  handoverReference: string; // human-readable short code, e.g. KC-8F3A2C
  handoverHash: string; // sha256 of (lotId+weight+timestamp+lat+lng+collectorId+recyclerId)
  recyclerConfirmation?: RecyclerConfirmation;
  status: 'pending_confirmation' | 'confirmed';
  // Not in the brief's interface, but needed to re-verify the hash on the
  // recycler side and to route confirmations back to the right transaction.
  collectorId: string;
  recyclerId: string;
  transactionId: string;
  locationApproximate?: boolean;
}

export interface CollectorProfile {
  collectorId: string;
  preferredLanguage: Language;
  operatingLocation: string;
  // no name/phone/address required — minimal per the problem statement's privacy note
}

export interface LedgerEntry {
  entryId: string;
  lotId: string;
  amount: number;
  type: 'earning' | 'due';
  status: 'pending' | 'settled';
  date: number;
}

// ---- Infrastructure types (not datasets) ----

/** What the recycler reports back when confirming a handover. */
export interface ConfirmationPayload {
  handoverReference: string;
  confirmedBy: string;
  confirmedAt: number;
  finalPrice?: number;
  paymentStatus: PaymentStatus;
}

export type SyncOp =
  | { kind: 'upsertLot'; lot: Omit<MaterialLot, 'imageBlob'> }
  | { kind: 'upsertTransaction'; transaction: Transaction }
  | { kind: 'upsertTraceability'; record: Omit<TraceabilityRecord, 'photoBlobs'> }
  | { kind: 'confirmHandover'; confirmation: ConfirmationPayload }
  | { kind: 'markPaid'; transactionId: string; paymentStatus: PaymentStatus };

export interface SyncQueueItem {
  id?: number; // autoIncrement key — preserves write order
  op: SyncOp;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
}
