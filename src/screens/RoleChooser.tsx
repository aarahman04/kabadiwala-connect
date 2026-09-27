import { Button, Icon, SegmentedControl } from '../components/ui';
import { Brand, RoleIllustration } from '../components/ui/Brand';
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
    <section className="screen role-chooser">
      <SegmentedControl className="language-toggle" aria-label={t('language')}>
        {(Object.keys(LANGUAGE_NAMES) as Language[]).map((l) => (
          <Button
            key={l}
            type="button"
            className={`btn chip ${l === lang ? 'is-selected font-bold underline' : ''}`}
            aria-pressed={l === lang}
            onClick={() => setLang(l)}
          >
            {LANGUAGE_NAMES[l]}
          </Button>
        ))}
      </SegmentedControl>
      <div className="role-intro">
        <h1>
          <Brand hero />
        </h1>
        <h2>{t('brandPromise')}</h2>
        <p>{t('brandDetail')}</p>
      </div>
      <h3 className="role-question">{t('chooseRole')}</h3>
      <Button type="button" className="role-option role-collector" onClick={() => onChoose('collector')}>
        <RoleIllustration />
        <span className="role-copy">
          <strong>{t('roleCollector')}</strong>
          <span>{t('collectorDetail')}</span>
        </span>
        <Icon name="next" />
      </Button>
      <Button type="button" className="role-option role-recycler" onClick={() => onChoose('recycler')}>
        <RoleIllustration recycler />
        <span className="role-copy">
          <strong>{t('roleRecycler')}</strong>
          <span>{t('recyclerDetail')}</span>
        </span>
        <Icon name="next" />
      </Button>
      <p className="role-footnote">
        <Icon name="offline" />
        {t('offlineReady')}
      </p>
    </section>
  );
}
