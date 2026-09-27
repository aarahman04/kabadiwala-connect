import { useEffect, useRef, useState } from 'react';
import type { MaterialCategory, Recycler } from '../data/models';
import { MATERIAL_CATEGORIES } from '../data/models';
import type { IncomingHandover, PickupInboxItem } from '../data/recyclerLookup';
import { CATEGORY_ICONS } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  recyclers: Recycler[]; // authorized facilities to choose from
  recyclerId?: string;
  onSelectRecycler: (recyclerId: string) => void;
  requests: PickupInboxItem[] | null | undefined; // open pickup requests; null = offline, undefined = loading
  onUpdatePickup: (transactionId: string, status: 'accepted' | 'declined' | 'on_the_way' | 'arriving') => Promise<void>;
  incoming: IncomingHandover[] | null | undefined; // null = unavailable (offline), undefined = loading
  onRefreshIncoming: () => void;
  onPickHandover: (reference: string) => void;
  onSaveRates: (rates: Partial<Record<MaterialCategory, number>>) => Promise<void>;
  sharedServer: boolean;
  datasetLinks: { name: string; url: string }[];
}

/** Recycler-side home: who am I, what's coming to me, what I pay. */
export function RecyclerDesk(props: Props) {
  const { recyclers, recyclerId, incoming } = props;
  const { t, categoryName, formatNumber, formatDateTime } = useI18n();
  const me = recyclers.find((r) => r.recyclerId === recyclerId);

  return (
    <section className="screen recycler-desk flex flex-col gap-3 p-3">
      <p className="server-mode text-xs opacity-70">{props.sharedServer ? `🌐 ${t('serverShared')}` : `💻 ${t('serverLocal')}`}</p>

      <label className="flex flex-col text-sm">
        {t('facility')}
        <select
          className="rounded border p-2 text-base"
          value={recyclerId ?? ''}
          onChange={(e) => e.target.value && props.onSelectRecycler(e.target.value)}
        >
          <option value="">{t('chooseFacility')}</option>
          {recyclers.map((r) => (
            <option key={r.recyclerId} value={r.recyclerId}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {me && (
        <>
          <PickupInbox requests={props.requests} onUpdate={props.onUpdatePickup} />

          <div className="incoming flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{t('incoming')}</h3>
              <button type="button" className="btn chip" onClick={props.onRefreshIncoming}>
                ↻ {t('refresh')}
              </button>
            </div>
            {incoming === null && <p className="text-sm">{t('incomingNeedsServer')}</p>}
            {incoming?.length === 0 && <p className="text-sm">{t('noIncoming')}</p>}
            <ul className="flex flex-col gap-2">
              {incoming?.map((h) => (
                <li key={h.reference}>
                  <button
                    type="button"
                    className="incoming-card flex w-full items-center gap-2 rounded border p-2 text-left"
                    onClick={() => props.onPickHandover(h.reference)}
                  >
                    {h.thumbnail && <img src={h.thumbnail} alt="" className="h-12 w-12 rounded object-cover" />}
                    <div className="flex-1">
                      <div className="font-mono font-bold">{h.reference}</div>
                      <div className="text-sm">
                        {h.category && `${CATEGORY_ICONS[h.category]} ${categoryName(h.category)} · `}
                        {formatNumber(h.weight, 1)} {t('kg')}
                        {h.quotedPrice != null && ` · ₹${formatNumber(h.quotedPrice)}`}
                      </div>
                      <div className="text-xs opacity-70">{formatDateTime(h.timestamp)}</div>
                    </div>
                    <span className="text-lg">{h.confirmed ? '✅' : '⏳'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <RateEditor key={me.recyclerId} recycler={me} onSave={props.onSaveRates} />
        </>
      )}

      {props.datasetLinks.length > 0 && (
        <details className="datasets text-sm">
          <summary>{t('datasets')}</summary>
          <ul className="mt-1 flex flex-wrap gap-2">
            {props.datasetLinks.map((d) => (
              <li key={d.name}>
                <a className="underline" href={d.url} target="_blank" rel="noreferrer">
                  {d.name}.csv
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function RateEditor({ recycler, onSave }: { recycler: Recycler; onSave: Props['onSaveRates'] }) {
  const { t, categoryName } = useI18n();
  const [draft, setDraft] = useState<Partial<Record<MaterialCategory, string>>>(() =>
    Object.fromEntries(Object.entries(recycler.offeredRates).map(([c, v]) => [c, String(v)])),
  );
  const [saved, setSaved] = useState(false);
  const saving = useRef(false);

  useEffect(() => setSaved(false), [draft]);

  async function save() {
    if (saving.current) return;
    saving.current = true;
    const changed: Partial<Record<MaterialCategory, number>> = {};
    for (const c of MATERIAL_CATEGORIES) {
      const n = Number(draft[c]);
      if (draft[c] && n > 0 && n !== recycler.offeredRates[c]) changed[c] = n;
    }
    if (Object.keys(changed).length) await onSave(changed);
    setSaved(true);
    saving.current = false;
  }

  return (
    <details className="rate-editor rounded border p-2">
      <summary className="font-bold">{t('myRates')}</summary>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {MATERIAL_CATEGORIES.map((c) => (
          <label key={c} className="flex flex-col text-xs">
            {CATEGORY_ICONS[c]} {categoryName(c)}
            <input
              className="rounded border p-1 text-base"
              inputMode="decimal"
              value={draft[c] ?? ''}
              placeholder="—"
              onChange={(e) => setDraft({ ...draft, [c]: e.target.value.replace(/[^\d.]/g, '') })}
            />
          </label>
        ))}
      </div>
      <button type="button" className="btn btn-primary mt-2 w-full py-2" onClick={() => void save()}>
        {t('saveRates')}
      </button>
      {saved && <p className="mt-1 text-sm">✅ {t('ratesSaved')}</p>}
    </details>
  );
}

function PickupInbox({ requests, onUpdate }: { requests: Props['requests']; onUpdate: Props['onUpdatePickup'] }) {
  const { t, categoryName, formatNumber, formatDateTime } = useI18n();
  const busy = useRef(false);
  const act = async (id: string, status: Parameters<Props['onUpdatePickup']>[1]) => {
    if (busy.current) return; // one tap = one update
    busy.current = true;
    try {
      await onUpdate(id, status);
    } finally {
      busy.current = false;
    }
  };

  return (
    <div className="pickup-inbox flex flex-col gap-2">
      <h3 className="font-bold">
        🚚 {t('pickupRequests')} {requests && requests.length > 0 && `(${requests.length})`}
      </h3>
      {requests === null && <p className="text-sm">{t('incomingNeedsServer')}</p>}
      {requests?.length === 0 && <p className="text-sm">{t('noRequests')}</p>}
      {requests?.map((r) => (
        <article key={r.transactionId} className={`pickup-request status-${r.status} rounded border p-2`}>
          <div className="flex items-center gap-2">
            {r.thumbnail && <img src={r.thumbnail} alt="" className="h-14 w-14 rounded object-cover" />}
            <div className="flex-1">
              <div className="font-bold">
                {r.category && `${CATEGORY_ICONS[r.category]} `}
                {t('requestSummary', {
                  category: r.category ? categoryName(r.category) : '—',
                  weight: formatNumber(r.weight ?? 0, 1),
                  amount: formatNumber(r.quotedPrice),
                })}
              </div>
              <div className="text-xs opacity-70">{formatDateTime(r.requestedAt)}</div>
              <div className="text-sm">{t(`pickup_${r.status}`)}</div>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <a
              className="btn chip"
              href={`https://www.google.com/maps/search/?api=1&query=${r.location.lat},${r.location.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              {t('openMap')}
            </a>
            {r.contactPhone && (
              <a className="btn chip" href={`tel:${r.contactPhone.replace(/\s/g, '')}`}>
                {t('callCollector')}
              </a>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            {r.status === 'requested' && (
              <>
                <button type="button" className="btn btn-primary flex-1 py-2" onClick={() => void act(r.transactionId, 'accepted')}>
                  {t('accept')}
                </button>
                <button type="button" className="btn flex-1 py-2" onClick={() => void act(r.transactionId, 'declined')}>
                  {t('decline')}
                </button>
              </>
            )}
            {r.status === 'accepted' && (
              <button type="button" className="btn btn-primary flex-1 py-2" onClick={() => void act(r.transactionId, 'on_the_way')}>
                {t('onMyWay')}
              </button>
            )}
            {r.status === 'on_the_way' && (
              <button type="button" className="btn btn-primary flex-1 py-2" onClick={() => void act(r.transactionId, 'arriving')}>
                {t('arrivingSoon')}
              </button>
            )}
          </div>
          {r.status === 'arriving' && <p className="mt-1 text-sm">{t('verifyAtPickup')}</p>}
        </article>
      ))}
    </div>
  );
}
