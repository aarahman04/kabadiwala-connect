# Progress log & current state

_Last updated: 2026-09-28 (night before the demo)._ Update this file at the end of every working session.

## Current state in one paragraph

All Tier 1 and Tier 2 features from the build brief work:
- lot → valuation → recycler match → handover → recycler confirmation → ledger, offline first;
- en/hi/mr with spoken prices;
- a safety screen, a price board, and anomaly flags.

A shared backend (`backend/`) gives real multi-device sync, so the collector and recycler can be two phones. The **pickup flow** is built: the collector requests a pickup, and the recycler accepts, then taps On my way, then Arriving soon; the collector gets each step as a status update and a notification. Collector and recycler roles are chosen on first launch. **There is no sign-in yet.** The Postgres schema is split into numbered Supabase SQL files in `database/`, and a `kc_profiles` table is ready for Google auth. All of this is built and tested locally. **Deployment wiring (Railway root dir, Supabase env vars, Vercel `VITE_API_URL`) is waiting on the owner. See "Next steps".**

## Timeline

| Commit | What |
|---|---|
| `c203ea4` | Initial build: PWA, IndexedDB datasets, pure logic, mock API, all screens, 27 tests |
| `247ec79` | QA hardening in real Chrome: English voice fallback when no hi/mr TTS voice, GPS hard timeout (ignored prompt hung forever), sync-status text, cross-tab simulate-offline |
| `f5fa01a` | Shared backend + recycler desk + dataset completeness: `serverCore.ts` shared rules, Node API, thumbnails, rate publishing, condition/source fields, final-price anomaly, duplicate-tap payment fix |
| `9821e3f` | `backend/` folder (Railway root dir, committed bundle), relational Postgres tables, numbered `database/*.sql` for Supabase incl. `01_users.sql`, first-launch role chooser, `docs/` |
| _latest_ | **Pickup flow**:
- collector "Request pickup" with an optional phone;
- recycler inbox: Accept/Decline → On my way → Arriving soon, with a map link and 📞;
- status updates and system notifications on both phones, polling every 15 s while online;
- lot photo thumbnails;
- `kc_transactions` pickup columns (ALTER-upgrades existing tables), pickups query 11b.

Also fixed: a write made during an in-flight sync waited for the next trigger; `runSync` now runs one more pass. |
| _latest_ | **AI photo classifier.** `classifier/` is a Python FastAPI service running **SigLIP 2 zero-shot** (`google/siglip2-base-patch16-224`).
- Classes: 7 materials + Other, with confidence and top-2 margin rules.
- `POST /api/classify` on the Node backend proxies to it (`CLASSIFIER_URL`).
- The NewLot photo step suggests a category and the collector confirms. Offline or unsure, it falls back to the manual grid.
- Lots store `aiSuggestion` (DB columns `ai_label/ai_confidence/ai_model`, query 11c). |

## Verified (and how)

- **Unit and integration tests:** 41 tests in total. `npm test` runs 40. The 38th checks that the backend survives a database restart and runs only against real Postgres (it needs `KC_TEST_DATABASE_URL`). What they cover:
  - the pure logic;
  - the full offline→sync flow on fake-indexeddb;
  - double-tap safety;
  - HTTP round-trips between two simulated devices, including the pickup state machine;
  - the bundle-freshness check.
- **Real Chrome (headless, phone viewport), scripted click-throughs:**
  - the whole demo, including an **offline cold reload served by the service worker**;
  - GPS granted, denied, and a prompt that is never answered;
  - the English speech fallback;
  - **two isolated browser profiles against the real backend**: the two-phone flow, a confirmation that arrives before the collector's record, recycler rate publishing;
  - **the full pickup flow** on two profiles, with notifications captured on both sides.
- **Real Postgres (PGlite, Postgres 18 in WASM, over the `pg` wire protocol):**
  - all numbered SQL files run twice (idempotent), and the users trigger works;
  - an existing `kc_transactions` table gains the pickup columns, backfilled;
  - the backend API suite passes, and data survives a database restart;
  - `database/13_useful_queries.sql` blocks all execute.
- **The `backend/` folder in isolation:** `npm ci` and `npm start` work, and it creates the schema and seeds a real Postgres.

**Classifier smoke test (NOT an accuracy evaluation).** 9 Wikimedia photos, CPU:
- PCB 95.8%, CRT 93.2%, LCD 97.8%, Cables 94.0%, Batteries 89.6%, Motors 78.8%: all correct.
- Banana and dog → Other.
- A typewriter photo used as "mixed plastic" → **CRT 60.6% (wrong)**.
- About 230–370 ms per image on CPU; cached load about 18 s; the first download is 1.5 GB.
- Invalid uploads handled: truncated → 400, non-image → 400, GIF → 415, empty → 400. A forced `cuda` falls back to CPU.
- The full PWA → Node proxy → classifier path was verified in Chrome.

## NOT verified yet

- The actual demo **phone**: camera capture, real airplane mode, a Hindi TTS voice. The root README has a 5-item checklist for this.
- Supabase specifically: TLS with `DATABASE_CA` and the Session pooler URL. The same code ran against Postgres 18, but not against Supabase's endpoint.
- The deployed Railway + Vercel pair, end to end.

## Next steps (owner actions first)

1. **Railway:** set the service's Root Directory to `backend`, and remove any custom build/start commands from the dashboard; `backend/railway.json` has them. Set these variables:
   - `DATABASE_URL`: the Supabase **Session pooler** URI
   - `DATABASE_SSL=require`
   - `DATABASE_CA`: the Supabase CA PEM
   - `ADMIN_TOKEN`
   - `CORS_ORIGIN=https://kabadiwala-connect-olive-six.vercel.app`

   Then check that `/api/health` shows `"store":"postgres"`. See DEPLOYMENT.md.
2. **Supabase:** run `database/01…12` in order; the server would also create 02–12 on its own, but running them by hand shows the tables straight away. Use 13 for analysis.
3. **Vercel:** set `VITE_API_URL=https://<railway-domain>` and **redeploy**.
4. Run the two-phone demo script from the root README on two real phones.
5. Record the Railway domain in docs/README.md.

## Open decisions (waiting on the owner)

- **Google sign-in: recommended only for recyclers, if at all; collectors stay anonymous.**
  - The DB is ready: `01_users.sql` has `kc_profiles`, a role column, RLS and a signup trigger.
  - Not built yet: the Supabase client in the frontend, and JWT checks in the backend.
  - Reasoning is in DECISIONS.md (D-9).
- **An AI material classifier:** the owner offered to source a model and dataset. The requirements are listed in DECISIONS.md (D-10).

## Known gaps vs the problem statement

| Gap | Note |
|---|---|
| Image classification accuracy | Zero-shot SigLIP 2 is built and works on clear photos, but it is **not evaluated** on a labelled e-waste set. Mixed plastic is the weakest class. Fine-tune it on the collector-labelled lots (`aiSuggestion` vs the chosen category) |
| Notifications when the app is fully closed | Needs Web Push (VAPID + a push service). Today they work while the app is open or in the background |
| Voice input ("say material, hear rate") | Not built. Browser speech recognition needs the network on most Android phones |
| Per-location price board | Single city (Nagpur) seed data |
| Field research, unit economics, AI data description | **Team deliverables, not code.** `database/13_useful_queries.sql` #11 is a unit-economics scaffold |
| Real recycler directory | Seed recyclers are fictional. Replace with the CPCB/MPCB authorized recycler list |


## Visual design pass — 2026-09-28 (Codex)

Completed the collector and recycler visual redesign. Protected logic/data/services/hooks/backend/classifier/database files have no diff. Existing props, callbacks and QA class hooks remain. This is a local commit; no deployment or push was requested.

### Verification

- `npm run build` and `npm run typecheck`: pass. `npm test`: **46 passed, 1 skipped** (the existing 45 active tests plus one presentation regression test; the database-dependent test remains skipped).
- Chrome at **360 × 800**, en/hi/mr: **72 screen/language checks**, including photo upload, category, optional chips, weight, valuation/audio action, authorized match, offline pickup, accepted/on-the-way/arriving timeline, handover, fingerprint verification, abnormal-price warning, cash confirmation, earnings, prices, safety, rate publishing and actual offline reload. No horizontal overflow, page errors or external asset requests.
- **15 final layout checks** cover the updated SVG wordmark, facility header, home, receipt and safety across all languages. Desktop app width checked at 1280 px: centered 448 px. Reduced-motion mode checked.
- Both WOFF2 fonts and the 512 px maskable icon were confirmed in the service-worker cache. JavaScript: **89.97 KB gzip**, up **9.05 KB** from the 80.92 KB baseline, below the 60 KB addition budget. Fonts total 146.02 KB, cached locally.
- Main text/background contrast ratios: ink/paper 11.24:1, muted/paper 5.71:1, white/teal 11.73:1, action text/marigold 6.64:1, warning text/background 7.13:1.
- Emoji search is clean in presentation and translation source. One existing emoji remains in protected `src/data/seed.ts`; generated placeholder SVGs are rendered as bundled circuit-board artwork, so it is not visible.
- Browser scripts, reports and screenshots are available locally in ignored `node_modules/.cache/design/`. Physical Android camera, installed Hindi/Marathi TTS voices, classifier predictions and the deployed two-phone backend remain outside this local visual verification.

### Changed files

- `src/index.css`: Added design tokens, bundled fonts, responsive screen styles, 48/56 px controls and reduced-motion support.
- `src/App.tsx`: Replaced navigation/role-action emoji, added loading skeletons and the selected facility header; routing and callbacks unchanged.
- `src/i18n/strings.ts`: Removed emoji in en/hi/mr, preserved placeholders and added translated presentation copy and pictogram identifiers.
- `src/components/ui/Icon.tsx`: Added a small selected Lucide SVG vocabulary with a shared stroke and size.
- `src/components/ui/CategoryIcon.tsx`: Added seven distinct material SVG silhouettes.
- `src/components/ui/Brand.tsx`: Added the SVG logo, translated SVG wordmark and two role illustrations.
- `src/components/ui/SafetyPictogram.tsx`: Added five safety scenes with prohibition marks or protective equipment.
- `src/components/ui/index.tsx`: Added Button, Card, StatusPill, Stat, Stepper, SegmentedControl, EmptyState, Skeleton and Banner.
- `src/components/ui/presentation.test.ts`: Added one runnable regression check for translations, icon/status coverage, button semantics and progress cues.
- `src/components/BlobImage.tsx`: Displays generated SVG placeholders as bundled circuit artwork, keeping the protected seed untouched.
- `src/components/CategoryGrid.tsx`: Uses distinct material SVG icons and shared native buttons.
- `src/components/Header.tsx`: Added compact branding, language segments, sync status and a settings disclosure containing the original offline checkbox.
- `src/components/PhotoInput.tsx`: Added camera framing guidance, an icon action and its loading state.
- `src/components/WeightStepper.tsx`: Uses shared controls and a translated reset accessible label.
- `src/screens/RoleChooser.tsx`: Added the branded introduction and illustrated collector/recycler choices.
- `src/screens/Home.tsx`: Added an introductory panel, marigold new-lot action and icon-plus-word lot statuses.
- `src/screens/NewLot.tsx`: Added the three-step progress display, material icons, condition/source icons and classification loading treatment.
- `src/screens/Valuation.tsx`: Added the dark teal value card, high-contrast audio action and consistent navigation.
- `src/screens/RecyclerMatch.tsx`: Added best-match styling, authorization, distance/pickup icons and amber anomaly treatment.
- `src/screens/Handover.tsx`: Added timestamped pickup steps, ticket receipt, prominent code, fingerprint details and payment/status cues.
- `src/screens/Ledger.tsx`: Added earnings statistics and readable payment/transaction statuses.
- `src/screens/PriceBoard.tsx`: Added material and audio cues with consistent market rows and sparklines.
- `src/screens/Safety.tsx`: Replaced the five emoji with SVG safety pictograms and retained the audio actions.
- `src/screens/RecyclerConfirm.tsx`: Styled code lookup, fingerprint checks, anomaly feedback, native payment radios and confirmation feedback.
- `src/screens/RecyclerDesk.tsx`: Styled the pickup inbox, incoming handovers, rate editor and loading/empty states.
- `src/assets/material-placeholder.svg`: Added locally bundled circuit-board placeholder artwork.
- `public/icon.svg`: Replaced the initial icon with the new two-way K mark.
- `public/icon-192.png`: Added a maskable app icon with the mark inside the safe area.
- `public/icon-512.png`: Added the larger maskable app icon.
- `public/manifest.json`: Updated app colors and SVG/PNG icon declarations.
- `index.html`: Updated the theme color and PNG touch icon.
- `vite.config.ts`: Added both PNG icons to the existing app-shell precache.
- `package.json`: Added only lucide-react and the two locally bundled variable font packages.
- `package-lock.json`: Locked the icon/font dependencies; install reported zero vulnerabilities.
- `docs/DESIGN-PLAN.md`: Recorded the palette, type, layout, signature and verification plan.
- `docs/DESIGN-GUIDE.md`: Documented the new presentation components, preserved hooks, offline assets and verification.
- `docs/PROGRESS.md`: Recorded this design handoff without changing earlier session notes.
