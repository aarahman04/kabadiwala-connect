import { getDB } from '../data/db';
import type { MaterialLot, TraceabilityRecord, Transaction } from '../data/models';
import { completeHandover, createLot, markPaid, selectRecycler } from '../data/actions';
import { useStoreQuery } from './useStoreQuery';

export function useLots() {
  const { data: lots, loading } = useStoreQuery<MaterialLot[]>(
    ['materials'],
    async () => (await (await getDB()).getAllFromIndex('materials', 'byCreatedAt')).reverse(),
    [],
  );
  return { lots, loading, createLot, selectRecycler, completeHandover, markPaid };
}

export interface LotDetail {
  lot?: MaterialLot;
  transaction?: Transaction;
  record?: TraceabilityRecord;
}

/** Everything known about one lot — drives the valuation → match → handover flow. */
export function useLot(lotId: string | undefined) {
  const { data, loading } = useStoreQuery<LotDetail>(
    ['materials', 'transactions', 'traceability'],
    async () => {
      if (!lotId) return {};
      const db = await getDB();
      const [lot, transaction, record] = await Promise.all([
        db.get('materials', lotId),
        db.getFromIndex('transactions', 'byLot', lotId),
        db.get('traceability', lotId),
      ]);
      return { lot, transaction, record };
    },
    {},
    [lotId],
  );
  return { ...data, loading };
}
