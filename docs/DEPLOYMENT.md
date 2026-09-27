# Deployment

Three pieces:

- **Frontend**: Vercel, the static PWA.
- **Backend**: Railway, the `backend/` folder.
- **Database**: Supabase Postgres.

The frontend works without the backend (single-browser mock mode). The backend works without Supabase (in-memory or file storage), so each layer can be brought up on its own.

## 1. Supabase (database)

Project: `gdfcppandcypjqycqxtu`.

1. Dashboard → **SQL Editor**. Paste and run each file in `database/` **in order**:
   - `01_users.sql`: `kc_profiles` for Supabase Auth, with RLS and a signup trigger. Supabase only.
   - `02_helpers.sql` … `10_security.sql`: dataset tables, the collectors view, RLS.
   - `11_seed_recyclers.sql`, `12_seed_prices.sql`: demo data.
   - `13_useful_queries.sql`: read-only analysis. Run any block on its own.

   Files 02–12 are idempotent. The API server also applies 02–10 and seeds on first boot if the tables are empty, so running them by hand is optional (but makes the tables visible straight away).
2. **Connection string for Railway:** Dashboard → **Connect** → choose the **Session pooler** URI (IPv4, works from Railway). It looks like this:
   ```
   postgresql://postgres.gdfcppandcypjqycqxtu:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
   The direct connection (`db.<ref>.supabase.co`) is IPv6-only, and Railway may not reach it.
3. **CA certificate:** Dashboard → Project Settings → Database → **SSL Configuration** → Download certificate. Its contents go into `DATABASE_CA`. TLS verification stays **on**; don't disable it.

## 2. Railway (backend)

The service deploys from this GitHub repo.

1. Service → Settings → **Root Directory = `backend`**.
   - Railway then uses `backend/package.json` (dependency: `pg` only) and `backend/railway.json`.
   - Start is `npm start`, i.e. `node dist/server.mjs`; the health check is `/api/health`.
   - There's no build step. `dist/server.mjs` is prebuilt and committed; see DEVELOPMENT.md.
   - Remove any custom build/start commands set earlier in the dashboard.
2. Variables:

   | Var | Value |
   |---|---|
   | `DATABASE_URL` | Supabase Session pooler URI (above) |
   | `DATABASE_SSL` | `require` |
   | `DATABASE_CA` | contents of the Supabase CA `.crt` (multi-line paste, or with `\n` escapes) |
   | `ADMIN_TOKEN` | any long random string (enables `POST /api/admin/reset`) |
   | `CORS_ORIGIN` | `https://kabadiwala-connect-olive-six.vercel.app` (default `*`) |
   | `PORT` | set by Railway automatically |

   Alternative: use Railway's own Postgres instead of Supabase. Set `DATABASE_URL=${{Postgres.DATABASE_URL}}` (private network) and **omit** `DATABASE_SSL`.
3. Settings → Networking → **Generate Domain**. Check `https://<domain>/api/health`. It should say `"store":"postgres"` with `recyclers: 10`. If it says `memory`, `DATABASE_URL` isn't set, and data would be lost on restart.
4. To reset demo data before presenting:
   ```bash
   curl -X POST https://<domain>/api/admin/reset -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```
   The reset truncates the `kc_*` tables and re-seeds them. `kc_profiles` isn't touched.

## 2b. Railway (classifier, optional)

- Add a second service from the same repo with **Root Directory = `classifier`**. `railway.json` starts uvicorn, with a 600 s health-check timeout for the first model download.
- It needs about 2 GB of RAM, or set `CLASSIFIER_DTYPE=bfloat16` for about 1 GB.
- Generate a domain, then on the **backend** service set `CLASSIFIER_URL=https://<classifier-domain>`.
- Without it the app works exactly as before: `/api/classify` returns 503, and the collector picks the category manually.
- Details are in `classifier/README.md`.

## 3. Vercel (frontend)

Live at https://kabadiwala-connect-olive-six.vercel.app/ and auto-deploys from `main`. Vercel runs `npm run build` (`tsc -b && vite build`) and serves `dist/`.

1. Project → Settings → Environment Variables → **`VITE_API_URL` = `https://<railway-domain>`**. Use no trailing slash, for Production and Preview.
2. **Redeploy.** Vite inlines the variable at build time, so an existing deployment won't pick it up.
3. Check: open `/?role=recycler`. The recycler view shows "🌐 Shared server"; "💻 Demo server in this browser only" means the variable is missing.

## Phones

Open the Vercel URL once while online, so the service worker caches the app. After that, airplane mode works, including a cold start. The collector phone and the recycler phone can be different devices once `VITE_API_URL` is set.

If the venue has no internet, there are two fallbacks:
- the single-phone flow: the recycler view on the same phone, syncing later;
- a laptop serving `npm run preview`, with USB port forwarding (`chrome://inspect` → Port forwarding 4173).

## Local stack

```bash
npm run dev:backend                                 # API :8787, memory store
DATA_FILE=.data/state.json npm run dev:backend      # persisted to a JSON file
DATABASE_URL=postgres://... npm run dev:backend     # any Postgres
VITE_API_URL=http://localhost:8787 npm run dev      # client against it
```
