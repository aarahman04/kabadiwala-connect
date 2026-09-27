import { useEffect, useMemo, useRef, useState } from 'react';
import type { MaterialCategory, MaterialLot } from './data/models';
import { resetLocalData } from './data/actions';
import { lookupHandover, submitConfirmation } from './data/recyclerLookup';
import { startSyncTriggers } from './data/syncRunner';
import { Header } from './components/Header';
import { useCollector } from './hooks/useCollector';
import { useLedger } from './hooks/useLedger';
import { useLot, useLots } from './hooks/useLots';
import { usePrices } from './hooks/usePrices';
import { useRecyclers } from './hooks/useRecyclers';
import { useSyncQueue } from './hooks/useSyncQueue';
import { I18nProvider, useI18n } from './i18n/I18nProvider';
import { SAFETY_CARDS } from './i18n/strings';
import { detectPriceAnomaly } from './logic/anomaly';
import { DEFAULT_ORIGIN } from './logic/geo';
import { scoreRecyclers } from './logic/ranking';
import { priceTrend, valueLot } from './logic/valuation';
import { resetServer } from './services/api';
import { Handover } from './screens/Handover';
import { Home } from './screens/Home';
import { Ledger } from './screens/Ledger';
import { NewLot, type NewLotResult } from './screens/NewLot';
import { PriceBoard } from './screens/PriceBoard';
import { RecyclerConfirm } from './screens/RecyclerConfirm';
import { RecyclerMatch, type MatchRow } from './screens/RecyclerMatch';
import { Safety } from './screens/Safety';
import { Valuation } from './screens/Valuation';
import { getPosition, type PositionResult } from './utils/geolocation';
import { speak, spellCode } from './utils/speech';

type LotStep = 'valuation' | 'match' | 'handover';
type Route =
  | { name: 'home' }
  | { name: 'new' }
  | { name: 'lot'; lotId: string; step?: LotStep }
  | { name: 'prices' }
  | { name: 'ledger' }
  | { name: 'safety' };

const isRecyclerRole = () => new URLSearchParams(window.location.search).get('role') === 'recycler';

export default function App() {
  const { profile, error } = useCollector();
  useEffect(() => startSyncTriggers(), []);

  if (error) return <p className="p-4 text-red-700">{error}</p>;
  if (!profile) return <p className="p-4">…</p>;

  return (
    <I18nProvider initial={profile.preferredLanguage}>
      <Shell collectorId={profile.collectorId} />
    </I18nProvider>
  );
}

function Shell({ collectorId }: { collectorId: string }) {
  const { t } = useI18n();
  const sync = useSyncQueue();
  const [recyclerRole, setRecyclerRole] = useState(isRecyclerRole);

  const switchRole = (toRecycler: boolean) => {
    const url = new URL(window.location.href);
    if (toRecycler) url.searchParams.set('role', 'recycler');
    else url.searchParams.delete('role');
    window.history.pushState({}, '', url);
    setRecyclerRole(toRecycler);
  };

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
        <RecyclerConfirm
          online={sync.status.online}
          onLookup={lookupHandover}
          onConfirm={submitConfirmation}
          onSwitchToCollector={() => switchRole(false)}
        />
      ) : (
        <CollectorApp collectorId={collectorId} onSwitchToRecycler={() => switchRole(true)} />
      )}
    </div>
  );
}

function CollectorApp({ collectorId, onSwitchToRecycler }: { collectorId: string; onSwitchToRecycler: () => void }) {
  const { t, lang, categoryName } = useI18n();
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const { lots, createLot } = useLots();
  const { board, prices } = usePrices();
  const ledger = useLedger();
  const positionRef = useRef<Promise<PositionResult> | null>(null);

  const go = (r: Route) => {
    setRoute(r);
    window.scrollTo(0, 0);
  };

  async function handleNewLot(result: NewLotResult) {
    const position = await (positionRef.current ?? getPosition(3000));
    const lot = await createLot({
      collectorId,
      ...result,
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

  const tabs: { route: Route; label: string; icon: string }[] = [
    { route: { name: 'home' }, label: t('navHome'), icon: '🏠' },
    { route: { name: 'new' }, label: t('navNewLot'), icon: '➕' },
    { route: { name: 'prices' }, label: t('navPrices'), icon: '📈' },
    { route: { name: 'ledger' }, label: t('navLedger'), icon: '💰' },
    { route: { name: 'safety' }, label: t('navSafety'), icon: '⛑️' },
  ];

  return (
    <>
      <main className="flex-1 pb-20">
        {route.name === 'home' && (
          <>
            <Home
              lots={lots}
              onNewLot={() => go({ name: 'new' })}
              onOpenLot={(lotId) => go({ name: 'lot', lotId })}
            />
            <div className="flex flex-col items-center gap-2 p-3 text-sm">
              <button type="button" className="btn btn-link" onClick={onSwitchToRecycler}>
                ♻️ {t('switchToRecycler')}
              </button>
              <button type="button" className="btn btn-link opacity-60" onClick={() => void resetDemo()}>
                {t('resetDemo')}
              </button>
            </div>
          </>
        )}
        {route.name === 'new' && (
          <NewLotRoute
            onMount={() => {
              positionRef.current = getPosition(6000);
            }}
            board={board}
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
              if (row) speak(`${categoryName(c)}. ${t('pricePerKg', { price: Math.round(row.pricePerUnit) })}`, lang);
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
        {route.name === 'safety' && <Safety cards={SAFETY_CARDS[lang]} onSpeak={(text) => speak(text, lang)} />}
      </main>

      <nav className="bottom-nav fixed bottom-0 left-0 right-0 mx-auto grid max-w-md grid-cols-5 border-t bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.route.name}
            type="button"
            className={`nav-tab flex flex-col items-center py-2 text-xs ${route.name === tab.route.name ? 'is-active font-bold' : ''}`}
            onClick={() => go(tab.route)}
          >
            <span className="text-xl" aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </button>
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

  if (loading) return <p className="p-4">…</p>;
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
      onCreate={async (photo) => {
        if (!position) return;
        await completeHandover({
          lotId: lot.lotId,
          photo,
          location: position.location,
          locationApproximate: position.approximate,
        });
      }}
      onSpeakCode={(code) => speak(t('spokenCode', { code: spellCode(code) }), lang)}
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
