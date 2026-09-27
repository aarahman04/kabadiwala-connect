import { Button, Icon, Stepper, Skeleton } from '../components/ui';
import type { IconName } from '../components/ui/Icon';
import { CategoryIcon } from '../components/ui/CategoryIcon';
import { useEffect, useRef, useState } from 'react';
import type { MaterialCategory } from '../data/models';
import { CategoryGrid } from '../components/CategoryGrid';
import { PhotoInput } from '../components/PhotoInput';
import { WeightStepper } from '../components/WeightStepper';
import { placeholderImage } from '../data/seed';
import { CATEGORY_ICONS } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';
import type { PriceBoard } from '../logic/valuation';
import { valueLot } from '../logic/valuation';
import type { PhotoSuggestion } from '../services/classifier';

export interface NewLotResult {
  imageBlob: Blob;
  category: MaterialCategory;
  approxWeightKg: number;
  condition?: LotCondition;
  sourceType?: LotSource;
  aiSuggestion?: PhotoSuggestion;
}

export const LOT_CONDITIONS = ['working', 'broken', 'dismantled'] as const;
export const LOT_SOURCES = ['household', 'shop', 'office', 'street'] as const;
export type LotCondition = (typeof LOT_CONDITIONS)[number];
export type LotSource = (typeof LOT_SOURCES)[number];

interface Props {
  board: PriceBoard;
  /** Optional photo classifier; resolves null when unavailable (offline etc.). */
  onClassify?: (photo: Blob) => Promise<PhotoSuggestion | null>;
  onComplete: (result: NewLotResult) => void;
  onCancel: () => void;
}

type Step = 'photo' | 'category' | 'weight';

/**
 * photo → category → weight. The category step is where an on-device image
 * classifier would pre-select a tile; today the collector picks it.
 */
export function NewLot({ board, onClassify, onComplete, onCancel }: Props) {
  const { t, categoryName, formatNumber } = useI18n();
  const [step, setStep] = useState<Step>('photo');
  const [photo, setPhoto] = useState<Blob>();
  const [suggestion, setSuggestion] = useState<PhotoSuggestion | null>();
  const [classifying, setClassifying] = useState(false);
  const latestPhoto = useRef<Blob>();

  // Classify each new photo in the background while the collector continues.
  useEffect(() => {
    latestPhoto.current = photo;
    setSuggestion(undefined);
    if (!photo || !onClassify) return;
    setClassifying(true);
    void onClassify(photo).then((s) => {
      if (latestPhoto.current !== photo) return; // a newer photo replaced it
      setSuggestion(s);
      setClassifying(false);
    });
  }, [photo, onClassify]);
  const [category, setCategory] = useState<MaterialCategory>();
  const [weight, setWeight] = useState(5);
  const [condition, setCondition] = useState<LotCondition>();
  const [source, setSource] = useState<LotSource>();
  const [submitting, setSubmitting] = useState(false);

  const back = () => (step === 'photo' ? onCancel() : setStep(step === 'weight' ? 'category' : 'photo'));

  return (
    <section className="screen new-lot-screen flex flex-col gap-3 p-3">
      <Stepper
        className="step-indicator"
        current={['photo', 'category', 'weight'].indexOf(step)}
        items={[
          { label: t('stepPhoto'), icon: 'camera' },
          { label: t('stepMaterial'), icon: 'package' },
          { label: t('stepWeight'), icon: 'rupee' },
        ]}
      />

      {step === 'photo' && (
        <>
          <h2 className="text-xl font-bold">{t('step1Photo')}</h2>
          <PhotoInput photo={photo} onChange={setPhoto} takeLabel={t('takePhoto')} retakeLabel={t('retakePhoto')} />
          {photo ? (
            <Button type="button" className="btn btn-primary w-full py-3" onClick={() => setStep('category')}>
              {t('continue')} <Icon name="next" />
            </Button>
          ) : (
            <Button type="button" className="btn btn-link" onClick={() => setStep('category')}>
              {t('skipPhoto')}
            </Button>
          )}
        </>
      )}

      {step === 'category' && (
        <>
          <h2 className="text-xl font-bold">{t('step2Category')}</h2>
          {classifying && (
            <div className="ai-status" role="status">
              <Icon name="sparkle" />
              {t('aiIdentifying')}
              <Skeleton />
            </div>
          )}
          {suggestion?.verdict === 'match' && suggestion.category && (
            <div className="ai-suggestion rounded border-2 p-3">
              <p className="font-bold">
                {t('aiLooksLike', {
                  category: categoryName(suggestion.category),
                  pct: formatNumber(suggestion.confidence * 100),
                })}
              </p>
              <Button
                type="button"
                className="btn btn-primary mt-2 w-full py-3 text-lg"
                onClick={() => {
                  setCategory(suggestion.category);
                  setStep('weight');
                }}
              >
                <Icon name="check" /> {t('aiConfirm')}
              </Button>
            </div>
          )}
          {suggestion?.verdict === 'unsure' && <p className="ai-suggestion text-sm">{t('aiUnsure')}</p>}
          {suggestion?.verdict === 'not_ewaste' && (
            <p className="ai-suggestion text-sm font-bold">{t('aiNotEwaste')}</p>
          )}
          <CategoryGrid
            selected={category ?? (suggestion?.verdict === 'match' ? suggestion.category : undefined)}
            nameOf={categoryName}
            onSelect={(c) => {
              setCategory(c);
              setStep('weight');
            }}
          />
        </>
      )}

      {step === 'weight' && category && (
        <>
          <h2 className="text-xl font-bold">
            <CategoryIcon category={category} /> {t('step3Weight')}
          </h2>
          <WeightStepper value={weight} onChange={setWeight} unitLabel={t('kg')} />
          {/* Optional, one tap each — feeds the Material dataset's condition / source type. */}
          <ChipRow
            label={t('conditionLabel')}
            options={LOT_CONDITIONS}
            selected={condition}
            onSelect={setCondition}
            render={(c) => (
              <>
                <Icon name={LOT_ICONS[c]} />
                {t(`condition_${c}`)}
              </>
            )}
          />
          <ChipRow
            label={t('sourceLabel')}
            options={LOT_SOURCES}
            selected={source}
            onSelect={setSource}
            render={(c) => (
              <>
                <Icon name={LOT_ICONS[c]} />
                {t(`source_${c}`)}
              </>
            )}
          />
          {board[category] && (
            <p className="live-estimate text-center text-lg">≈ ₹{formatNumber(valueLot(weight, board[category]))}</p>
          )}
          <Button
            type="button"
            className="btn btn-primary w-full py-3 text-lg"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true);
              onComplete({
                imageBlob: photo ?? placeholderImage(CATEGORY_ICONS[category]),
                category,
                approxWeightKg: weight,
                condition,
                sourceType: source,
                aiSuggestion: suggestion ?? undefined,
              });
            }}
          >
            <Icon name="rupee" /> {t('estimatedValue')} <Icon name="next" />
          </Button>
        </>
      )}

      <Button type="button" className="btn btn-link" onClick={back}>
        <Icon name="back" /> {step === 'photo' ? t('cancel') : t('back')}
      </Button>
    </section>
  );
}

const LOT_ICONS: Record<LotCondition | LotSource, IconName> = {
  working: 'check',
  broken: 'close',
  dismantled: 'tools',
  household: 'home',
  shop: 'shop',
  office: 'building',
  street: 'location',
};

function ChipRow<T extends string>(props: {
  label: string;
  options: readonly T[];
  selected?: T;
  onSelect: (v: T | undefined) => void;
  render: (v: T) => React.ReactNode;
}) {
  return (
    <fieldset className="chip-row flex flex-wrap items-center gap-2">
      <legend className="text-sm">{props.label}</legend>
      {props.options.map((o) => (
        <Button
          key={o}
          type="button"
          className={`btn chip ${props.selected === o ? 'is-selected ring-2' : ''}`}
          aria-pressed={props.selected === o}
          onClick={() => props.onSelect(props.selected === o ? undefined : o)}
        >
          {props.render(o)}
        </Button>
      ))}
    </fieldset>
  );
}
