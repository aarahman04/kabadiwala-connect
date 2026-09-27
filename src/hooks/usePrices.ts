import { useMemo } from 'react';
import { getDB } from '../data/db';
import type { PriceEntry } from '../data/models';
import { buildPriceBoard } from '../logic/valuation';
import { useStoreQuery } from './useStoreQuery';

export function usePrices() {
  const { data: prices, loading } = useStoreQuery<PriceEntry[]>(
    ['prices'],
    async () => (await getDB()).getAll('prices'),
    [],
  );
  const board = useMemo(() => buildPriceBoard(prices), [prices]);
  return { prices, board, loading };
}
