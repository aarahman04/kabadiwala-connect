# Kabadiwala Connect (SIH26229)

Offline-first PWA for informal e-waste collectors: photograph and price a lot, find authorized recyclers, and record a verifiable handover. Supports Hindi, Marathi and English.

## Run

```bash
npm install
npm run dev            # http://localhost:5173 (no service worker in dev)
npm test               # logic unit tests + full offline→sync flow test
npm run build && npm run preview          # production build on http://localhost:4173, service worker active
```

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

## Contingency box — if it breaks live

| Failure | What you'll see | What to do on stage |
|---|---|---|
| No Hindi/Marathi TTS voice on the phone | 🔊 speaks the **English** sentence instead (automatic fallback). Tested: this laptop's Chrome has only English voices. | "Voice packs are a device setting; we fall back to English." To fix beforehand: Android Settings → Text-to-speech → Google engine → install Hindi (it also reads Marathi). |
| 🔊 completely silent | Nothing plays (TTS is off or media volume is 0) | Turn up **media** volume. Otherwise read the number off the screen, where it's shown large. |
| GPS denied, or prompt ignored | "📍 GPS unavailable — approximate location used" at once (denied) or within 10 seconds (ignored). The record is marked `(≈)`. It never blocks the flow. | "Approximate location is flagged in the record." To avoid it, grant location permission before the demo. |
| Camera opens a file picker instead of the camera | A gallery or file chooser | Pick any gallery photo; the flow is the same. In step 3 only, you can also tap **No camera? Continue without photo** (the handover photo in step 7 is still required). |
| Page reloads after taking a photo (low memory) | You land back on Home and the lot wasn't created | Tap **Sell** again. Close other apps before the demo. |
| App won't open in airplane mode | Chrome's "No internet" dinosaur | The service worker never installed (plain http, or a self-signed certificate). Turn networking back on, switch to the laptop tab, and use **Demo: simulate offline**. See "Getting it onto the demo phone". |
| Sync doesn't flip to Confirmed | Still ⏳ after going online | Tap **Sync now**. Check that the recycler confirmed **in the same browser**; the mock server is per-browser. |
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
| `src/services/api.ts` | Mock backend (localStorage + fake latency). Replace this one file to use a real API |
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

## Known limits (deliberate — say so in the pitch)

- **The mock server lives in browser storage (localStorage).** The collector and recycler must use **the same browser on the same device**, either via the recycler view (`?role=recycler`) or a second tab. **Two separate phones will NOT sync with each other.** That needs a real backend, which means replacing `src/services/api.ts`.
- There's no image classifier yet. The category picker is where an on-device model would plug in.
- There's no payment gateway. Cash is recorded with a "cash received" toggle, and the recycler records the payment method when confirming.
- The hash identifies the record and detects tampering, but it is not a signature.
