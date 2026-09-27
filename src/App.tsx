import { Button, Icon, Skeleton } from './components/ui';
import type { IconName } from './components/ui/Icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MaterialCategory, MaterialLot } from './data/models';
import { requestPickup, resetLocalData, updatePickup } from './data/actions';
import {
  checkFinalPrice,
  getRecyclerIdentity,
  loadIncoming,
  loadPickupRequests,
  lookupHandover,
  saveRecyclerRates,
  setRecyclerIdentity,
  submitConfirmation,
  type IncomingHandover,
  type PickupInboxItem,
} from './data/recyclerLookup';
import { runSync, startSyncTriggers, subscribePickupChanges } from './data/syncRunner';
import { getDB, getSetting, setSetting } from './data/db';
import { Header } from './components/Header';
import { useCollector } from './hooks/useCollector';
import { useLedger } from './hooks/useLedger';
import { useLot, useLots } from './hooks/useLots';
import { usePrices } from './hooks/usePrices';
import { useRecyclers } from './hooks/useRecyclers';
import { useSyncQueue } from './hooks/useSyncQueue';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { CATEGORY_NAMES, SAFETY_CARDS, translate } from './i18n/strings';
import { detectPriceAnomaly } from './logic/anomaly';
import { DEFAULT_ORIGIN } from './logic/geo';
import { scoreRecyclers } from './logic/ranking';
import { priceTrend, valueLot } from './logic/valuation';
import { classifyPhoto, datasetExportLinks, resetServer, usingRemoteBackend } from './services/api';
import { toSuggestion, type PhotoSuggestion } from './services/classifier';
import { transactionAnomaly } from './services/serverCore';
import { Handover } from './screens/Handover';
import { Home } from './screens/Home';
import { Ledger } from './screens/Ledger';
import { NewLot, type NewLotResult } from './screens/NewLot';
import { PriceBoard } from './screens/PriceBoard';
import { RecyclerConfirm } from './screens/RecyclerConfirm';
import { RecyclerDesk } from './screens/RecyclerDesk';
import { RoleChooser, type AppRole } from './screens/RoleChooser';
import { RecyclerMatch, type MatchRow } from './screens/RecyclerMatch';
import { Safety } from './screens/Safety';
import { Valuation } from './screens/Valuation';
import { getPosition, type PositionResult } from './utils/geolocation';
import { thumbnailDataUrl } from './utils/image';
import { ensureNotificationPermission, notify } from './utils/notify';
import { speak, spellCode } from './utils/speech';

type LotStep = 'valuation' | 'match' | 'handover';
type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'lot'; lotId: string; step?: LotStep }
  | { name: 'prices' }
  | { name: 'ledger' }
  | { name: 'safety' };

/** ?role=recycler|collector in the URL overrides the saved choice (handy for demos and links). */
const roleFromUrl = (): AppRole | undefined => {
  const r = new URLSearchParams(window.location.search).get('role');
  return r === 'recycler' || r === 'collector' ? r : undefined;
};

export default function App() {
  const { profile, error } = useCollector();
  useEffect(() => startSyncTriggers(), []);

  if (error) return <p className="p-4 text-red-700">{error}</p>;
  if (!profile) return <Skeleton className="app-loading" />;

  return (
    <I18nProvider initial={profile.preferredLanguage}>
      <Shell collectorId={profile.collectorId} />
    </I18nProvider>
  );
}

function Shell({ collectorId }: { collectorId: string }) {
  const { t } = useI18n();
  const sync = useSyncQueue();
  // undefined = still loading; null = never chosen (show the chooser).
  const [role, setRole] = useState<AppRole | null | undefined>(roleFromUrl);

  useEffect(() => {
    if (role !== undefined) return;
    void getSetting<AppRole>('role').then((saved) => setRole(saved ?? null));
  }, [role]);

  const chooseRole = (next: AppRole) => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('role')) {
      url.searchParams.delete('role');
      window.history.replaceState({}, '', url);
    }
    void setSetting('role', next);
    setRole(next);
  };
  const switchRole = (toRecycler: boolean) => chooseRole(toRecycler ? 'recycler' : 'collector');

  if (role === undefined) return <Skeleton className="app-loading" />;
  if (role === null) return <RoleChooser onChoose={chooseRole} />;
  const recyclerRole = role === 'recycler';

  return (
    <div className="app mx-auto flex min-h-screen max-w-md flex-col">
      <Header
        title={t('appName')}
        sync={sync.status}
        pendingCount={sync.pendingCount}
        onSyncNow={() => void sync.syncNow()}
        simulatedOffline={sync.simulatedOffline}
        onToggleSimulatedOffline={sync.setSimulatedOffline}
      />
      {recyclerRole ? (
        <RecyclerApp online={sync.status.online} onSwitchToCollector={() => switchRole(false)} />
      ) : (
        <CollectorApp collectorId={collectorId} onSwitchToRecycler={() => switchRole(true)} />
      )}
    </div>
  );
}

/** Recycler side: confirm a code, see handovers addressed to you, publish rates. */
function RecyclerApp({ online, onSwitchToCollector }: { online: boolean; onSwitchToCollector: () => void }) {
  const { recyclers } = useRecyclers();
  const [recyclerId, setRecyclerId] = useState<string>();
  const [incoming, setIncoming] = useState<IncomingHandover[] | null | undefined>(undefined);
  const [picked, setPicked] = useState<string>();
  const authorized = useMemo(() => recyclers.filter((r) => r.authorizationStatus === 'authorized'), [recyclers]);
  const me = authorized.find((r) => r.recyclerId === recyclerId);

  useEffect(() => {
    void getRecyclerIdentity().then(setRecyclerId);
  }, []);

  const [requests, setRequests] = useState<PickupInboxItem[] | null | undefined>(undefined);
  const seenRequests = useRef<Set<string> | null>(null);
  const { t, categoryName, formatNumber } = useI18n();

  const refresh = useCallback(async () => {
    if (!recyclerId) return;
    const [inc, reqs] = await Promise.all([loadIncoming(recyclerId), loadPickupRequests(recyclerId)]);
    setIncoming(inc);
    setRequests(reqs);
    if (reqs) {
      // Alert on requests that weren't there last time (not on first load).
      const fresh = seenRequests.current ? reqs.filter((r) => !seenRequests.current!.has(r.transactionId)) : [];
      seenRequests.current = new Set(reqs.map((r) => r.transactionId));
      for (const r of fresh) {
        void notify(
          t('newRequestTitle'),
          t('requestSummary', {
            category: r.category ? categoryName(r.category) : '—',
            weight: formatNumber(r.weight ?? 0, 1),
            amount: formatNumber(r.quotedPrice),
          }),
          r.transactionId,
        );
      }
    }
  }, [recyclerId, t, categoryName, formatNumber]);

  useEffect(() => {
    seenRequests.current = null;
  }, [recyclerId]);

  // Poll while online so new requests show up without a manual refresh.
  useEffect(() => {
    void refresh();
    if (!online || !recyclerId) return;
    const id = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(id);
  }, [refresh, online, recyclerId]);

  return (
    <>
      {me && (
        <div className="facility-identity operator-header">
          <Icon name="factory" />
          <div>
            <strong>{me.name}</strong>
            <p>
              <Icon name="shield" />
              {t('authorized')}
            </p>
          </div>
        </div>
      )}
      <RecyclerConfirm
        key={picked ?? 'manual'}
        online={online}
        initialCode={picked}
        defaultConfirmedBy={me?.name}
        onLookup={lookupHandover}
        onCheckFinalPrice={checkFinalPrice}
        onConfirm={async (c) => {
          const outcome = await submitConfirmation(c);
          void refresh();
          return outcome;
        }}
        onSwitchToCollector={onSwitchToCollector}
      />
      <RecyclerDesk
        recyclers={authorized}
        recyclerId={recyclerId}
        onSelectRecycler={(id) => {
          setRecyclerId(id);
          void setRecyclerIdentity(id);
          void ensureNotificationPermission();
        }}
        requests={requests}
        onUpdatePickup={async (transactionId, status) => {
          if (!recyclerId) return;
          await updatePickup(transactionId, recyclerId, status);
          await runSync();
          await refresh();
        }}
        incoming={incoming}
        onRefreshIncoming={() => void refresh()}
        onPickHandover={(ref) => {
          setPicked(ref);
          window.scrollTo(0, 0);
        }}
        onSaveRates={(rates) => (recyclerId ? saveRecyclerRates(recyclerId, rates) : Promise.resolve())}
        sharedServer={usingRemoteBackend()}
        datasetLinks={datasetExportLinks()}
      />
    </>
  );
}

function CollectorApp({ collectorId, onSwitchToRecycler }: { collectorId: string; onSwitchToRecycler: () => void }) {
  const { t, lang, categoryName } = useI18n();
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const { lots, createLot } = useLots();
  const { board, prices } = usePrices();
  const ledger = useLedger();
  const positionRef = useRef<Promise<PositionResult> | null>(null);
  usePickupWatcher();

  const go = (r: Route) => {
    setRoute(r);
    window.scrollTo(0, 0);
  };

  async function handleNewLot(result: NewLotResult) {
    // Lot location is optional (ranking falls back to city centre) — don't make
    // the collector wait on a slow fix or an unanswered permission prompt.
    const position = await Promise.race([
      positionRef.current ?? getPosition(3000),
      new Promise<PositionResult>((r) => setTimeout(() => r({ location: DEFAULT_ORIGIN, approximate: true }), 1500)),
    ]);
    const photoThumbnail = await thumbnailDataUrl(result.imageBlob, 160);
    const { aiSuggestion, ...lotFields } = result;
    const lot = await createLot({
      collectorId,
      ...lotFields,
      photoThumbnail,
      aiSuggestion: aiSuggestion && {
        label: aiSuggestion.raw.class === 'Other' ? (aiSuggestion.raw.best_guess ?? 'Other') : aiSuggestion.raw.class,
        confidence: aiSuggestion.confidence,
        uncertain: aiSuggestion.raw.uncertain,
        model: aiSuggestion.raw.model ?? 'unknown',
      },
      estimatedValue: valueLot(result.approxWeightKg, board[result.category]),
      location: position.approximate ? undefined : position.location,
    });
    go({ name: 'lot', lotId: lot.lotId, step: 'valuation' });
  }

  async function resetDemo() {
    if (!window.confirm(t('resetDemo') + '?')) return;
    resetServer();
    await resetLocalData();
    window.location.reload();
  }

  const tabs: { route: Route; label: string; icon: IconName }[] = [
    { route: { name: 'home' }, label: t('navHome'), icon: 'home' },
    { route: { name: 'new' }, label: t('navNewLot'), icon: 'plus' },
    { route: { name: 'prices' }, label: t('navPrices'), icon: 'trend' },
    { route: { name: 'ledger' }, label: t('navLedger'), icon: 'wallet' },
    { route: { name: 'safety' }, label: t('navSafety'), icon: 'shield' },
  ];

  return (
    <>
      <main className="flex-1 pb-20">
        {route.name === 'home' && (
          <>
            <Home lots={lots} onNewLot={() => go({ name: 'new' })} onOpenLot={(lotId) => go({ name: 'lot', lotId })} />
            <div className="flex flex-col items-center gap-2 p-3 text-sm">
              <Button type="button" className="btn btn-link" onClick={onSwitchToRecycler}>
                <Icon name="factory" /> {t('switchToRecycler')}
              </Button>
              <Button type="button" className="btn btn-link opacity-60" onClick={() => void resetDemo()}>
                <Icon name="refresh" /> {t('resetDemo')}
              </Button>
            </div>
          </>
        )}
        {route.name === 'new' && (
          <NewLotRoute
            onMount={() => {
              positionRef.current = getPosition(6000);
            }}
            board={board}
            onClassify={classifyForLot}
            onComplete={handleNewLot}
            onCancel={() => go({ name: 'home' })}
          />
        )}
        {route.name === 'lot' && (
          <LotFlow
            key={route.lotId}
            lotId={route.lotId}
            step={route.step}
            onStep={(step) => go({ ...route, step })}
            onDone={() => go({ name: 'home' })}
          />
        )}
        {route.name === 'prices' && (
          <PriceBoard
            board={board}
            prices={prices}
            onSpeak={(c: MaterialCategory) => {
              const row = board[c];
              if (!row) return;
              const price = Math.round(row.pricePerUnit);
              speak(
                `${categoryName(c)}. ${t('pricePerKg', { price })}`,
                lang,
                `${CATEGORY_NAMES.en[c]}. ${translate('en', 'pricePerKg', { price })}`,
              );
            }}
          />
        )}
        {route.name === 'ledger' && (
          <Ledger
            rows={ledger.rows}
            summary={ledger.summary}
            onMarkPaid={(lotId, method) => void ledger.markPaid(lotId, method)}
            onOpenLot={(lotId) => go({ name: 'lot', lotId })}
          />
        )}
        {route.name === 'safety' && (
          <Safety
            cards={SAFETY_CARDS[lang]}
            onSpeak={(text) => {
              const i = SAFETY_CARDS[lang].findIndex((c) => text.startsWith(c.title));
              const en = SAFETY_CARDS.en[i];
              speak(text, lang, en && `${en.title}. ${en.body}`);
            }}
          />
        )}
      </main>

      <nav
        aria-label={t('navHome')}
        className="bottom-nav fixed bottom-0 left-0 right-0 mx-auto grid max-w-md grid-cols-5 border-t bg-white"
      >
        {tabs.map((tab) => (
          <Button
            key={tab.route.name}
            type="button"
            className={`nav-tab flex flex-col items-center py-2 text-xs ${route.name === tab.route.name ? 'is-active font-bold' : ''}`}
            aria-current={route.name === tab.route.name ? 'page' : undefined}
            onClick={() => go(tab.route)}
          >
            <span className="text-xl" aria-hidden="true">
              <Icon name={tab.icon} />
            </span>
            {tab.label}
          </Button>
        ))}
      </nav>
    </>
  );
}

function NewLotRoute(props: { onMount: () => void } & Parameters<typeof NewLot>[0]) {
  const { onMount, ...rest } = props;
  useEffect(() => onMount(), []); // start GPS early so it's ready by the weight step
  return <NewLot {...rest} />;
}

/** Valuation → recycler match → handover for one lot. */
function LotFlow({
  lotId,
  step,
  onStep,
  onDone,
}: {
  lotId: string;
  step?: LotStep;
  onStep: (s: LotStep) => void;
  onDone: () => void;
}) {
  const { t, lang, categoryName } = useI18n();
  const { lot, transaction, record, loading } = useLot(lotId);
  const { board, prices } = usePrices();
  const { recyclers } = useRecyclers();
  const { selectRecycler, completeHandover, markPaid } = useLots();
  const sync = useSyncQueue();
  const [position, setPosition] = useState<PositionResult | null>(null);

  const current: LotStep = step ?? defaultStep(lot, !!transaction);

  useEffect(() => {
    if (current === 'handover' && !record && !position) void getPosition().then(setPosition);
  }, [current, record, position]);

  const matchRows = useMemo<MatchRow[]>(() => {
    if (!lot) return [];
    const row = board[lot.category];
    return scoreRecyclers(lot, recyclers).map((r) => ({
      ...r,
      expectedAmount: Math.round(r.offeredRate * lot.approxWeightKg),
      anomaly: row
        ? detectPriceAnomaly(r.offeredRate, row.marketRangeLow, row.marketRangeHigh)
        : { flagged: false, direction: 'within', deviationPct: 0 },
    }));
  }, [lot, recyclers, board]);

  if (loading) return <Skeleton className="app-loading" />;
  if (!lot) return <p className="p-4">{t('errorGeneric', { message: lotId })}</p>;

  if (current === 'valuation') {
    return (
      <Valuation
        lot={lot}
        row={board[lot.category]}
        trend={priceTrend(prices, lot.category)}
        onSpeakPrice={() =>
          speak(
            t('spokenPrice', {
              category: categoryName(lot.category),
              weight: lot.approxWeightKg,
              amount: lot.estimatedValue,
            }),
            lang,
            translate('en', 'spokenPrice', {
              category: CATEGORY_NAMES.en[lot.category],
              weight: lot.approxWeightKg,
              amount: lot.estimatedValue,
            }),
          )
        }
        onFindRecyclers={() => onStep(transaction ? 'handover' : 'match')}
        onBack={onDone}
      />
    );
  }

  if (current === 'match' || !transaction) {
    const hiddenCount = recyclers.filter(
      (r) => r.materialsAccepted.includes(lot.category) && r.authorizationStatus !== 'authorized',
    ).length;
    return (
      <RecyclerMatch
        lot={lot}
        rows={matchRows}
        hiddenCount={hiddenCount}
        selectedRecyclerId={transaction?.recyclerId}
        onChoose={async (recycler) => {
          await selectRecycler(lot.lotId, recycler, DEFAULT_ORIGIN);
          onStep('handover');
        }}
        onBack={() => onStep('valuation')}
      />
    );
  }

  const hasUnsyncedChanges = sync.queue.some((q) => {
    const op = q.op;
    return (
      (op.kind === 'upsertTraceability' && op.record.lotId === lot.lotId) ||
      (op.kind === 'upsertTransaction' && op.transaction.lotId === lot.lotId) ||
      (op.kind === 'markPaid' && op.transactionId === transaction.transactionId)
    );
  });

  return (
    <Handover
      lot={lot}
      recycler={recyclers.find((r) => r.recyclerId === transaction.recyclerId)}
      transaction={transaction}
      record={record}
      position={position}
      hasUnsyncedChanges={hasUnsyncedChanges}
      priceFlag={
        transaction.transactionStatus === 'confirmed' && transaction.finalPrice != null
          ? transactionAnomaly(
              transaction,
              lot.approxWeightKg,
              board[lot.category]?.marketRangeLow,
              board[lot.category]?.marketRangeHigh,
            )
          : null
      }
      pickupQueued={sync.queue.some(
        (q) => q.op.kind === 'requestPickup' && q.op.transactionId === transaction.transactionId,
      )}
      onRequestPickup={async (contactPhone) => {
        void ensureNotificationPermission();
        await requestPickup(lot.lotId, contactPhone);
      }}
      onCreate={async (photo) => {
        if (!position) return;
        const thumbnails = (await Promise.all([lot.imageBlob, photo].map((b) => thumbnailDataUrl(b)))).filter(
          (x): x is string => !!x,
        );
        await completeHandover({
          lotId: lot.lotId,
          photo,
          location: position.location,
          locationApproximate: position.approximate,
          thumbnails,
        });
      }}
      onSpeakCode={(code) =>
        speak(
          t('spokenCode', { code: spellCode(code) }),
          lang,
          translate('en', 'spokenCode', { code: spellCode(code) }),
        )
      }
      onMarkPaid={(method) => void markPaid(lot.lotId, method)}
      onChangeRecycler={() => onStep('match')}
      onBack={onDone}
    />
  );
}

function defaultStep(lot: MaterialLot | undefined, hasTransaction: boolean): LotStep {
  if (!lot || lot.status === 'draft' || lot.status === 'valued') return 'valuation';
  return hasTransaction ? 'handover' : 'match';
}

const ACTIVE_PICKUP = ['requested', 'accepted', 'on_the_way', 'arriving'];

/**
 * Collector side: while any pickup is in progress, sync every 15 s so the
 * recycler's accept / on-the-way / arriving shows up, and raise a notification
 * for each change.
 */
function usePickupWatcher() {
  const { t } = useI18n();
  useEffect(() => {
    const unsubscribe = subscribePickupChanges(async (changes) => {
      const db = await getDB();
      for (const c of changes) {
        const recycler = await db.get('recyclers', c.recyclerId);
        void notify(t('pickupUpdateTitle', { name: recycler?.name ?? '' }), t(`pickup_${c.status}`), c.transactionId);
      }
    });
    const id = window.setInterval(async () => {
      const txs = await (await getDB()).getAll('transactions');
      if (txs.some((tx) => tx.pickup && ACTIVE_PICKUP.includes(tx.pickup.status))) void runSync();
    }, 15_000);
    return () => {
      unsubscribe();
      window.clearInterval(id);
    };
  }, [t]);
}

async function classifyForLot(photo: Blob): Promise<PhotoSuggestion | null> {
  const result = await classifyPhoto(photo);
  return result ? toSuggestion(result) : null;
}
