import type { MaterialLot } from '../data/models';
import { BlobImage } from '../components/BlobImage';
import { Sparkline } from '../components/Sparkline';
import { CATEGORY_ICONS } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';
import { valueRange, type PriceBoardRow, type TrendPoint } from '../logic/valuation';

interface Props {
  lot: MaterialLot;
  row?: PriceBoardRow;
  trend: TrendPoint[];
  onSpeakPrice: () => void;
  onFindRecyclers: () => void;
  onBack: () => void;
}

export function Valuation({ lot, row, trend, onSpeakPrice, onFindRecyclers, onBack }: Props) {
  const { t, categoryName, formatNumber } = useI18n();
  const range = valueRange(lot.approxWeightKg, row);
  const change = row?.changePct ?? 0;

  return (
    <section className="screen valuation-screen flex flex-col gap-3 p-3">
      <div className="flex items-center gap-3">
        <BlobImage blob={lot.imageBlob} alt="" className="h-20 w-20 rounded object-cover" />
        <div>
          <div className="text-lg font-bold">
            {CATEGORY_ICONS[lot.category]} {categoryName(lot.category)}
          </div>
          <div>
            {formatNumber(lot.approxWeightKg, 1)} {t('kg')}
          </div>
        </div>
      </div>

      <div className="valuation-card rounded border p-4 text-center">
        <div className="text-sm">{t('estimatedValue')}</div>
        <div className="estimated-value text-5xl font-bold">₹{formatNumber(lot.estimatedValue)}</div>
        {row ? (
          <>
            <div className="mt-1">{t('pricePerKg', { price: formatNumber(row.pricePerUnit, 2) })}</div>
            <div className="text-sm">
              {t('marketRange', { low: formatNumber(row.marketRangeLow), high: formatNumber(row.marketRangeHigh) })}
            </div>
            <div className="text-sm">{t('expectRange', { low: formatNumber(range.low), high: formatNumber(range.high) })}</div>
          </>
        ) : (
          <div className="text-sm">{t('noPrice')}</div>
        )}
        <button type="button" className="btn btn-secondary mt-3 w-full py-3 text-lg" onClick={onSpeakPrice}>
          {t('speakPrice')}
        </button>
      </div>

      {trend.length > 1 && (
        <div className="price-trend flex items-center justify-between rounded border p-3">
          <div>
            <div className="text-sm">{t('priceTrend')}</div>
            <div className={change >= 0 ? 'trend-up' : 'trend-down'}>
              {change >= 0 ? '▲ ' : '▼ '}
              {t(change >= 0 ? 'trendUp' : 'trendDown', { pct: formatNumber(Math.abs(change), 1) })}
            </div>
          </div>
          <Sparkline points={trend} />
        </div>
      )}

      <button type="button" className="btn btn-primary w-full py-4 text-lg" onClick={onFindRecyclers}>
        {t('findRecyclers')} →
      </button>
      <button type="button" className="btn btn-link" onClick={onBack}>
        ← {t('back')}
      </button>
    </section>
  );
}
