# Data model

The problem statement asks for six datasets. Each one has its own IndexedDB object store on the phone and its own Postgres table on the server. Interfaces are in `src/data/models.ts`.

| Dataset (statement) | Interface | IndexedDB store (key) | Postgres table (key) |
|---|---|---|---|
| Material | `MaterialLot` | `materials` (`lotId`) | `kc_lots` (`lot_id`) |
| Price | `PriceEntry` | `prices` (auto id) | `kc_prices` (`price_key` = md5 of row, append-only) |
| Recycler | `Recycler` | `recyclers` (`recyclerId`) | `kc_recyclers` (`recycler_id`) |
| Transaction | `Transaction` | `transactions` (`transactionId`) | `kc_transactions` (`transaction_id`) |
| Traceability | `TraceabilityRecord` | `traceability` (`lotId`, index `byReference`) | `kc_traceability` (`handover_reference`) |
| Collector | `CollectorProfile` | `collectors` (`collectorId`) | view `kc_collectors` (aggregated from lots + transactions) |

Plus, on the phone: `ledger` (`LedgerEntry`), `syncQueue` (`SyncQueueItem`) and `settings` (collectorId, language, role, recyclerId, lastSyncAt, seeded).
Plus, on the server: `kc_confirmations`, `kc_flags` (anomaly output), `kc_audit` (every accepted write), and `kc_profiles` (Supabase auth users).

## Postgres table pattern

Every `kc_*` table stores the app record exactly as it syncs, in `data jsonb`. It also has **generated columns** extracted from it (`category`, `weight_kg`, `observed_at`, …). That gives:
- one write path (the server upserts `data`);
- normal SQL for analysis;
- no mapping layer that can drift.

Times are epoch milliseconds in the app, turned into `timestamptz` by the immutable helper `kc_ms()`. RLS is enabled with no policies, so Supabase's public REST API can't read these tables. The backend connects as the owner.

`kc_profiles` (from `01_users.sql`) is different. It's a plain table keyed by `auth.users.id`, with:
- `role`: collector / recycler / admin;
- `preferred_language`, `operating_location`, `collector_id` and `recycler_id`;
- `recycler_verified`, which only an admin can set.

Its RLS lets a user read and update only their own row, and they can't make themselves admin. A trigger creates the row on signup.

## Status machines (forward-only, see `logic/sync.ts`)

- Lot: `draft → valued → matched → handed_over → confirmed → paid`
- Transaction: `pending → handed_over → confirmed` (`disputed` is terminal)
- Traceability: `pending_confirmation → confirmed`
- Ledger entry: `due/pending` until the handover is confirmed and paid, then `earning/settled`. The collector's "cash received" toggle also settles it.
- Payment: `pending | paid_cash | paid_digital`. Cash is first-class.
- Pickup (`Transaction.pickup`): `requested → accepted → on_the_way → arriving → completed`, or `declined` from requested/accepted. A declined request can be re-sent. The history of every step, with timestamps, is kept in `pickup.history`. The server refuses pickups for drop-off-only recyclers and updates from any facility other than the chosen one.

## Sync ops (`SyncOp`, client → `POST /api/ops`)

| kind | Sent when | Server rule |
|---|---|---|
| `upsertLot` | lot created or its status changes | valid category, 0 < weight ≤ 5000 kg |
| `upsertTransaction` | recycler chosen, handover | recycler exists **and is authorized**; a server confirmation wins over a stale copy |
| `upsertTraceability` | handover created | **SHA-256 re-computed, mismatch rejected**; ≤ 4 thumbnails, each < 60 KB; applies a held confirmation |
| `confirmHandover` | recycler confirms | stored; applied to the record and transaction if known; adds a price row; flags anomalies |
| `markPaid` | collector marks cash/digital received | first payment wins |
| `requestPickup` | collector taps Request pickup | recycler must offer pickup; an active request is a no-op; the phone number is sanitized |
| `updatePickup` | recycler taps Accept / Decline / On my way / Arriving soon | only the chosen recycler; forward-only |
| `updateRecyclerRates` | recycler saves rates | updates the recycler; each rate becomes a dated price row |

## Anomaly rules

- **Recycler quote vs market** (match screen): `logic/anomaly.detectPriceAnomaly`. It flags a quote more than 40% below the market low or above the market high.
- **Final sale value** (server, recycler screen, collector receipt): `serverCore.transactionAnomaly`. It uses the same band test on the final price per kg, **or** flags a final price more than 40% away from the quote.

## Privacy

- Collectors are identified by a random device UUID only; there's no name or phone.
- Exports (`/api/export/*`) replace collector IDs with salted-hash pseudonyms (`C-xxxxxxxxxx`).
- Full photos never leave the phone; only ~160–200 px thumbnails sync (`MaterialLot.photoThumbnail`, `TraceabilityRecord.photoThumbnails`).
- The pickup phone number is optional, sent only for that request, and **never exported**.
