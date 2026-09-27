# Development guide

## Commands

```bash
npm install
npm run dev              # Vite dev server (no service worker)
npm test                 # vitest: logic, offline flow, HTTP backend, bundle freshness
npm run typecheck        # frontend + backend tsconfigs
npm run build            # production PWA into dist/ (what Vercel runs)
npm run preview          # serve dist/ on :4173 (service worker active)
npm run build:backend    # bundle backend/src/index.ts -> backend/dist/server.mjs (COMMIT THE RESULT)
npm run dev:backend      # build + run the API on :8787
npm run db:sql           # regenerate database/01..12 *.sql from backend/src/schema.ts + seedData
```

Run the backend suite against a real Postgres:
`KC_TEST_DATABASE_URL=postgres://… npx vitest run backend/src/server.test.ts`. That also enables the restart/persistence test.

## Rules for changing code

1. **`src/logic/*` is a stable, tested contract.** It holds pure functions only. Ask the owner before changing behaviour there.
2. **Screens take props and emit callbacks.** Codex does the visual design, so keep UI changes functional: plain elements, semantic class hooks (`btn-primary`, `lot-card`, `recycler-card`, `handover-code`, `anomaly-badge`, `status-<x>`, …) and minimal Tailwind. Never write one-off inline styles.
3. **Model changes must be additive** (new optional fields, new `SyncOp` kinds). Old queued ops and old server rows must still parse.
4. **Every write goes through `data/actions.ts`**, or `recyclerLookup.ts` for recycler writes. The store write and its `syncQueue` op go in **one IDB transaction**. Make actions idempotent where a double tap is possible.
5. **Backend rules go in `src/services/serverCore.ts`.** The in-browser mock and the Node server both run it.
6. **After touching `backend/src/*` or anything the backend imports** (`serverCore`, `logic`, `seedData`, `models`), run `npm run build:backend` and commit `backend/dist/server.mjs`. `bundle.test.ts` fails otherwise. This is a deliberate trade-off, so Railway can deploy `backend/` on its own (see DECISIONS.md, D-7).
7. **After touching `backend/src/schema.ts` or `src/data/seedData.ts`**, run `npm run db:sql` and commit `database/`. `database/13_useful_queries.sql` is hand-written.
8. **Strings:** add the key to `en` in `i18n/strings.ts`, then to `hi` and `mr`; TypeScript enforces it. Keep the Hindi and Marathi natural and simple (low-literacy users).
9. **Permissions and hardware never block a flow:**
   - GPS has a hard deadline and an approximate fallback;
   - TTS falls back to English;
   - the camera can be skipped at the lot step.

## QA method (how the "verified" claims in PROGRESS.md were produced)

- **Real Chrome, scripted:** Playwright-core driving the installed Chrome headless, with a 390×844 viewport, against `npm run preview` builds.
  - `context.setOffline(true)` for real network loss, plus `page.reload()` to prove the service worker's offline cold start.
  - Geolocation granted, denied, and a stubbed never-answering prompt.
  - A spy on `speechSynthesis.speak` to see exactly what is spoken.
  - **Two separate browser contexts** (no shared storage) act as two phones against the built backend.
  - These scripts lived in a session scratchpad and aren't in the repo; recreate them from the steps above if needed.
- **Real Postgres without Docker:** `@electric-sql/pglite` (Postgres in WASM) and `@electric-sql/pglite-socket` expose it on a TCP port for the `pg` driver. The socket server accepts **one client at a time**, and hangs after a client drops. Restart it between runs, and use an on-disk data dir to test persistence.

## Gotchas

- **Windows Git Bash:** heredocs containing emoji sometimes fail with "unexpected EOF". Write such files with an editor or a Python script instead.
- **Chrome and self-signed HTTPS:** Chrome won't register a service worker on an origin with a certificate error, so `npm run preview:phone` can't demo offline mode. Use the Vercel URL or USB port forwarding.
- **Vercel and `VITE_*` vars:** they're inlined at build time, so redeploy after changing them.
- **`dist` in `.gitignore`:** `.gitignore` ignores `dist` except `backend/dist/`, and `.gitattributes` marks the bundle `-text`, so CRLF conversion doesn't break the freshness test on Windows.
- **Hindi/Marathi TTS voices:** many devices don't have them installed; the English fallback covers that.
