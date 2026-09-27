import type { Language } from '../data/models';
import { LANGUAGE_NAMES } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';

export type AppRole = 'collector' | 'recycler';

interface Props {
  onChoose: (role: AppRole) => void;
}

/** First launch: pick language, then which side of the app you are. */
export function RoleChooser({ onChoose }: Props) {
  const { t, lang, setLang } = useI18n();
  return (
    <section className="screen role-chooser flex min-h-screen flex-col justify-center gap-4 p-4">
      <div className="language-toggle flex justify-center gap-2" role="group" aria-label={t('language')}>
        {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
          <button
            key={l}
            type="button"
            className={`btn chip ${l === lang ? 'is-selected font-bold underline' : ''}`}
            aria-pressed={l === lang}
            onClick={() => setLang(l)}
          >
            {LANGUAGE_NAMES[l]}
          </button>
        ))}
      </div>
      <h1 className="text-center text-2xl font-bold">{t('appName')}</h1>
      <h2 className="text-center text-xl">{t('chooseRole')}</h2>
      <button
        type="button"
        className="role-option btn btn-primary flex flex-col items-center gap-1 p-6"
        onClick={() => onChoose('collector')}
      >
        <span className="text-5xl" aria-hidden="true">
          🛺
        </span>
        <span className="text-lg font-bold">{t('roleCollector')}</span>
      </button>
      <button
        type="button"
        className="role-option btn flex flex-col items-center gap-1 p-6"
        onClick={() => onChoose('recycler')}
      >
        <span className="text-5xl" aria-hidden="true">
          ♻️
        </span>
        <span className="text-lg font-bold">{t('roleRecycler')}</span>
      </button>
    </section>
  );
}
