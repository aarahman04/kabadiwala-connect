import type { PaymentStatus } from '../data/models';
import type { LedgerRow } from '../hooks/useLedger';
import { CATEGORY_ICONS, TX_STATUS_NAMES } from '../i18n/strings';
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
        <div className="summary-total rounded border p-2">
          <div className="text-xs">{t('total')}</div>
          <div className="text-xl font-bold">₹{formatNumber(summary.total)}</div>
        </div>
        <div className="summary-settled rounded border p-2">
          <div className="text-xs">{t('settled')}</div>
          <div className="text-xl font-bold">₹{formatNumber(summary.settled)}</div>
        </div>
        <div className="summary-pending rounded border p-2">
          <div className="text-xs">{t('pending')}</div>
          <div className="text-xl font-bold">₹{formatNumber(summary.pending)}</div>
        </div>
      </div>

      {rows.length === 0 && <p className="empty-state">{t('noLedger')}</p>}
      <ul className="ledger-list flex flex-col gap-2">
        {rows.map(({ entry, lot, transaction }) => (
          <li key={entry.entryId} className={`ledger-entry rounded border p-2 entry-${entry.status}`}>
            <button type="button" className="w-full text-left" onClick={() => onOpenLot(entry.lotId)}>
              <div className="flex justify-between">
                <span className="font-bold">
                  {lot ? `${CATEGORY_ICONS[lot.category]} ${categoryName(lot.category)}` : entry.lotId}
                </span>
                <span className="text-lg font-bold">₹{formatNumber(entry.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{formatDateTime(entry.date)}</span>
                <span className={`entry-status status-${entry.status}`}>
                  {entry.status === 'settled' ? `✅ ${t('settled')}` : `⏳ ${t(entry.type === 'due' ? 'due' : 'pending')}`}
                </span>
              </div>
              {transaction && (
                <div className="text-xs opacity-70">{TX_STATUS_NAMES[lang][transaction.transactionStatus]}</div>
              )}
            </button>
            {entry.status === 'pending' && (
              <button
                type="button"
                className="btn btn-secondary mt-2 w-full py-2"
                onClick={() => onMarkPaid(entry.lotId, 'paid_cash')}
              >
                {t('cashReceived')}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
