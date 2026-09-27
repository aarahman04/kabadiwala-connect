import type { MaterialLot } from '../data/models';
import { BlobImage } from '../components/BlobImage';
import { CATEGORY_ICONS, LOT_STATUS_NAMES } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  lots: MaterialLot[];
  onOpenLot: (lotId: string) => void;
  onNewLot: () => void;
}

export function Home({ lots, onOpenLot, onNewLot }: Props) {
  const { t, lang, categoryName, formatNumber, formatDateTime } = useI18n();
  return (
    <section className="screen home-screen flex flex-col gap-3 p-3">
      <button type="button" className="btn btn-primary w-full py-4 text-xl" onClick={onNewLot}>
        ➕ {t('newLot')}
      </button>
      <h2 className="text-lg font-bold">{t('myLots')}</h2>
      {lots.length === 0 && <p className="empty-state">{t('noLots')}</p>}
      <ul className="lot-list flex flex-col gap-2">
        {lots.map((lot) => (
          <li key={lot.lotId}>
            <button
              type="button"
              className="lot-card flex w-full items-center gap-3 rounded border p-2 text-left"
              onClick={() => onOpenLot(lot.lotId)}
            >
              <BlobImage blob={lot.imageBlob} alt="" className="lot-thumb h-14 w-14 rounded object-cover" />
              <div className="flex-1">
                <div className="font-bold">
                  {CATEGORY_ICONS[lot.category]} {categoryName(lot.category)} · {formatNumber(lot.approxWeightKg, 1)}{' '}
                  {t('kg')}
                </div>
                <div className="text-sm">₹{formatNumber(lot.estimatedValue)} · {formatDateTime(lot.createdAt)}</div>
              </div>
              <span className={`status-badge status-${lot.status} text-xs`}>{LOT_STATUS_NAMES[lang][lot.status]}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
