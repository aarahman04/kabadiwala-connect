import { Button, Icon, SegmentedControl } from './ui';
import { Brand } from './ui/Brand';
import type { Language } from '../data/models';
import type { SyncStatus } from '../data/syncRunner';
import { LANGUAGE_NAMES } from '../i18n/strings';
import { useI18n } from '../i18n/I18nProvider';

interface Props {
  title: string;
  sync: SyncStatus;
  pendingCount: number;
  onSyncNow: () => void;
  simulatedOffline: boolean;
  onToggleSimulatedOffline: (offline: boolean) => void;
}

export function Header({ title, sync, pendingCount, onSyncNow, simulatedOffline, onToggleSimulatedOffline }: Props) {
  const { t, lang, setLang, formatDateTime } = useI18n();
  return (
    <header className="app-header border-b p-3">
      <div className="header-identity">
        <h1 className="app-title" aria-label={title}>
          <Brand />
        </h1>
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
      </div>
      <div className="sync-bar mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className={`connection-badge ${sync.online ? 'is-online' : 'is-offline'}`}>
          <Icon name={sync.online ? 'online' : 'offline'} />
          {sync.online ? t('online') : t('offline')}
        </span>
        <span className="queue-count">
          {pendingCount > 0 ? t('pendingSync', { count: pendingCount }) : t('allSynced')}
        </span>
        <Button
          type="button"
          icon="refresh"
          loading={sync.syncing}
          className="btn btn-secondary sync-button"
          disabled={sync.syncing || !sync.online}
          onClick={onSyncNow}
        >
          {sync.syncing ? t('syncing') : t('syncNow')}
        </Button>
        {sync.lastSyncAt && (
          <span className="last-sync opacity-70">{t('lastSynced', { time: formatDateTime(sync.lastSyncAt) })}</span>
        )}
        {sync.lastResult && !sync.syncing && (sync.lastResult.sent > 0 || sync.lastResult.confirmed > 0) && (
          <span className="sync-result">
            {sync.lastResult.confirmed > 0 ? t('syncDone', sync.lastResult) : t('syncSent', sync.lastResult)}
          </span>
        )}
        {sync.lastError && (
          <span className="sync-error text-red-700">{t('errorGeneric', { message: sync.lastError })}</span>
        )}
        <details className="demo-settings">
          <summary aria-label={t('settings')}>
            <Icon name="settings" />
            <span className="sr-only">{t('settings')}</span>
          </summary>
          <label className="simulate-offline flex items-center gap-2">
            <input
              type="checkbox"
              checked={simulatedOffline}
              onChange={(e) => onToggleSimulatedOffline(e.target.checked)}
            />
            {t('simulateOffline')}
          </label>
        </details>
      </div>
    </header>
  );
}
