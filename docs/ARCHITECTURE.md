# Architecture

## The big picture

```
 Collector phone / Recycler phone (PWA, React)            Railway (backend/)             Supabase
 ┌───────────────────────────────────────────┐            ┌─────────────────────┐       ┌──────────────┐
 │ screens/*  (props in, callbacks out)      │            │ node:http app       │       │ Postgres     │
 │   ▲                                       │  HTTPS     │  routes, CORS,      │  pg   │ kc_* tables  │
 │ hooks/*  (read IndexedDB, re-render)      │ ─────────► │  CSV export         │ ────► │ (jsonb data  │
 │ data/actions.ts (every write + queue op)  │  /api/*    │ serverCore.ts rules │       │  + generated │
 │ data/syncRunner.ts (flush queue, pull)    │            │ store.ts persistence│       │  columns)    │
 │ services/api.ts (only network module)     │            └─────────────────────┘       └──────────────┘
 │ IndexedDB: one store per dataset + queue  │
 │ service-worker.js: precached app shell    │
 └───────────────────────────────────────────┘
```

**Offline-first rule:** the phone is the source of truth for its own work.
- Every write goes to IndexedDB **and** into the `syncQueue`, in the same IDB transaction.
- The network is only used to send the queue in order and to pull updates (confirmations, recyclers, prices).
- If the server is down or unreachable, the app behaves as offline, and nothing is lost.

## Layers (frontend, `src/`)

| Layer | Files | Rules |
|---|---|---|
| Pure logic | `logic/*.ts`: `ranking`, `valuation`, `anomaly`, `hashing`, `sync`, `geo` | No DOM, no React, no IO. Unit-tested. **Treat these as a stable contract**: ask before changing them |
| Data model | `data/models.ts` | Interfaces for the datasets and `SyncOp`. Changes must be additive |
| Seed data | `data/seedData.ts` (pure), `data/seed.ts` (writes IDB) | `seedData` is shared with the backend |
| Storage | `data/db.ts` | `idb` wrapper. `notifyChange()` fires local listeners and a BroadcastChannel, so other tabs refresh |
| Writes | `data/actions.ts` | `createLot`, `selectRecycler`, `completeHandover`, `markPaid`, `recyclerConfirm`. Each one writes its stores **and** enqueues ops atomically. `markPaid` and `recyclerConfirm` are idempotent (double-tap safe) |
| Recycler data | `data/recyclerLookup.ts` | Code lookup (this device first, then the server), hash re-verification, final-price anomaly check, worklist, rate publishing, facility identity |
| Sync | `data/syncRunner.ts` | Push the queue (`logic/sync.flushQueue`, strict order, halts on `OfflineError`). Then pull recyclers and prices, and apply confirmations (`logic/sync.applyConfirmation`). Triggers: Sync now, `online` event, Background Sync message from the SW, after every write, and the cross-tab `storage` event |
| Network | `services/api.ts` | **The only module that talks to "the server".** Uses HTTP when `VITE_API_URL` is set at build time; otherwise it runs `serverCore` in-page against localStorage (the mock). A network failure or 5xx becomes `OfflineError`, so the queue retries; a 4xx becomes `Error`, so the op is marked failed and dropped after 5 attempts |
| Backend rules | `services/serverCore.ts` | Pure functions over a `ServerState`. **Shared by the mock and the real server.** Validation, SHA-256 re-check of handover records, holding early confirmations, anomaly flags, audit, price rows from sales and rate changes |
| Hooks | `hooks/*` | `useStoreQuery` is the primitive: load from IDB, re-load on `notifyChange` |
| Screens | `screens/*` | Render from props, emit callbacks. Minimal Tailwind plus semantic class hooks; styling is Codex's job |
| App shell | `App.tsx` | Role chooser, then either `CollectorApp` (tabs: Home, Sell, Prices, Earnings, Safety; the lot flow Valuation → Match → Handover) or `RecyclerApp` (`RecyclerConfirm` + `RecyclerDesk`). Wires hooks to screens |
| i18n | `i18n/strings.ts`, `I18nProvider.tsx` | `en` is the key source; `hi` and `mr` must have every key (type-checked). Also category names, safety cards, status names |
| Browser utils | `utils/*` | `speech.ts` (TTS with English fallback), `geolocation.ts` (hard deadline, approximate fallback), `image.ts` (compress, thumbnails) |

## Key flows

**New lot:** NewLot (photo → category → weight, plus optional condition/source) → `createLot` (status `valued`, queue `upsertLot`) → Valuation (board price, spoken price, sparkline).

**Match:** `scoreRecyclers` computes a score for each recycler:
- filter: authorized recyclers that accept the category and offer a rate > 0;
- score = 0.5 × (rate ÷ best rate) + 0.3 × (proximity ÷ best proximity) + 0.2 if pickup is available;
- an anomaly badge shows if a quote is more than 40% outside the market band.

Choosing a recycler calls `selectRecycler`, which creates the transaction as `pending`.

**Pickup** (the statement's "pickup availability"). This only applies when the chosen recycler offers pickup; otherwise the collector drops off.
- The collector taps **Request pickup**, with an optional phone number. `requestPickup` sets `transaction.pickup` locally and queues a `requestPickup` op.
- The recycler's inbox (`GET /api/recyclers/:id/requests`, polled every 15 s) shows the photo thumbnail, category, weight, the quoted ₹, a map link and 📞.
- The recycler's `updatePickup` ops move it forward: accepted | declined → on_the_way → arriving. It becomes `completed` on confirmation.
- The collector pulls `GET /api/pickups`, and `mergePickup` keeps the furthest-along copy. Each change fires `subscribePickupChanges`, and a system notification is shown (`utils/notify.ts`).
- The handover itself is unchanged and can be done at any time.
- The state machine is `advancePickup` in `serverCore.ts`, shared by client and server.

**Handover** (works offline):
- GPS: the real fix, or an approximate one within about 10 s.
- `completeHandover` creates the `TraceabilityRecord`:
  - the hash is sha256(`lotId|weight|timestamp|lat|lng|collectorId|recyclerId`);
  - the reference is `KC-` plus the first 6 hex characters of the hash;
  - it carries ~200 px thumbnails.
- It also creates a ledger entry (`due`, `pending`) and moves the transaction to `handed_over`.

**Recycler confirm:**
- Look up the code: first this device (IDB), then the server.
- Re-compute the hash, check the final price against the market and the quote, then `recyclerConfirm` queues `confirmHandover`.
- The server marks the record and transaction confirmed and adds a price row. It flags the sale if the price is abnormal.
- The collector's next sync pulls `/api/updates`. `applyConfirmation` then sets the transaction to `confirmed`, the ledger to `earning`/`settled` if paid, and the lot to `paid`.

**Early confirmation:** if the recycler confirms a code before the collector's record has synced, the server keeps it in `confirmations` and applies it when `upsertTraceability` arrives.

## Backend (`backend/`)

- `src/app.ts`: routes, CORS, body limit, JSON/CSV export. Mutations are serialized through an in-process queue. Each op is applied to a `structuredClone` draft, so a rejected op never half-applies.
- `src/store.ts`: `MemoryStore` for tests, `FileStore` (`DATA_FILE`), and `PostgresStore` (`DATABASE_URL`). State is held in memory and written through after every accepted op, as upserts into the `kc_*` tables in one transaction. It loads from the tables on boot and seeds when they're empty. **Single instance only**: fine for the demo scale.
- `src/schema.ts`: the SQL, as ordered sections. The server applies every section except `01_users` (Supabase-only) on boot; `npm run db:sql` writes them to `database/`.
- `dist/server.mjs`: **committed** bundle of `src/index.ts` plus the shared frontend code, so Railway can deploy `backend/` on its own. `bundle.test.ts` fails if it's stale.

## Classifier (`classifier/`, Python)

- FastAPI + Transformers + PyTorch, with SigLIP 2 zero-shot. **All model logic is in `classifier_service.py`** behind `classify_image(image) -> {class, confidence, uncertain, best_guess, scores, model}`.
- The model loads once. The 24 prompt text embeddings are computed once and cached. Each image is one forward pass: prompt logits → per-class mean → softmax over 8 classes → confidence and margin rules.
- The PWA calls `api.classifyPhoto` (only when online) → Node `POST /api/classify` (proxy, needs `CLASSIFIER_URL`) → the Python service. Any failure returns null, and the collector uses the manual grid.
- `src/services/classifier.ts` maps the labels to `MaterialCategory` (`LCD` → `LCD_PANEL`, …).
- Swapping the model means a new class in `classifier_service.py`; the API, proxy and PWA don't change.

## Service worker

`service-worker.js` (repo root) is processed at build time by the plugin in `vite.config.ts`, which injects the list of hashed assets to precache.
- App-shell requests: cache-first. Navigations: network-first, falling back to cached `index.html`.
- Background Sync: it only wakes the page, because the queue lives in the page.
- It's registered only in production builds.
