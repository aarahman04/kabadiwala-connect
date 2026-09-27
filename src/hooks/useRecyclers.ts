import { getDB } from '../data/db';
import type { Recycler } from '../data/models';
import { useStoreQuery } from './useStoreQuery';

export function useRecyclers() {
  const { data: recyclers, loading } = useStoreQuery<Recycler[]>(
    ['recyclers'],
    async () => (await getDB()).getAll('recyclers'),
    [],
  );
  return { recyclers, loading };
}
