import { Button, Icon } from './ui';
import { useI18n } from '../i18n/I18nProvider';
import { useRef, useState, type ChangeEvent } from 'react';
import { compressImage } from '../utils/image';
import { BlobImage } from './BlobImage';

interface Props {
  photo?: Blob;
  onChange: (photo: Blob) => void;
  takeLabel: string;
  retakeLabel: string;
}

/** Native camera capture — `capture="environment"` opens the rear camera on phones. */
export function PhotoInput({ photo, onChange, takeLabel, retakeLabel }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    onChange(await compressImage(file));
    setBusy(false);
  }

  return (
    <div className="photo-input flex flex-col gap-2">
      {!photo && (
        <div className="photo-guide">
          <Icon name="camera" />
          <p>{t('photoHint')}</p>
        </div>
      )}
      {photo && <BlobImage blob={photo} alt="" className="photo-preview w-full rounded" />}
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={handle} />
      <Button
        type="button"
        icon="camera"
        loading={busy}
        className="btn btn-primary w-full"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? '…' : photo ? retakeLabel : takeLabel}
      </Button>
    </div>
  );
}
