/**
 * Runs the offline queue against services/api.ts, then pulls remote state
 * (recycler confirmations, fresh recyclers + prices). Triggered by: the
 * "Sync now" button, the window `online` event, Background Sync wake-ups
 * from the service worker, and opportunistically after every local write.
 */
import { getDB, getSetting, notifyChange, setSetting } from './db';
import * as api from '../services/api';
import { applyConfirmation, flushQueue, isPaid, OfflineError } from '../logic/sync';

export interface SyncStatus {
  syncing: boolean;
  online: boolean;
  lastSyncAt?: number;
  lastError?: string;
  lastResult?: { sent: number; confirmed: number };
}

let status: SyncStatus = { syncing: false, online: typeof navigator === 'undefined' ? true : api.isOnline() };
const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch };
  listeners.forEach((l) => l(status));
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: (s: SyncStatus) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let inFlight: Promise<void> | null = null;

export function runSync(): Promise<void> {
  inFlight ??= doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<void> {
  if (!api.isOnline()) {
    setStatus({ online: false });
    return;
  }
  setStatus({ syncing: true, online: true, lastError: undefined });
  try {
    const sent = await pushQueue();
    const confirmed = await pullRemote();
    const lastSyncAt = Date.now();
    await setSetting('lastSyncAt', lastSyncAt);
    setStatus({ syncing: false, lastSyncAt, lastResult: { sent, confirmed } });
  } catch (err) {
    const offline = err instanceof OfflineError;
    setStatus({
      syncing: false,
      online: !offline && api.isOnline(),
      lastError: offline ? undefined : err instanceof Error ? err.message : String(err),
    });
  }
}

async function pushQueue(): Promise<number> {
  const db = await getDB();
  const items = await db.getAll('syncQueue');
  if (items.length === 0) return 0;
  const result = await flushQueue(items, api.pushOp);

  const tx = db.transaction('syncQueue', 'readwrite');
  for (const id of [...result.sent, ...result.dropped]) await tx.store.delete(id);
  for (const f of result.failed) {
    const item = await tx.store.get(f.id);
    if (item) await tx.store.put({ ...item, attempts: f.attempts, lastError: f.error });
  }
  await tx.done;
  notifyChange('syncQueue');
  if (result.halted) throw new OfflineError();
  return result.sent.length;
}

/** Returns how many local handovers flipped to confirmed. */
async function pullRemote(): Promise<number> {
  const db = await getDB();
  const collectorId = await getSetting<string>('collectorId');

  const [recyclers, prices] = await Promise.all([api.fetchRecyclers(), api.fetchPrices()]);
  const refTx = db.transaction(['recyclers', 'prices'], 'readwrite');
  await refTx.objectStore('prices').clear();
  await Promise.all([
    ...recyclers.map((r) => refTx.objectStore('recyclers').put(r)),
    ...prices.map((p) => refTx.objectStore('prices').add(p)),
    refTx.done,
  ]);
  notifyChange('recyclers', 'prices');

  if (!collectorId) return 0;
  const updates = await api.pullUpdates(collectorId);
  let confirmed = 0;
  for (const u of updates) {
    const tx = db.transaction(['materials', 'transactions', 'traceability', 'ledger'], 'readwrite');
    const [lot, transaction, record, ledger] = await Promise.all([
      tx.objectStore('materials').get(u.lotId),
      tx.objectStore('transactions').get(u.transactionId),
      tx.objectStore('traceability').get(u.lotId),
      tx.objectStore('ledger').index('byLot').get(u.lotId),
    ]);
    const alreadyApplied =
      transaction?.transactionStatus === 'confirmed' &&
      (isPaid(transaction.paymentStatus) || !isPaid(u.confirmation.paymentStatus));
    if (!lot || !transaction || !record || !ledger || alreadyApplied) {
      await tx.done;
      continue;
    }
    const next = applyConfirmation({ lot, transaction, record, ledger }, u.confirmation);
    await Promise.all([
      tx.objectStore('materials').put(next.lot),
      tx.objectStore('transactions').put(next.transaction),
      tx.objectStore('traceability').put(next.record),
      tx.objectStore('ledger').put(next.ledger),
      tx.done,
    ]);
    confirmed++;
  }
  if (confirmed) notifyChange('materials', 'transactions', 'traceability', 'ledger');
  return confirmed;
}

/**
 * Called after every local write: try right away if online, and register a
 * Background Sync so the browser wakes us when connectivity returns.
 */
export function requestSync(): void {
  if (api.isOnline()) void runSync();
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }).sync?.register('kc-sync'))
      .catch(() => {
        // SyncManager unsupported (Safari/Firefox) — online event + Sync now button cover it.
      });
  }
}

/** Wire up automatic triggers once at startup. */
export function startSyncTriggers(): () => void {
  const onOnline = () => {
    setStatus({ online: api.isOnline() });
    if (api.isOnline()) void runSync();
  };
  const onOffline = () => setStatus({ online: false });
  const onSwMessage = (e: MessageEvent) => {
    if (e.data?.type === 'kc-sync') void runSync();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  navigator.serviceWorker?.addEventListener('message', onSwMessage);
  void getSetting<number>('lastSyncAt').then((lastSyncAt) => setStatus({ lastSyncAt }));
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    navigator.serviceWorker?.removeEventListener('message', onSwMessage);
  };
}
