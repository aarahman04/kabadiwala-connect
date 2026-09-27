import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe, type StoreName } from '../data/db';

/**
 * Loads data from IndexedDB and reloads whenever one of `stores` changes
 * (in this tab or another). The shared primitive behind every data hook.
 */
export function useStoreQuery<T>(stores: StoreName[], load: () => Promise<T>, initial: T, deps: unknown[] = []) {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;
  const storesKey = stores.join(',');

  const reload = useCallback(async () => {
    const value = await loadRef.current();
    setData(value);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadRef.current().then((value) => {
      if (!alive) return;
      setData(value);
      setLoading(false);
    });
    const unsubscribe = subscribe((changed) => {
      if (changed.some((s) => storesKey.split(',').includes(s))) void reload().catch(() => {});
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [storesKey, reload, ...deps]);

  return { data, loading, reload };
}
