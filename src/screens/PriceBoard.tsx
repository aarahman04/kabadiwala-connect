import type { MaterialCategory, PriceEntry } from '../data/models';
import { MATERIAL_CATEGORIES } from '../data/models';
import { Sparkline } from '../components/Sparkline';
import { CATEGORY_ICONS } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';
import { priceTrend, type PriceBoard as Board } from '../logic/valuation';

interface Props {
  board: Board;
  prices: PriceEntry[];
  onSpeak: (category: MaterialCategory) => void;
}

/** Transparent price board — every category, market band and 60-day trend. */
export function PriceBoard({ board, prices, onSpeak }: Props) {
  const { t, categoryName, formatNumber } = useI18n();
  return (
    <section className="screen price-board-screen flex flex-col gap-2 p-3">
      <h2 className="text-xl font-bold">{t('navPrices')}</h2>
      {MATERIAL_CATEGORIES.map((c) => {
        const row = board[c];
        if (!row) return null;
        return (
          <button
            key={c}
            type="button"
            className="price-row flex items-center justify-between gap-2 rounded border p-2 text-left"
            onClick={() => onSpeak(c)}
          >
            <div>
              <div className="font-bold">
                {CATEGORY_ICONS[c]} {categoryName(c)}
              </div>
              <div className="text-lg">{t('pricePerKg', { price: formatNumber(row.pricePerUnit, 2) })}</div>
              <div className="text-xs">
                {t('marketRange', { low: formatNumber(row.marketRangeLow), high: formatNumber(row.marketRangeHigh) })}
              </div>
            </div>
            <div className="flex flex-col items-end">
              <Sparkline points={priceTrend(prices, c)} width={100} height={30} />
              <span className="text-xs">
                {row.changePct >= 0 ? '▲' : '▼'} {formatNumber(Math.abs(row.changePct), 1)}%
              </span>
            </div>
          </button>
        );
      })}
    </section>
  );
}
