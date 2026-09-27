import { Button, Icon, Stat, EmptyState, StatusPill } from '../components/ui';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import type { PaymentStatus } from '../data/models';
import type { LedgerRow } from '../hooks/useLedger';
import { TX_STATUS_NAMES } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';
import type { LedgerSummary } from '../logic/sync';

interface Props {
  rows: LedgerRow[];
  summary: LedgerSummary;
  onMarkPaid: (lotId: string, method: Exclude<PaymentStatus, 'pending'>) => void;
  onOpenLot: (lotId: string) => void;
}

export function Ledger({ rows, summary, onMarkPaid, onOpenLot }: Props) {
  const { t, lang, categoryName, formatNumber, formatDateTime } = useI18n();
  return (
    <section className="screen ledger-screen flex flex-col gap-3 p-3">
      <h2 className="text-xl font-bold">{t('ledgerTitle')}</h2>

      <div className="ledger-summary grid grid-cols-3 gap-2 text-center">
        <Stat className="summary-total" label={t('total')} value={`₹${formatNumber(summary.total)}`} />
        <Stat className="summary-settled" label={t('settled')} value={`₹${formatNumber(summary.settled)}`} />
        <Stat className="summary-pending" label={t('pending')} value={`₹${formatNumber(summary.pending)}`} />
      </div>

      {rows.length === 0 && <EmptyState icon="wallet">{t('noLedger')}</EmptyState>}
      <ul className="ledger-list flex flex-col gap-2">
        {rows.map(({ entry, lot, transaction, recyclerName }) => (
          <li key={entry.entryId} className={`ledger-entry rounded border p-2 entry-${entry.status}`}>
            <Button type="button" className="w-full text-left" onClick={() => onOpenLot(entry.lotId)}>
              <div className="flex justify-between">
                <span className="font-bold">
                  {lot ? (
                    <>
                      <CategoryIcon category={lot.category} /> {categoryName(lot.category)}
                    </>
                  ) : (
                    entry.lotId
                  )}
                </span>
                <span className="text-lg font-bold">₹{formatNumber(entry.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{formatDateTime(entry.date)}</span>
                <StatusPill className="entry-status" status={entry.status}>
                  {entry.status === 'settled' ? t('settled') : t(entry.type === 'due' ? 'due' : 'pending')}
                </StatusPill>
              </div>
              {transaction && (
                <div className="text-xs opacity-70">
                  {recyclerName && `${recyclerName} · `}
                  <StatusPill status={transaction.transactionStatus}>
                    {TX_STATUS_NAMES[lang][transaction.transactionStatus]}
                  </StatusPill>
                </div>
              )}
            </Button>
            {entry.status === 'pending' && (
              <Button
                type="button"
                className="btn btn-secondary mt-2 w-full py-2"
                onClick={() => onMarkPaid(entry.lotId, 'paid_cash')}
              >
                <Icon name="cash" /> {t('cashReceived')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
