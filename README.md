# Kabadiwala Connect (SIH26229)

Offline-first PWA for informal e-waste collectors: photograph and price a lot, find authorized recyclers, and record a verifiable handover. Supports Hindi, Marathi and English.

## Run

```bash
npm install
npm run dev            # http://localhost:5173 (no service worker in dev)
npm test               # logic unit tests + full offline→sync flow test
npm run build && npm run preview          # production build, service worker active
npm run build && npm run preview:phone    # self-signed HTTPS on the LAN, for a real phone
```

A phone needs **HTTPS** (`preview:phone`, or deploy it). Over plain `http://<LAN-IP>` it has no service worker, so offline mode won't work. Load the app once while online so the shell gets cached. After that it opens in airplane mode.

## Demo script (definition of done)

1. Load the app online once, then turn on airplane mode. On a laptop, tick **Demo: simulate offline** instead.
2. Go to **Sell**: take a photo, pick a category tile, set the weight, then tap **Hear price**.
3. Tap **Find authorized recyclers** and choose one. Manewada Scrap Mart shows the anomaly badge for PCB and cable.
4. Take the handover photo, then tap **Create handover record**. The large `KC-XXXXXX` code appears.
5. Go to **Home → Recycler view** (`?role=recycler`). Enter the code: the fingerprint is verified. Then confirm with cash. The confirmation is queued.
6. Go back online and tap **Sync now**. The transaction moves from *Awaiting confirmation* to *Confirmed*, and the ledger entry is settled.

**Reset demo data** (Home, bottom) wipes local data and the mock server.

## Layout

| Path | What |
|---|---|
| `src/data/models.ts` | Dataset interfaces (brief §3) plus sync types |
| `src/data/db.ts` | IndexedDB: one store per dataset plus `ledger`, `syncQueue`, `settings` |
| `src/data/seed.ts` | 10 Nagpur recyclers (fictional), 38 price rows over 60 days, 1 confirmed demo transaction |
| `src/data/actions.ts` | All writes. Each write and its sync-queue entry go in one IDB transaction |
| `src/data/syncRunner.ts` | Flushes the queue, then pulls confirmations, recyclers and prices. Triggered by Sync now, the `online` event, Background Sync, and after writes |
| `src/logic/*.ts` | Pure functions, tested: `ranking`, `valuation`, `anomaly`, `hashing`, `sync`, `geo` |
| `src/services/api.ts` | Mock backend (localStorage + fake latency). Replace this one file to use a real API |
| `src/hooks/*` | `useLots`, `useLot`, `useRecyclers`, `usePrices`, `useLedger`, `useSyncQueue` |
| `src/screens/*` | Screens that render from typed props and callbacks only |
| `src/i18n/strings.ts` | en / hi / mr strings, category names, safety cards |
| `service-worker.js` | Precaches the app shell (asset list injected at build) |

## Notes for the design pass

- Markup uses semantic class hooks (`.btn-primary`, `.lot-card`, `.recycler-card`, `.handover-code`, `.anomaly-badge`, `.status-<status>` …) with minimal Tailwind utilities. Placeholder CSS lives in `src/index.css`.
- Category icons are emoji in `CATEGORY_ICONS` (`src/i18n/strings.ts`).

## Known limits (deliberate, say so in the pitch)

- The mock server is per-browser (localStorage). The collector and recycler must use the same browser: the same tab via `?role=recycler`, or two tabs. Two separate phones need a real backend.
- There is no image classifier yet. The category picker is where an on-device model would plug in.
- There is no payment gateway. Cash is recorded with a "cash received" toggle, and the recycler records the payment method when confirming.
- A hash identifies the record and detects tampering. It is not a signature.
