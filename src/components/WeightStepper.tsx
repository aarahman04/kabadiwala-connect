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
  const set = (n: number) => onChange(Math.min(max, Math.max(min, round(n))));
  return (
    <div className="weight-stepper">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="btn stepper-btn px-6 py-3 text-3xl" aria-label="−" onClick={() => set(value - step)}>
          −
        </button>
        <output className="weight-value text-4xl font-bold" aria-live="polite">
          {value} <span className="text-lg">{unitLabel}</span>
        </output>
        <button type="button" className="btn stepper-btn px-6 py-3 text-3xl" aria-label="+" onClick={() => set(value + step)}>
          +
        </button>
      </div>
      <div className="quick-add mt-3 flex justify-center gap-2">
        {[1, 5, 10, 25].map((n) => (
          <button key={n} type="button" className="btn chip" onClick={() => set(value + n)}>
            +{n}
          </button>
        ))}
        <button type="button" className="btn chip" aria-label="reset" onClick={() => set(min)}>
          ↺
        </button>
      </div>
    </div>
  );
}
