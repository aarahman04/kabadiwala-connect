# Progress log & current state

_Last updated: 2026-09-28 (night before the demo)._ Update this file at the end of every working session.

## Current state in one paragraph

All Tier 1 and Tier 2 features from the build brief work:
- lot → valuation → recycler match → handover → recycler confirmation → ledger, offline first;
- en/hi/mr with spoken prices;
- a safety screen, a price board, and anomaly flags.

A shared backend (`backend/`) gives real multi-device sync, so the collector and recycler can be two phones. Collector and recycler roles are chosen on first launch. **There is no sign-in yet.** The Postgres schema is split into numbered Supabase SQL files in `database/`, and a `kc_profiles` table is ready for Google auth. All of this is built and tested locally. **Deployment wiring (Railway root dir, Supabase env vars, Vercel `VITE_API_URL`) is waiting on the owner. See "Next steps".**

## Timeline

| Commit | What |
|---|---|
| `c203ea4` | Initial build: PWA, IndexedDB datasets, pure logic, mock API, all screens, 27 tests |
| `247ec79` | QA hardening in real Chrome: English voice fallback when no hi/mr TTS voice, GPS hard timeout (ignored prompt hung forever), sync-status text, cross-tab simulate-offline |
| `f5fa01a` | Shared backend + recycler desk + dataset completeness: `serverCore.ts` shared rules, Node API, thumbnails, rate publishing, condition/source fields, final-price anomaly, duplicate-tap payment fix |
| _this session_ | `backend/` folder (Railway root dir, committed bundle), relational Postgres tables, numbered `database/*.sql` for Supabase incl. `01_users.sql`, first-launch role chooser, `docs/` |

## Verified (and how)

- **Unit and integration tests:** 38 tests in total. `npm test` runs 37. The 38th checks that the backend survives a database restart and runs only against real Postgres (it needs `KC_TEST_DATABASE_URL`). What they cover:
  - the pure logic;
  - the full offline→sync flow on fake-indexeddb;
  - double-tap safety;
  - HTTP round-trips between two simulated devices;
  - the bundle-freshness check.
- **Real Chrome (headless, phone viewport), scripted click-throughs:**
  - the whole demo, including an **offline cold reload served by the service worker**;
  - GPS granted, denied, and a prompt that is never answered;
  - the English speech fallback;
  - **two isolated browser profiles against the real backend** (the two-phone flow, a confirmation that arrives before the collector's record, recycler rate publishing).
- **Real Postgres (PGlite, Postgres 18 in WASM, over the `pg` wire protocol):**
  - all numbered SQL files run twice (idempotent), and the users trigger works;
  - the backend API suite passes, and data survives a database restart;
  - `database/13_useful_queries.sql` blocks all execute.
- **The `backend/` folder in isolation:** `npm ci` and `npm start` work, and it creates the schema and seeds a real Postgres.

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
| Image classification | Not built. Needs a model (see D-10); the category grid is the plug-in point |
| Voice input ("say material, hear rate") | Not built. Browser speech recognition needs the network on most Android phones |
| Per-location price board | Single city (Nagpur) seed data |
| Field research, unit economics, AI data description | **Team deliverables, not code.** `database/13_useful_queries.sql` #11 is a unit-economics scaffold |
| Real recycler directory | Seed recyclers are fictional. Replace with the CPCB/MPCB authorized recycler list |
