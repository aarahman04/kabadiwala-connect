import { Button, Icon, Banner, Stepper, StatusPill } from '../components/ui';
import { useRef, useState } from 'react';
import type {
  MaterialLot,
  PaymentStatus,
  PickupStatus,
  Recycler,
  TraceabilityRecord,
  Transaction,
} from '../data/models';
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
  pickupQueued: boolean; // request saved but not yet sent (offline)
  onRequestPickup: (contactPhone?: string) => Promise<void>;
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
        <PickupPanel {...props} recyclerName={recyclerName} />
        <p className="text-sm">{t('handoverWhenHere')}</p>
        <h3 className="font-bold">{t('handoverPhoto')}</h3>
        <PhotoInput photo={photo} onChange={setPhoto} takeLabel={t('takePhoto')} retakeLabel={t('retakePhoto')} />
        <p className="location-status text-sm">
          {!position ? t('gettingLocation') : position.approximate ? t('locationApprox') : t('locationOk')}
        </p>
        {error && <p className="text-red-700">{t('errorGeneric', { message: error })}</p>}
        <Button
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
          <Icon name={busy ? 'loading' : 'fingerprint'} />
          {busy ? '…' : t('createHandover')}
        </Button>
        <Button type="button" className="btn btn-link" onClick={props.onChangeRecycler}>
          <Icon name="back" /> {t('back')}
        </Button>
      </section>
    );
  }

  const confirmed = record.status === 'confirmed';
  const paid = isPaid(transaction.paymentStatus);

  return (
    <section className="screen handover-receipt flex flex-col gap-3 p-3">
      <div className="handover-code-card rounded border-2 p-4 text-center">
        <Icon name="fingerprint" className="receipt-seal" />
        <div className="text-sm">{t('handoverCode')}</div>
        <div className="handover-code font-mono text-5xl font-bold tracking-widest">
          <span className="code-prefix">{record.handoverReference.slice(0, 3)}</span>
          <span className="code-value">{record.handoverReference.slice(3)}</span>
        </div>
        <div className="mt-1 text-sm">{t('showCodeToRecycler')}</div>
        <Button
          type="button"
          className="btn btn-secondary mt-3 w-full py-3"
          onClick={() => props.onSpeakCode(record.handoverReference)}
        >
          <Icon name="audio" /> {t('speakCode')}
        </Button>
      </div>

      <div
        className={`confirmation-status rounded p-3 font-bold ${confirmed ? 'is-confirmed bg-green-100' : 'is-pending bg-yellow-100'}`}
      >
        {confirmed ? (
          <>
            <Icon name="shield" />{' '}
            {t('confirmedBy', {
              name: record.recyclerConfirmation?.confirmedBy ?? recyclerName,
            })}
          </>
        ) : (
          <>
            <Icon name="clock" /> {t('pendingConfirmation')}
          </>
        )}
        <div className="text-sm font-normal">
          {t('statusLabel')}:{' '}
          <StatusPill status={transaction.transactionStatus}>
            {TX_STATUS_NAMES[lang][transaction.transactionStatus]}
          </StatusPill>
          {paid && (
            <div className="paid-amount">
              <Icon name="cash" />
              {t('paid')} ₹{formatNumber(transaction.finalPrice ?? transaction.quotedPrice)}
            </div>
          )}
        </div>
      </div>
      {props.priceFlag && (
        <div className="anomaly-badge rounded bg-yellow-100 p-2 text-sm font-bold" role="alert">
          <Icon name="warning" />{' '}
          {t(FLAG_KEYS[props.priceFlag.reason], {
            pct: props.priceFlag.deviationPct,
          })}
        </div>
      )}
      {transaction.pickup && transaction.pickup.status !== 'completed' && !confirmed && (
        <p className={`pickup-status status-${transaction.pickup.status} font-bold`}>
          <StatusPill status={transaction.pickup.status}>{t(`pickup_${transaction.pickup.status}`)}</StatusPill>
        </p>
      )}
      {hasUnsyncedChanges && <Banner className="offline-note">{t('savedOffline')}</Banner>}

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
          <Button type="button" className="btn btn-primary flex-1 py-3" onClick={() => props.onMarkPaid('paid_cash')}>
            <Icon name="cash" /> {t('cashReceived')}
          </Button>
          <Button
            type="button"
            className="btn btn-secondary flex-1 py-3"
            onClick={() => props.onMarkPaid('paid_digital')}
          >
            <Icon name="digital" /> {t('digitalReceived')}
          </Button>
        </div>
      )}

      <p className="text-xs opacity-60">{lot.lotId}</p>
      <Button type="button" className="btn btn-link" onClick={props.onBack}>
        <Icon name="back" /> {t('navHome')}
      </Button>
    </section>
  );
}

/** Ask the recycler to come, then follow their progress; or drop off yourself. */
function PickupPanel(props: Props & { recyclerName: string }) {
  const { transaction, recycler, recyclerName, pickupQueued } = props;
  const { t, formatDateTime } = useI18n();
  const [phone, setPhone] = useState('');
  const sending = useRef(false);
  const pickup = transaction.pickup;
  const status: PickupStatus | undefined = pickup?.status;

  if (!recycler?.pickupAvailable) return <p className="pickup-panel text-sm">{t('pickupNotOffered')}</p>;

  if (!pickup || status === 'declined') {
    return (
      <div className="pickup-panel flex flex-col gap-2 rounded border p-3">
        {status === 'declined' && <StatusPill status="declined">{t('pickup_declined')}</StatusPill>}
        <label className="flex flex-col text-sm">
          {t('phoneOptional')}
          <input
            className="rounded border p-2 text-base"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
          />
        </label>
        <Button
          type="button"
          className="btn btn-primary w-full py-3 text-lg"
          onClick={async () => {
            if (sending.current) return;
            sending.current = true;
            try {
              await props.onRequestPickup(phone || undefined);
            } finally {
              sending.current = false;
            }
          }}
        >
          <Icon name="truck" /> {t('requestPickup')}
        </Button>
        <p className="text-sm">{t('dropOffSelf')}</p>
      </div>
    );
  }

  return (
    <div className={`pickup-panel pickup-${status} flex flex-col gap-2 rounded border p-3`}>
      <p className="pickup-status text-lg font-bold" aria-live="polite">
        <StatusPill status={status!}>{t(`pickup_${status!}`)}</StatusPill>
      </p>
      <Stepper
        className="pickup-steps"
        items={(['requested', 'accepted', 'on_the_way', 'arriving'] as const).map((s) => ({
          label: t(`pickup_${s}`),
          icon: s === 'on_the_way' ? 'truck' : s === 'arriving' ? 'location' : s === 'accepted' ? 'check' : 'clock',
          done: pickup.history.some((h) => h.status === s),
          detail: pickup.history.find((h) => h.status === s)
            ? formatDateTime(pickup.history.find((h) => h.status === s)!.at)
            : undefined,
        }))}
      />
      {pickupQueued && (
        <p className="text-sm">
          <Icon name="save" /> {t('pickupQueued')}
        </p>
      )}
      {status !== 'requested' && recycler.contact && (
        <a className="btn btn-secondary py-2 text-center" href={`tel:${recycler.contact.replace(/\s/g, '')}`}>
          <Icon name="phone" /> {t('callName', { name: recyclerName })}
        </a>
      )}
    </div>
  );
}
