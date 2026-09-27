import { useState } from 'react';
import type { MaterialCategory } from '../data/models';
import { CategoryGrid } from '../components/CategoryGrid';
import { PhotoInput } from '../components/PhotoInput';
import { WeightStepper } from '../components/WeightStepper';
import { placeholderImage } from '../data/seed';
import { CATEGORY_ICONS } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';
import type { PriceBoard } from '../logic/valuation';
import { valueLot } from '../logic/valuation';

export interface NewLotResult {
  imageBlob: Blob;
  category: MaterialCategory;
  approxWeightKg: number;
  condition?: LotCondition;
  sourceType?: LotSource;
}

export const LOT_CONDITIONS = ['working', 'broken', 'dismantled'] as const;
export const LOT_SOURCES = ['household', 'shop', 'office', 'street'] as const;
export type LotCondition = (typeof LOT_CONDITIONS)[number];
export type LotSource = (typeof LOT_SOURCES)[number];

interface Props {
  board: PriceBoard;
  onComplete: (result: NewLotResult) => void;
  onCancel: () => void;
}

type Step = 'photo' | 'category' | 'weight';

/**
 * photo → category → weight. The category step is where an on-device image
 * classifier would pre-select a tile; today the collector picks it.
 */
export function NewLot({ board, onComplete, onCancel }: Props) {
  const { t, categoryName, formatNumber } = useI18n();
  const [step, setStep] = useState<Step>('photo');
  const [photo, setPhoto] = useState<Blob>();
  const [category, setCategory] = useState<MaterialCategory>();
  const [weight, setWeight] = useState(5);
  const [condition, setCondition] = useState<LotCondition>();
  const [source, setSource] = useState<LotSource>();
  const [submitting, setSubmitting] = useState(false);

  const back = () => (step === 'photo' ? onCancel() : setStep(step === 'weight' ? 'category' : 'photo'));

  return (
    <section className="screen new-lot-screen flex flex-col gap-3 p-3">
      <div className="step-indicator text-sm">{['photo', 'category', 'weight'].indexOf(step) + 1} / 3</div>

      {step === 'photo' && (
        <>
          <h2 className="text-xl font-bold">{t('step1Photo')}</h2>
          <PhotoInput photo={photo} onChange={setPhoto} takeLabel={t('takePhoto')} retakeLabel={t('retakePhoto')} />
          {photo ? (
            <button type="button" className="btn btn-primary w-full py-3" onClick={() => setStep('category')}>
              {t('continue')} →
            </button>
          ) : (
            <button type="button" className="btn btn-link" onClick={() => setStep('category')}>
              {t('skipPhoto')}
            </button>
          )}
        </>
      )}

      {step === 'category' && (
        <>
          <h2 className="text-xl font-bold">{t('step2Category')}</h2>
          <CategoryGrid
            selected={category}
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
            {CATEGORY_ICONS[category]} {t('step3Weight')}
          </h2>
          <WeightStepper value={weight} onChange={setWeight} unitLabel={t('kg')} />
          {/* Optional, one tap each — feeds the Material dataset's condition / source type. */}
          <ChipRow
            label={t('conditionLabel')}
            options={LOT_CONDITIONS}
            selected={condition}
            onSelect={setCondition}
            render={(c) => `${LOT_ICONS[c]} ${t(`condition_${c}`)}`}
          />
          <ChipRow
            label={t('sourceLabel')}
            options={LOT_SOURCES}
            selected={source}
            onSelect={setSource}
            render={(c) => `${LOT_ICONS[c]} ${t(`source_${c}`)}`}
          />
          {board[category] && (
            <p className="live-estimate text-center text-lg">≈ ₹{formatNumber(valueLot(weight, board[category]))}</p>
          )}
          <button
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
              });
            }}
          >
            {t('estimatedValue')} →
          </button>
        </>
      )}

      <button type="button" className="btn btn-link" onClick={back}>
        ← {step === 'photo' ? t('cancel') : t('back')}
      </button>
    </section>
  );
}

const LOT_ICONS: Record<LotCondition | LotSource, string> = {
  working: '✅',
  broken: '💔',
  dismantled: '🔧',
  household: '🏠',
  shop: '🏪',
  office: '🏢',
  street: '🛣️',
};

function ChipRow<T extends string>(props: {
  label: string;
  options: readonly T[];
  selected?: T;
  onSelect: (v: T | undefined) => void;
  render: (v: T) => string;
}) {
  return (
    <fieldset className="chip-row flex flex-wrap items-center gap-2">
      <legend className="text-sm">{props.label}</legend>
      {props.options.map((o) => (
        <button
          key={o}
          type="button"
          className={`btn chip ${props.selected === o ? 'is-selected ring-2' : ''}`}
          aria-pressed={props.selected === o}
          onClick={() => props.onSelect(props.selected === o ? undefined : o)}
        >
          {props.render(o)}
        </button>
      ))}
    </fieldset>
  );
}
