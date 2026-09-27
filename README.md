# Kabadiwala Connect (SIH26229)

> **New session / new contributor? Read [docs/README.md](docs/README.md) first.**

Offline-first PWA for informal e-waste collectors: photograph and price a lot, find authorized recyclers, and record a verifiable handover. Supports Hindi, Marathi and English.

## Run

```bash
npm install
npm run dev            # http://localhost:5173 (no service worker in dev)
npm test               # logic unit tests + full offline→sync flow test
npm run build && npm run preview          # production build on http://localhost:4173, service worker active
npm run dev:backend    # API on http://localhost:8787 (memory store; set DATA_FILE or DATABASE_URL to persist)
npm run build:backend  # REQUIRED after changing backend/ or shared server code: backend/dist/server.mjs is committed
npm run db:sql         # regenerate database/NN_*.sql from backend/src/schema.ts
VITE_API_URL=http://localhost:8787 npm run dev   # client against the real API
```

## Backend: one shared server, so two phones really sync

Without `VITE_API_URL`, the app uses a **mock server inside the browser** (localStorage). Only tabs of one browser share it, which is what the earlier demo relied on. With `VITE_API_URL` set at build time, every device talks to **`/server`**, a small Node API. Collector and recycler can then be **two different phones**.

- **Same rules both ways.** `src/services/serverCore.ts` holds the backend's rules, and both the mock and the real server run them.
- **Validation.** It checks categories, weights and prices, and refuses transactions with unauthorized recyclers.
- **Hash check.** It **re-computes the SHA-256 of every handover record** and rejects tampered ones.
- **Early confirmations.** A recycler's confirmation that arrives before the collector's record is held until the record syncs.
- **Growing datasets.** Every confirmed sale and every recycler rate change becomes a dated row in the price dataset.
- **Anomaly flags.** A final price more than 40% outside the market band, or more than 40% off the quote, is flagged.
- **Audit trail and exports.** Every write is logged, and all datasets export as CSV/JSON with collector IDs pseudonymized.
- **No accounts, on purpose.** Collectors are an anonymous device ID, following the statement's "avoid unnecessary personal information".
- **Offline still works.** Every write goes to the IndexedDB queue first. Server down, asleep or unreachable counts as offline, and the queue retries later.

| Endpoint | |
|---|---|
| `GET /api/health` | store type + dataset counts |
| `GET /api/recyclers`, `GET /api/prices` | recycler directory, full price history |
| `POST /api/ops` `{ op }` | one queued client write (lot, transaction, handover, confirmation, payment, rate update) |
| `GET /api/updates?collectorId=` | confirmations for a collector's handovers |
| `GET /api/handovers/KC-XXXXXX` | recycler lookup (record, lot, transaction, photo thumbnails, anomaly flag) |
| `GET /api/recyclers/:id/handovers` | recycler worklist |
| `GET /api/export/<dataset>.csv\|json` | `materials prices recyclers transactions traceability collectors flags audit` |
| `POST /api/admin/reset` | wipe to seed data; needs `Authorization: Bearer $ADMIN_TOKEN` |

### Deploying

Full steps are in **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. In short:

- **Railway:** Root Directory = `backend`. It deploys the prebuilt `backend/dist/server.mjs` with its own `package.json` and `railway.json`.
- **Supabase:** run `database/01_users.sql` … `12_seed_prices.sql` in order in the SQL editor. Then give Railway these variables:
  - `DATABASE_URL`: the Session pooler URI
  - `DATABASE_SSL=require`
  - `DATABASE_CA`: Supabase's CA certificate
- **Vercel:** set `VITE_API_URL=https://<railway-domain>`, then redeploy.

## Two-phone demo (needs the shared backend)

Tested with two separate Chrome profiles against the built server; they share no storage, so they behave like two phones. The judge can hold the recycler phone.

1. **Recycler phone:** open the app and choose **I run a recycling facility**, then pick the facility. Use one that offers pickup, e.g. *Vidarbha E-Waste Solutions*. Allow notifications.
2. **Collector phone** (airplane mode is fine):
   - Tap **Sell**, take a photo, tap **Circuit boards**.
   - Optionally tap *Broken* and *Shops*. These fill the dataset's condition and source fields.
   - Tap **Find authorized recyclers**, then **Choose** the same facility.
   - Take the handover photo and tap **Create handover record**. The code `KC-XXXXXX` appears.
3. **Either order works:**
   - **Collector online first:** the handover appears in the recycler's **Handovers to you** list, with a photo thumbnail. Tap it to see "✅ Record fingerprint verified" and both photos.
   - **Collector still offline:** the recycler types the code by hand and confirms anyway. The server holds the confirmation until the collector's record arrives.
4. **Recycler:** type `100` into the final price and a warning appears: *"⚠️ Final price 82% below market — abnormal"*. Clear it, keep **Cash**, and tap **Confirm handover**. A double tap still sends one confirmation.
5. **Collector:** turn airplane mode off. The lot flips to ✅ *Confirmed by Sitabuldi…*, and **Earnings** shows the recycler's name.
6. **Recycler:** open **My buying rates**, change PCB to `199` and tap **Save rates**. After the collector syncs, the match screen ranks with the new rate. The change is also a new row in the price dataset.
7. **Datasets:** the recycler view has CSV download links for all datasets. You can also open `https://<api-domain>/api/export/transactions.csv` in any browser.

### Pickup variant (recycler comes to the collector)

1. **Collector:**
   - Tap **Sell** → take a photo → **Wires & cables** → **Estimated value** → **Find authorized recyclers**.
   - **Choose** *Vidarbha E-Waste Solutions*; it shows 🚚 Pickup available.
   - Optionally enter a phone number, then tap **🚚 Request pickup**. The screen shows ⏳ *Request sent*.
2. **Recycler:** the request appears under **🚚 Pickup requests** (within 15 s, or tap ↻ Refresh), and a notification pops up. It shows the photo, category, weight, ≈ ₹, 📍 map and 📞 call. Tap **✅ Accept**.
3. **Collector:** the screen shows *✅ Accepted by the recycler*, with a notification and a 📞 Call button.
4. **Recycler:** tap **🛵 On my way**, then **📍 Arriving soon**. The collector sees each step and gets a notification.
5. **At the door:** the collector takes the handover photo and taps **Create handover record**. The recycler looks up the code, pays, and taps **Confirm handover**.
6. The request disappears from the recycler's inbox. The collector's lot shows ✅ Confirmed · Paid, and Earnings updates.

## Contingency box — if it breaks live

| Failure | What you'll see | What to do on stage |
|---|---|---|
| No Hindi/Marathi TTS voice on the phone | 🔊 speaks the **English** sentence instead (automatic fallback). Tested: this laptop's Chrome has only English voices. | "Voice packs are a device setting; we fall back to English." To fix beforehand: Android Settings → Text-to-speech → Google engine → install Hindi (it also reads Marathi). |
| 🔊 completely silent | Nothing plays (TTS is off or media volume is 0) | Turn up **media** volume. Otherwise read the number off the screen, where it's shown large. |
| GPS denied, or prompt ignored | "📍 GPS unavailable — approximate location used" at once (denied) or within 10 seconds (ignored). The record is marked `(≈)`. It never blocks the flow. | "Approximate location is flagged in the record." To avoid it, grant location permission before the demo. |
| Camera opens a file picker instead of the camera | A gallery or file chooser | Pick any gallery photo; the flow is the same. In step 3 only, you can also tap **No camera? Continue without photo** (the handover photo in step 7 is still required). |
| Page reloads after taking a photo (low memory) | You land back on Home and the lot wasn't created | Tap **Sell** again. Close other apps before the demo. |
| App won't open in airplane mode | Chrome's "No internet" dinosaur | The service worker never installed (plain http, or a self-signed certificate). Turn networking back on, switch to the laptop tab, and use **Demo: simulate offline**. See "Getting it onto the demo phone". |
| Sync doesn't flip to Confirmed | Still ⏳ after going online | Tap **Sync now**. With the shared backend, open `/api/health` to check the server is up. Railway may take a few seconds to wake it. Without the backend, the recycler must confirm **in the same browser**. |
| Venue wifi / backend down | Recycler view shows "Connect to the internet…", and nothing syncs | Fall back to the one-phone flow: **Recycler view** on the collector's phone. Everything still works through the local queue, and it syncs when the network returns. |
| Demo data cluttered from rehearsals | Lots of old lots | Tap **Reset demo data** at the bottom of Home, then reload **while online**. |

## Layout

| Path | What |
|---|---|
| `src/data/models.ts` | Dataset interfaces (brief §3) plus sync types |
| `src/data/db.ts` | IndexedDB: one store per dataset plus `ledger`, `syncQueue`, `settings` |
| `src/data/seed.ts` | 10 Nagpur recyclers (fictional), 38 price rows over 60 days, 1 confirmed demo transaction |
| `src/data/actions.ts` | All writes; each write and its sync-queue entry commit in one IDB transaction |
| `src/data/syncRunner.ts` | Flushes the queue, then pulls confirmations, recyclers and prices. Triggered by Sync now, the `online` event, Background Sync, and after writes |
| `src/logic/*.ts` | Pure, tested functions: `ranking`, `valuation`, `anomaly`, `hashing`, `sync`, `geo` |
| `src/services/api.ts` | The only network module: real HTTP backend when `VITE_API_URL` is set, else in-browser mock |
| `src/services/serverCore.ts` | Backend rules (validation, hash re-check, confirmations, anomaly flags, audit), shared by mock and server |
| `backend/` | Deployable API folder (Railway root dir): `src/app.ts` routes + CSV export, `src/store.ts` Postgres/file/memory persistence, `src/schema.ts` SQL source; `dist/server.mjs` is the committed bundle |
| `classifier/` | Python FastAPI service: SigLIP 2 zero-shot photo → material (see `classifier/README.md`). Optional; Railway root dir `classifier` |
| `database/` | Numbered SQL files for the Supabase SQL editor (01 users → 12 seed prices) + `13_useful_queries.sql` |
| `docs/` | Handoff docs: progress, architecture, data model, deployment, decisions — **start here in a new session** |
| `src/data/recyclerLookup.ts` | Recycler-side data: code lookup, final-price check, worklist, rate publishing |
| `src/hooks/*` | `useLots`, `useLot`, `useRecyclers`, `usePrices`, `useLedger`, `useSyncQueue` |
| `src/screens/*` | Screens that render from typed props and callbacks only |
| `src/i18n/strings.ts` | en / hi / mr strings, category names, safety cards |
| `service-worker.js` | Precaches the app shell; the asset list is injected at build |

## Changes in the QA pass (read this before the design pass)

`src/logic/*` and `src/data/models.ts` are **untouched**. Screen props and callbacks are unchanged. The only new string key is `syncSent`.

- **Speech fallback** (`src/utils/speech.ts`, `src/App.tsx`): `speak(text, lang, englishText?)` now falls back to English text and an English voice when no hi/mr voice is installed. Before, an English voice was given Devanagari text, which comes out silent or as gibberish. It also never throws now, and it avoids an Android quirk where `speak()` right after `cancel()` gets dropped.
- **GPS hard deadline** (`src/utils/geolocation.ts`): location gives up after the timeout plus 2 seconds. The browser's own `timeout` doesn't start until the permission prompt is answered, so an ignored prompt used to leave "Getting location…" and a disabled handover button forever.
- **Lot creation no longer waits on GPS** (`src/App.tsx`): creating a lot waits at most 1.5 seconds for a fix. Lot location is optional, and an unanswered prompt was freezing the "Estimated value" button for about 8 seconds.
- **Sync message** (`src/components/Header.tsx`, strings): the header said "confirmed 0" when another tab had already pulled the confirmation. It now shows just "Sent N" when there's nothing confirmed to report.
- **Cross-tab offline toggle** (`src/data/syncRunner.ts`, `src/hooks/useSyncQueue.ts`, `src/services/api.ts`, which now exports `SIMULATE_OFFLINE_KEY`): toggling **simulate offline** in one tab now updates the badge and checkbox in the other tab.

## Changes in the backend / completeness pass (read this before the design pass)

UI changes are functional only, with minimal Tailwind and no styling work.

- **New screen `RecyclerDesk`** (recycler view, below the code form): facility picker, incoming handovers, rate editor, dataset links.
- **Props added:**
  - `RecyclerConfirm`: `initialCode`, `defaultConfirmedBy`, `onCheckFinalPrice`. It now shows synced thumbnails and a live anomaly badge.
  - `Handover`: `priceFlag`.
  - `NewLotResult`: `condition` and `sourceType` (chip rows on the weight step).
- **Ledger row:** now shows the recycler name.
- **Models, additive only:**
  - `SyncOp` gains `updateRecyclerRates`.
  - `TraceabilityRecord` gains optional `photoThumbnails`.
- **`src/logic/*` untouched.** New rules live in `src/services/serverCore.ts`.
- **Double-tap bug fixed at the data layer:**
  - `markPaid` is idempotent inside its IndexedDB transaction, so cash-then-digital or a double tap records one payment.
  - `recyclerConfirm` won't queue a duplicate confirmation.
  - The confirm button also has a ref guard.
  - A regression test covers all of this.

## Notes for the design pass

- Markup uses semantic class hooks (`.btn-primary`, `.lot-card`, `.recycler-card`, `.handover-code`, `.anomaly-badge`, `.status-<status>`, …) with minimal Tailwind utilities. Placeholder CSS is in `src/index.css`.
- Category icons are emoji in `CATEGORY_ICONS` (`src/i18n/strings.ts`).

## Still not verified — check on the actual demo phone tonight

I had no access to a physical phone. Run the tested script above once on the demo phone, installed via option 1 or 2 and in real airplane mode, and check each item:

- [ ] `capture="environment"` opens the rear camera, and the photo appears on the valuation and handover screens.
- [ ] The location prompt appears. Answer it once each way (allow now, deny on a later run).
- [ ] 🔊 in हिन्दी plays a Hindi voice, or the English fallback.
- [ ] With airplane mode on, swipe the app away and reopen it: it loads.
- [ ] Steps 9–11 flip the lot to Confirmed after airplane mode is turned off.

## Gap analysis vs. the problem statement

| Requirement | Status |
|---|---|
| Photograph, categorize, lot, weight, instant value | ✅ plus optional condition / source type (Material dataset) |
| Price dataset + trends + spoken price board | ✅ 60-day seed; grows from confirmed sales and recycler rate changes. **Single city (Nagpur)**, so there's no per-location board |
| Material / transaction / recycler / traceability / collector datasets | ✅ separate IndexedDB stores on the phone; server exports all of them as CSV/JSON (pseudonymized) |
| Rank authorized recyclers by location, category, rate, pickup, authorization | ✅ (service area is shown but not used in ranking) |
| Verifiable handover (photos, weight, timestamp, GPS, reference) confirmed by the recycler | ✅ SHA-256 re-checked on the recycler's device **and** on the server; photo thumbnails reach the recycler's phone |
| Recycler-side interface | ✅ code lookup + verification, incoming worklist, confirm with final price and payment method, publish rates |
| Earnings ledger (transactions, payments, dues) | ✅ with recycler name; cash is first-class, and double taps are safe |
| AI/ML: classification, valuation, matching, anomaly | ⚠️ valuation, matching and anomaly are **transparent rules** (weighted score, market band, 40% threshold) on both recycler quotes and final sale values. **Image classification is not built**: the category grid is where an on-device model would plug in once field images exist |
| Safety guidance (pictorial + audio) | ✅ 5 cards, en/hi/mr, 🔊 with English fallback |
| Marathi + Hindi, low literacy | ✅ icon grid, big stepper, audio. ⚠️ **No voice input** ("say a material, hear the rate"): browser speech recognition needs the network on most Android phones |
| Offline-first sync | ✅ queue in IndexedDB, service worker app shell, background sync / online event / Sync now |
| Entry-level Android, small size | ✅ PWA of about 240 KB JS (about 75 KB gzipped), no install needed |
| Cash first, digital optional | ✅ |
| **Field research (2 collectors), unit-economics assessment, AI training-data description** | ❌ **Not code.** These are team deliverables the statement explicitly requires. The exports under `/api/export/*` give the raw numbers for the unit-economics comparison |

## Known limits (deliberate — say so in the pitch)

- **Without `VITE_API_URL`, the mock server lives in browser storage.** The collector and recycler must then use **the same browser on the same device**: the recycler view (`?role=recycler`) or a second tab. **Two separate phones sync only when the app is built with `VITE_API_URL` pointing at the deployed server** (see "Backend").
- **The backend has no login.** Recyclers pick their facility from a list, and anyone with the URL can confirm a code. That's fine for a prototype; production would need recycler accounts (e.g. Google sign-in) and a server-side signature instead of the plain hash.
- **Full-size photos stay on the phone.** Only about 200 px thumbnails sync.
- There's no image classifier yet. The category picker is where an on-device model would plug in.
- There's no payment gateway. Cash is recorded with a "cash received" toggle, and the recycler records the payment method when confirming.
- The hash identifies the record and detects tampering, but it is not a signature.
