import { useState } from 'react';
import type { MaterialLot, PaymentStatus, Recycler, TraceabilityRecord, Transaction } from '../data/models';
import { BlobImage } from '../components/BlobImage';
import { PhotoInput } from '../components/PhotoInput';
import { TX_STATUS_NAMES } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';
import { isPaid } from '../logic/sync';
import type { PositionResult } from '../utils/geolocation';
import { FLAG_KEYS, type PriceFlag } from './RecyclerConfirm';

interface Props {
  lot: MaterialLot;
  recycler?: Recycler;
  transaction: Transaction;
  record?: TraceabilityRecord;
  position: PositionResult | null; // null while locating
  hasUnsyncedChanges: boolean;
  priceFlag?: PriceFlag | null; // abnormal final price vs market / quote
  onCreate: (photo: Blob) => Promise<void>;
  onSpeakCode: (code: string) => void;
  onMarkPaid: (method: Exclude<PaymentStatus, 'pending'>) => void;
  onChangeRecycler: () => void;
  onBack: () => void;
}

export function Handover(props: Props) {
  const { lot, recycler, transaction, record, position, hasUnsyncedChanges } = props;
  const { t, lang, formatNumber, formatDateTime } = useI18n();
  const [photo, setPhoto] = useState<Blob>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const recyclerName = recycler?.name ?? transaction.recyclerId;

  if (!record) {
    return (
      <section className="screen handover-screen flex flex-col gap-3 p-3">
        <h2 className="text-xl font-bold">{t('handoverTitle', { name: recyclerName })}</h2>
        <p className="text-lg">≈ ₹{formatNumber(transaction.quotedPrice)}</p>
        <h3 className="font-bold">{t('handoverPhoto')}</h3>
        <PhotoInput photo={photo} onChange={setPhoto} takeLabel={t('takePhoto')} retakeLabel={t('retakePhoto')} />
        <p className="location-status text-sm">
          {!position ? t('gettingLocation') : position.approximate ? t('locationApprox') : t('locationOk')}
        </p>
        {error && <p className="text-red-700">{t('errorGeneric', { message: error })}</p>}
        <button
          type="button"
          className="btn btn-primary w-full py-4 text-lg"
          disabled={!photo || !position || busy}
          onClick={async () => {
            if (!photo) return;
            setBusy(true);
            setError(undefined);
            try {
              await props.onCreate(photo);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? '…' : t('createHandover')}
        </button>
        <button type="button" className="btn btn-link" onClick={props.onChangeRecycler}>
          ← {t('back')}
        </button>
      </section>
    );
  }

  const confirmed = record.status === 'confirmed';
  const paid = isPaid(transaction.paymentStatus);

  return (
    <section className="screen handover-receipt flex flex-col gap-3 p-3">
      <div className="handover-code-card rounded border-2 p-4 text-center">
        <div className="text-sm">{t('handoverCode')}</div>
        <div className="handover-code font-mono text-5xl font-bold tracking-widest">{record.handoverReference}</div>
        <div className="mt-1 text-sm">{t('showCodeToRecycler')}</div>
        <button
          type="button"
          className="btn btn-secondary mt-3 w-full py-3"
          onClick={() => props.onSpeakCode(record.handoverReference)}
        >
          {t('speakCode')}
        </button>
      </div>

      <div className={`confirmation-status rounded p-3 font-bold ${confirmed ? 'is-confirmed bg-green-100' : 'is-pending bg-yellow-100'}`}>
        {confirmed
          ? `✅ ${t('confirmedBy', { name: record.recyclerConfirmation?.confirmedBy ?? recyclerName })}`
          : `⏳ ${t('pendingConfirmation')}`}
        <div className="text-sm font-normal">
          {t('statusLabel')}: {TX_STATUS_NAMES[lang][transaction.transactionStatus]}
          {paid && ` · ${t('paid')} ₹${formatNumber(transaction.finalPrice ?? transaction.quotedPrice)}`}
        </div>
      </div>
      {props.priceFlag && (
        <div className="anomaly-badge rounded bg-yellow-100 p-2 text-sm font-bold" role="alert">
          {t(FLAG_KEYS[props.priceFlag.reason], { pct: props.priceFlag.deviationPct })}
        </div>
      )}
      {hasUnsyncedChanges && <p className="offline-note text-sm">💾 {t('savedOffline')}</p>}

      <dl className="record-details grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt>{t('weight')}</dt>
        <dd>
          {formatNumber(record.weight, 1)} {t('kg')}
        </dd>
        <dt>{t('time')}</dt>
        <dd>{formatDateTime(record.timestamp)}</dd>
        <dt>{t('location')}</dt>
        <dd>
          {record.location.lat.toFixed(5)}, {record.location.lng.toFixed(5)}
          {record.locationApproximate && ' (≈)'}
        </dd>
        <dt>{t('hash')}</dt>
        <dd className="break-all font-mono text-xs">{record.handoverHash}</dd>
      </dl>

      <div className="record-photos flex gap-2">
        {record.photoBlobs.map((b, i) => (
          <BlobImage key={i} blob={b} alt="" className="h-24 w-24 rounded object-cover" />
        ))}
      </div>

      {!paid && (
        <div className="payment-actions flex gap-2">
          <button type="button" className="btn btn-primary flex-1 py-3" onClick={() => props.onMarkPaid('paid_cash')}>
            {t('cashReceived')}
          </button>
          <button type="button" className="btn btn-secondary flex-1 py-3" onClick={() => props.onMarkPaid('paid_digital')}>
            {t('digitalReceived')}
          </button>
        </div>
      )}

      <p className="text-xs opacity-60">
        {lot.lotId}
      </p>
      <button type="button" className="btn btn-link" onClick={props.onBack}>
        ← {t('navHome')}
      </button>
    </section>
  );
}
