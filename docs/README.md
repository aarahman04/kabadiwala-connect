# Kabadiwala Connect — project docs

**Start here if you are a new session, a new AI agent, or a new teammate.** These docs let you pick up the work without the chat history.

Kabadiwala Connect is a prototype for Smart India Hackathon problem **SIH26229**. It is an offline-first, Hindi/Marathi/English PWA. Informal e-waste collectors (*kabadiwalas*) use it to:
- price a lot of scrap,
- find an **authorized** recycler,
- record a verifiable handover,
- track their earnings.

Recyclers get their own side of the app to confirm handovers and publish rates. A small Node backend syncs everything across devices and stores it in Postgres (Supabase).

| Doc | Read it for |
|---|---|
| [PROGRESS.md](PROGRESS.md) | **Current state**: what's done, verified, deployed, pending, and the open decisions. Update it at the end of every session. |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the code works: layers, offline sync, backend, file map |
| [DATA-MODEL.md](DATA-MODEL.md) | The datasets, the IndexedDB stores, the Postgres tables, the sync ops |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Vercel (frontend), Railway (backend), Supabase (database), env vars |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Commands, tests, QA method, rules and gotchas for changing code |
| [DECISIONS.md](DECISIONS.md) | Why things are the way they are (decision log) |
| [DESIGN-GUIDE.md](DESIGN-GUIDE.md) | Users, rules, screens, class hooks and the implemented visual components |
| [DESIGN-PLAN.md](DESIGN-PLAN.md) | Palette, typography, layout and verification plan for the completed redesign |
| [CODEX-DESIGN-PROMPT.md](CODEX-DESIGN-PROMPT.md) | Original brief for the completed Codex design pass |

Other sources of truth in the repo:
- `problem details/` — the official problem statement and analysis. **Not in git**; it's the local copy only.
- `kabadiwala-connect-build-prompt.md` — the original build brief (tech stack, data models, tier list).
- `README.md` (root) — the tested demo scripts and the on-stage contingency table.
- `database/` — the SQL to paste into Supabase, in numbered order.

## Live URLs

- **Frontend:** https://kabadiwala-connect-olive-six.vercel.app/ (Vercel, auto-deploys from `main`).
- **Backend:** Railway service from this repo, with Root Directory `backend`. Put the domain in PROGRESS.md once it's known.
- **Database:** Supabase project `gdfcppandcypjqycqxtu`.
