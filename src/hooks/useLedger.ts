import { useMemo } from 'react';
import { getDB } from '../data/db';
import type { LedgerEntry, MaterialLot, Transaction } from '../data/models';
import { markPaid } from '../data/actions';
import { summarizeLedger } from '../logic/sync';
import { useStoreQuery } from './useStoreQuery';

export interface LedgerRow {
  entry: LedgerEntry;
  lot?: MaterialLot;
  transaction?: Transaction;
  recyclerName?: string;
}

export function useLedger() {
  const { data: rows, loading } = useStoreQuery<LedgerRow[]>(
    ['ledger', 'materials', 'transactions', 'recyclers'],
    async () => {
      const db = await getDB();
      const entries = await db.getAll('ledger');
      const rows = await Promise.all(
        entries.map(async (entry) => {
          const transaction = await db.getFromIndex('transactions', 'byLot', entry.lotId);
          const recycler = transaction && (await db.get('recyclers', transaction.recyclerId));
          return { entry, lot: await db.get('materials', entry.lotId), transaction, recyclerName: recycler?.name };
        }),
      );
      return rows.sort((a, b) => b.entry.date - a.entry.date);
    },
    [],
  );
  const summary = useMemo(() => summarizeLedger(rows.map((r) => r.entry)), [rows]);
  return { rows, summary, loading, markPaid };
}
