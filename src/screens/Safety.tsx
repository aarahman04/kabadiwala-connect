import type { SafetyCard } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  cards: SafetyCard[];
  onSpeak: (text: string) => void;
}

export function Safety({ cards, onSpeak }: Props) {
  const { t } = useI18n();
  return (
    <section className="screen safety-screen flex flex-col gap-3 p-3">
      <h2 className="text-xl font-bold">{t('safetyTitle')}</h2>
      {cards.map((card) => (
        <article key={card.title} className="safety-card rounded border p-3">
          <div className="flex items-center gap-3">
            <span className="safety-icon text-5xl" aria-hidden="true">
              {card.icon}
            </span>
            <h3 className="text-lg font-bold">{card.title}</h3>
          </div>
          <p className="mt-2">{card.body}</p>
          <button
            type="button"
            className="btn btn-secondary mt-2 w-full py-2"
            onClick={() => onSpeak(`${card.title}. ${card.body}`)}
          >
            {t('hearThis')}
          </button>
        </article>
      ))}
    </section>
  );
}
