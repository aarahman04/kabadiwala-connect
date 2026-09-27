import { useEffect, useState } from 'react';
import { getDB } from '../data/db';
import type { SyncQueueItem } from '../data/models';
import { getSyncStatus, runSync, subscribeSyncStatus, type SyncStatus } from '../data/syncRunner';
import { isSimulatedOffline, setSimulatedOffline, SIMULATE_OFFLINE_KEY } from '../services/api';
import { useStoreQuery } from './useStoreQuery';

export function useSyncQueue() {
  const { data: queue } = useStoreQuery<SyncQueueItem[]>(['syncQueue'], async () => (await getDB()).getAll('syncQueue'), []);
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [simulatedOffline, setSimOffline] = useState(isSimulatedOffline());

  useEffect(() => subscribeSyncStatus(setStatus), []);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => e.key === SIMULATE_OFFLINE_KEY && setSimOffline(isSimulatedOffline());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return {
    queue,
    pendingCount: queue.length,
    status,
    syncNow: runSync,
    simulatedOffline,
    setSimulatedOffline: (offline: boolean) => {
      setSimulatedOffline(offline);
      setSimOffline(offline);
    },
  };
}
