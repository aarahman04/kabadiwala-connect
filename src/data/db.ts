import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  CollectorProfile,
  LedgerEntry,
  MaterialLot,
  PriceEntry,
  Recycler,
  SettingRow,
  SyncQueueItem,
  TraceabilityRecord,
  Transaction,
} from './models';

export const DB_NAME = 'kabadiwala-connect';
const DB_VERSION = 1;

/**
 * One object store per dataset. The first six are the problem statement's
 * datasets (Material, Price, Recycler, Transaction, Traceability, Collector);
 * ledger, syncQueue and settings are app infrastructure.
 */
export interface KCSchema extends DBSchema {
  materials: { key: string; value: MaterialLot; indexes: { byStatus: string; byCreatedAt: number } };
  prices: { key: number; value: PriceEntry & { id?: number }; indexes: { byCategory: string } };
  recyclers: { key: string; value: Recycler };
  transactions: { key: string; value: Transaction; indexes: { byLot: string } };
  traceability: { key: string; value: TraceabilityRecord; indexes: { byReference: string } };
  collectors: { key: string; value: CollectorProfile };
  ledger: { key: string; value: LedgerEntry; indexes: { byLot: string } };
  syncQueue: { key: number; value: SyncQueueItem };
  settings: { key: string; value: SettingRow };
}

export type StoreName = 'materials' | 'prices' | 'recyclers' | 'transactions' | 'traceability' | 'collectors' | 'ledger' | 'syncQueue' | 'settings';

let dbPromise: Promise<IDBPDatabase<KCSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<KCSchema>> {
  dbPromise ??= openDB<KCSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const materials = db.createObjectStore('materials', { keyPath: 'lotId' });
      materials.createIndex('byStatus', 'status');
      materials.createIndex('byCreatedAt', 'createdAt');

      const prices = db.createObjectStore('prices', { keyPath: 'id', autoIncrement: true });
      prices.createIndex('byCategory', 'category');

      db.createObjectStore('recyclers', { keyPath: 'recyclerId' });

      const transactions = db.createObjectStore('transactions', { keyPath: 'transactionId' });
      transactions.createIndex('byLot', 'lotId');

      const traceability = db.createObjectStore('traceability', { keyPath: 'lotId' });
      traceability.createIndex('byReference', 'handoverReference');

      db.createObjectStore('collectors', { keyPath: 'collectorId' });

      const ledger = db.createObjectStore('ledger', { keyPath: 'entryId' });
      ledger.createIndex('byLot', 'lotId');

      db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      db.createObjectStore('settings', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

// ---------------------------------------------------------------------------
// Change notifications — hooks subscribe and re-read. BroadcastChannel keeps a
// second tab (e.g. the ?role=recycler view) in step with the collector tab.
// ---------------------------------------------------------------------------

type Listener = (stores: StoreName[]) => void;
const listeners = new Set<Listener>();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kc-db') : null;

channel?.addEventListener('message', (e: MessageEvent<StoreName[]>) => {
  listeners.forEach((l) => l(e.data));
});

export function notifyChange(...stores: StoreName[]): void {
  listeners.forEach((l) => l(stores));
  channel?.postMessage(stores);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await (await getDB()).get('settings', key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await (await getDB()).put('settings', { key, value });
  notifyChange('settings');
}
