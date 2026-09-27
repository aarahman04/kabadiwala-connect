import { Button } from './ui';
import { useI18n } from '../i18n/I18nProvider';
interface Props {
  value: number;
  onChange: (kg: number) => void;
  unitLabel: string;
  step?: number;
  min?: number;
  max?: number;
}

const round = (n: number) => Math.round(n * 10) / 10;

/** Big-button weight entry — no keyboard needed. */
export function WeightStepper({ value, onChange, unitLabel, step = 0.5, min = 0.5, max = 2000 }: Props) {
  const { t } = useI18n();
  const set = (n: number) => onChange(Math.min(max, Math.max(min, round(n))));
  return (
    <div className="weight-stepper">
      <div className="flex items-center justify-between gap-2">
        <Button type="button" className="btn stepper-btn px-6 py-3 text-3xl" aria-label="−" onClick={() => set(value - step)}>
          −
        </Button>
        <output className="weight-value text-4xl font-bold" aria-live="polite">
          {value} <span className="text-lg">{unitLabel}</span>
        </output>
        <Button type="button" className="btn stepper-btn px-6 py-3 text-3xl" aria-label="+" onClick={() => set(value + step)}>
          +
        </Button>
      </div>
      <div className="quick-add mt-3 flex justify-center gap-2">
        {[1, 5, 10, 25].map((n) => (
          <Button key={n} type="button" className="btn chip" onClick={() => set(value + n)}>
            +{n}
          </Button>
        ))}
        <Button type="button" className="btn chip" aria-label={t('resetWeight')} onClick={() => set(min)}>
          ↺
        </Button>
      </div>
    </div>
  );
}
