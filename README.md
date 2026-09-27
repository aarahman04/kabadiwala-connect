# Kabadiwala Connect (SIH26229)

Offline-first PWA for informal e-waste collectors: photograph and price a lot, find authorized recyclers, and record a verifiable handover. Supports Hindi, Marathi and English.

## Run

```bash
npm install
npm run dev            # http://localhost:5173 (no service worker in dev)
npm test               # logic unit tests + full offline→sync flow test
npm run build && npm run preview          # production build on http://localhost:4173, service worker active
npm run dev:server     # API on http://localhost:8787 (memory store; set DATA_FILE or DATABASE_URL to persist)
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

### Deploying the backend (Railway) and pointing the app at it

1. **Railway:** New Project → Deploy from GitHub repo (`kabadiwala-connect`). `railway.json` sets the build command (`npm run build:server`), the start command (`npm run start:server`) and the health check (`/api/health`).
2. **Railway:** add a **Postgres** database to the same project.
3. **Railway, on the API service's Variables:**
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`. That is the private-network URL, so no TLS is needed.
   - `ADMIN_TOKEN` = any secret, for the reset endpoint.
   - Optionally `CORS_ORIGIN` = your Vercel URL; the default is `*`.
4. **Railway:** Settings → Networking → Generate Domain.
   - Check `https://<api-domain>/api/health` shows `"store":"postgres"`.
5. **Vercel:** Project → Settings → Environment Variables → `VITE_API_URL` = `https://<api-domain>` (no trailing slash).
6. **Vercel:** **redeploy.** Vite bakes the variable in at build time, so an existing deployment won't pick it up.
7. **Check:** in the app, **Recycler view** shows "🌐 Shared server". It says "💻 Demo server in this browser only" when the variable is missing.
8. Reset server data before the demo:

   ```bash
   curl -X POST https://<api-domain>/api/admin/reset -H "Authorization: Bearer $ADMIN_TOKEN"
   ```

   The in-app **Reset demo data** button only clears that phone.

## Getting it onto the demo phone

Offline cold-start needs a **service worker**, and a service worker needs a **secure context**. Options, best first:

1. **USB port forwarding (recommended, no certificate issues).** Run `npm run build && npm run preview` on the laptop. Plug the Android phone in over USB with USB debugging on. In desktop Chrome, open `chrome://inspect/#devices`, enable **Port forwarding**, and map `4173` to `localhost:4173`. On the phone, open `http://localhost:4173`. Chrome treats `localhost` as secure, so the service worker installs. Load the app once; after that it works with the cable out and airplane mode on.
2. **Deploy to any HTTPS host.** `dist/` is a static site (for example, Vercel). This is the only option that works on phones without a laptop.
3. **Chrome flag.** On the phone, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure` and add `http://<laptop-LAN-IP>:4173`. On the laptop, run `npx vite preview --host`.

⚠️ `npm run preview:phone` uses a self-signed HTTPS certificate. It serves the pages, but **Chrome refuses to register a service worker on an origin with a certificate error, even after you click through the warning.** Offline cold-reload won't work that way, so use it only for camera and GPS checks. I haven't tested this on a phone; it's standard Chrome behaviour.

## Demo script — tested in real Chrome

I ran this click by click in real desktop Chrome (headless, 390×844 viewport) against `npm run preview`. The run used the real service worker, a real network cutoff, an offline cold reload and real IndexedDB photo blobs. GPS was tested three ways: granted, denied, and a prompt that was never answered. Labels below are English. **The app starts in Hindi on first launch.** Tap **English** in the header, or demo in Hindi (बेचें = Sell, कमाई = Earnings).

**Setup:** open the app once **while online** so it gets cached. If it isn't a fresh install, tap **Reset demo data** at the bottom of Home.

1. Turn on **airplane mode**. The header shows 🔴 Offline. (On a laptop, tick **Demo: simulate offline** instead.)
2. *(Optional)* Pull to refresh. The app still loads, from cache.
3. Tap **Sell** in the bottom bar, then **📷 Take photo**. Take the picture, then tap **Continue →**.
4. Tap the **Wires & cables** tile, then tap **+1**. The weight goes from 5 to 6 kg and the ₹ estimate updates live. Tap **Estimated value →**.
5. The valuation screen shows the photo, the ₹ estimate, the market range and a 60-day trend (cable ▲ about 8%). Tap **🔊 Hear price**.
6. Tap **Find authorized recyclers**. You should see 6 authorized recyclers and a note saying 2 unauthorized or pending buyers are hidden. **Manewada Scrap Mart** shows the ⚠️ below-market badge. Tap **Choose** on the top recycler.
7. Tap **📷 Take photo** for the handover photo. Wait for "📍 Location captured" or "GPS unavailable — approximate location used" (10 seconds at most). Tap **Create handover record**.
8. The big `KC-XXXXXX` code appears with ⏳ *Waiting for recycler confirmation* and "💾 Saved on phone". The header shows "N waiting to sync". Tap **🔊 Read code aloud**.
9. Tap **← Home**, then **♻️ Recycler view** at the bottom. Stay offline and in the same browser.
   - Type the code (case and dash don't matter) and tap **Look up**. You should see "✅ Record fingerprint verified" with the category, weight and photos.
   - Payment defaults to **Cash**. Tap **Confirm handover**. You should see "💾 Confirmation saved…".
10. Tap **Switch to collector app** and open the lot on Home. It still shows ⏳ *Awaiting confirmation*, which is correct while offline.
11. Turn airplane mode **off**. **Sync starts by itself** on reconnect; **Sync now** is only a backup. Within 2–5 seconds the lot flips to ✅ *Confirmed by …* with **Paid ₹…**, and the header shows "All synced".
12. Tap **Earnings**. The new entry shows ✅ Received and the totals have updated. Optionally show **Prices** (7 rows with trend lines) and **Safety** (5 cards, each with 🔊).

Results from that run:
- The offline cold reload worked.
- The recycler lookup verified the hash.
- After reconnecting, the transaction went from `handed_over` to `confirmed`, and the ledger entry from `pending` to `settled`.

## Two-phone demo (needs the shared backend)

Tested with two separate Chrome profiles against the built server; they share no storage, so they behave like two phones. The judge can hold the recycler phone.

1. **Recycler phone:** open `<app-url>/?role=recycler`, then choose the facility, e.g. *Sitabuldi Electronics Scrap Hub*.
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
| `server/` | Node API (`app.ts` routes + CSV export, `store.ts` Postgres/file/memory persistence), bundled by `npm run build:server` |
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
