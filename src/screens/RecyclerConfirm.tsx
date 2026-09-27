import { useState, type FormEvent } from 'react';
import type { ConfirmationPayload, MaterialCategory, PaymentStatus } from '../data/models';
import { BlobImage } from '../components/BlobImage';
import { CATEGORY_ICONS } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';

export interface HandoverLookup {
  reference: string;
  source: 'local' | 'server' | 'none';
  category?: MaterialCategory;
  weight?: number;
  quotedPrice?: number;
  timestamp?: number;
  photos?: Blob[];
  hashValid?: boolean;
  recyclerName?: string;
  alreadyConfirmed?: boolean;
}

interface Props {
  online: boolean;
  onLookup: (code: string) => Promise<HandoverLookup>;
  onConfirm: (confirmation: ConfirmationPayload) => Promise<'sent' | 'queued'>;
  onSwitchToCollector: () => void;
}

/** Recycler side (`?role=recycler`): enter the collector's code, verify, confirm. */
export function RecyclerConfirm({ online, onLookup, onConfirm, onSwitchToCollector }: Props) {
  const { t, categoryName, formatNumber, formatDateTime } = useI18n();
  const [code, setCode] = useState('');
  const [lookup, setLookup] = useState<HandoverLookup>();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [payment, setPayment] = useState<PaymentStatus>('paid_cash');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'sent' | 'queued'>();

  async function handleLookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(undefined);
    const found = await onLookup(code);
    setLookup(found);
    setName(found.recyclerName ?? name);
    setPrice(found.quotedPrice != null ? String(found.quotedPrice) : '');
    setBusy(false);
  }

  async function handleConfirm() {
    if (!lookup) return;
    setBusy(true);
    const finalPrice = Number(price);
    const outcome = await onConfirm({
      handoverReference: lookup.reference,
      confirmedBy: name.trim() || 'recycler',
      confirmedAt: Date.now(),
      finalPrice: Number.isFinite(finalPrice) && finalPrice > 0 ? finalPrice : undefined,
      paymentStatus: payment,
    });
    setResult(outcome);
    setBusy(false);
  }

  return (
    <section className="screen recycler-confirm-screen flex flex-col gap-3 p-3">
      <h2 className="text-xl font-bold">{t('recyclerMode')}</h2>
      <p className="text-sm">{online ? `🟢 ${t('online')}` : `🔴 ${t('offline')}`}</p>

      <form className="flex gap-2" onSubmit={handleLookup}>
        <label className="sr-only" htmlFor="handover-code">
          {t('enterCode')}
        </label>
        <input
          id="handover-code"
          className="code-input flex-1 rounded border p-3 font-mono text-2xl uppercase"
          placeholder="KC-XXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button type="submit" className="btn btn-primary px-4" disabled={busy || code.trim().length < 4}>
          {t('lookUp')}
        </button>
      </form>

      {lookup && (
        <div className="lookup-result flex flex-col gap-2 rounded border p-3">
          <div className="font-mono text-2xl font-bold">{lookup.reference}</div>
          {lookup.source === 'none' ? (
            <p className="text-sm">{t('codeNotFound')}</p>
          ) : (
            <>
              {lookup.category && (
                <div className="text-lg">
                  {CATEGORY_ICONS[lookup.category]} {categoryName(lookup.category)} · {formatNumber(lookup.weight ?? 0, 1)} {t('kg')}
                </div>
              )}
              {lookup.timestamp && <div className="text-sm">{formatDateTime(lookup.timestamp)}</div>}
              {lookup.hashValid != null && (
                <div className={`hash-check font-bold ${lookup.hashValid ? 'is-valid' : 'is-invalid text-red-700'}`}>
                  {lookup.hashValid ? t('hashValid') : t('hashInvalid')}
                </div>
              )}
              {lookup.photos && (
                <div className="flex gap-2">
                  {lookup.photos.map((b, i) => (
                    <BlobImage key={i} blob={b} alt="" className="h-20 w-20 rounded object-cover" />
                  ))}
                </div>
              )}
            </>
          )}

          {lookup.alreadyConfirmed ? (
            <p className="font-bold">✅ {t('confirmationSent')}</p>
          ) : result ? (
            <p className="confirm-result font-bold">{result === 'sent' ? t('confirmationSent') : `💾 ${t('confirmationQueued')}`}</p>
          ) : (
            <>
              <label className="flex flex-col text-sm">
                {t('recyclerName')}
                <input className="rounded border p-2 text-base" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="flex flex-col text-sm">
                {t('finalPrice')}
                <input
                  className="rounded border p-2 text-base"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
                />
              </label>
              <fieldset className="flex flex-wrap gap-3 text-sm">
                <legend>{t('paymentMethod')}</legend>
                {(
                  [
                    ['paid_cash', t('payCash')],
                    ['paid_digital', t('payDigital')],
                    ['pending', t('payLater')],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1">
                    <input type="radio" name="payment" checked={payment === value} onChange={() => setPayment(value)} />
                    {label}
                  </label>
                ))}
              </fieldset>
              <button type="button" className="btn btn-primary w-full py-3 text-lg" disabled={busy} onClick={handleConfirm}>
                {t('confirmHandover')}
              </button>
            </>
          )}
        </div>
      )}

      <button type="button" className="btn btn-link" onClick={onSwitchToCollector}>
        {t('switchToCollector')}
      </button>
    </section>
  );
}
