import type { MaterialLot, Recycler } from '../data/models';
import { CATEGORY_ICONS } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';
import type { PriceAnomaly } from '../logic/anomaly';
import type { RankedRecycler } from '../logic/ranking';

export interface MatchRow extends RankedRecycler {
  anomaly: PriceAnomaly;
  expectedAmount: number;
}

interface Props {
  lot: MaterialLot;
  rows: MatchRow[];
  hiddenCount: number; // unauthorized/pending buyers filtered out
  selectedRecyclerId?: string;
  onChoose: (recycler: Recycler) => void;
  onBack: () => void;
}

export function RecyclerMatch({ lot, rows, hiddenCount, selectedRecyclerId, onChoose, onBack }: Props) {
  const { t, categoryName, formatNumber } = useI18n();
  return (
    <section className="screen recycler-match-screen flex flex-col gap-3 p-3">
      <h2 className="text-xl font-bold">
        {CATEGORY_ICONS[lot.category]} {t('recyclersFor', { category: categoryName(lot.category) })}
      </h2>
      {hiddenCount > 0 && <p className="hidden-note text-sm">🛡️ {t('hiddenUnauthorized', { count: hiddenCount })}</p>}
      {rows.length === 0 && <p className="empty-state">{t('noRecyclers')}</p>}

      <ol className="recycler-list flex flex-col gap-2">
        {rows.map((row, i) => {
          const r = row.recycler;
          return (
            <li
              key={r.recyclerId}
              className={`recycler-card rounded border p-3 ${r.recyclerId === selectedRecyclerId ? 'is-selected ring-2' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  {i === 0 && <span className="best-badge text-xs font-bold">⭐ {t('bestMatch')}</span>}
                  <div className="text-lg font-bold">{r.name}</div>
                  <div className="text-sm">
                    ✅ {t('authorized')}
                    {r.authorizationId && ` · ${t('authId', { id: r.authorizationId })}`}
                  </div>
                  <div className="text-sm">{r.location.address}</div>
                </div>
                <div className="score text-right text-xs opacity-60">{formatNumber(row.score * 100)}</div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
                <span className="rate font-bold">{t('offers', { rate: formatNumber(row.offeredRate) })}</span>
                <span className="payout font-bold">{t('youGet', { amount: formatNumber(row.expectedAmount) })}</span>
                <span className="distance">{t('distance', { km: formatNumber(row.distanceKm, 1) })}</span>
                <span className="pickup">{r.pickupAvailable ? t('pickup') : t('noPickup')}</span>
              </div>

              {row.anomaly.flagged && (
                <div className="anomaly-badge mt-2 rounded bg-yellow-100 p-2 text-sm font-bold" role="alert">
                  {t(row.anomaly.direction === 'below' ? 'anomalyBelow' : 'anomalyAbove', { pct: row.anomaly.deviationPct })}
                </div>
              )}

              <div className="mt-2 flex gap-2">
                <button type="button" className="btn btn-primary flex-1 py-2" onClick={() => onChoose(r)}>
                  {t('choose')}
                </button>
                <a className="btn btn-secondary py-2" href={`tel:${r.contact.replace(/\s/g, '')}`}>
                  {t('call')}
                </a>
              </div>
            </li>
          );
        })}
      </ol>
      <button type="button" className="btn btn-link" onClick={onBack}>
        ← {t('back')}
      </button>
    </section>
  );
}
