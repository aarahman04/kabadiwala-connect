# Build Prompt — Kabadiwala Connect (SIH26229) — Core Functionality

**Give this whole file to Opus 5.5 as its instructions.** Codex is handling visual design/styling separately — your job is data models, logic, state, offline behavior, and wiring, not pixel polish. Leave visual styling minimal/placeholder (plain Tailwind utility classes) so Codex can restyle without fighting your markup.

## 0. Context (problem statement, condensed)

Informal e-waste collectors in India don't know fair prices, which recyclers are authorized, or how to get a documented handover — so material goes to unsafe backyard processing instead of formal recyclers. Build a vernacular (Hindi/Marathi), low-literacy, offline-tolerant app where a collector:
1. Photographs + categorizes a material lot (CRTs, LCDs, PCBs, cables, batteries, motors/magnets, mixed plastics), enters approx weight
2. Gets an instant valuation from a transparent price board (with spoken price)
3. Gets a ranked list of nearby authorized recyclers
4. Completes a verifiable, GPS+timestamp+photo handover record, confirmable by the recycler
5. Sees an earnings ledger update

Everything must work offline and sync later. Cash is a first-class payment option, not a fallback.

## 1. Decision already made: this is a PWA, not native

React + Vite, mobile-first responsive layout, installable via manifest.json + service worker. IndexedDB for local storage, background sync (or manual "sync now" if `SyncManager` support is flaky) when connectivity returns. Do not reach for Flutter/React Native — no time to debug native builds before tomorrow.

## 2. Tech stack

- React 18 + Vite + TypeScript
- IndexedDB via `idb` (thin wrapper) — do not use localStorage for anything beyond a settings flag; the datasets need to survive and be queryable offline
- Web Speech API (`speechSynthesis`) for spoken prices/safety guidance — works fully offline in Chrome once the page has loaded, no network dependency
- `crypto.subtle.digest` (SHA-256) for handover record hashes — no backend crypto needed
- Simple i18n: a `strings.ts` dictionary keyed by `en | hi | mr`, no i18n library needed for a 1-day build
- No real backend needed for the demo: build a `services/api.ts` with an in-memory/localStorage-backed mock server (recycler list, price history) that pretends to be a network call (with `await new Promise(r=>setTimeout(r, ...))` latency) so the offline/sync logic is real and demoable, and swapping in a real backend later is a one-file change

## 3. Data models — implement these exactly (they map straight to the problem statement's required datasets)

```typescript
type MaterialCategory = 'CRT' | 'LCD_PANEL' | 'PCB' | 'CABLE' | 'BATTERY' | 'MOTOR_MAGNET' | 'MIXED_PLASTIC';

interface MaterialLot {
  lotId: string;            // uuid, generated client-side offline
  collectorId: string;
  category: MaterialCategory;
  subCategory?: string;
  description?: string;
  imageBlob: Blob;          // stored in IndexedDB, not uploaded for demo
  approxWeightKg: number;
  condition?: string;
  sourceType?: string;
  estimatedValue: number;   // computed from PriceBoard
  status: 'draft' | 'valued' | 'matched' | 'handed_over' | 'confirmed' | 'paid';
  createdAt: number;
  location?: { lat: number; lng: number };
}

interface PriceEntry {
  category: MaterialCategory;
  subCategory?: string;
  location: string;
  date: number;
  buyingPrice: number;
  quotedPrice?: number;
  unit: 'kg' | 'unit';
  recyclerId?: string;
  marketRangeLow: number;
  marketRangeHigh: number;
}

interface Recycler {
  recyclerId: string;
  name: string;
  location: { lat: number; lng: number; address: string };
  materialsAccepted: MaterialCategory[];
  authorizationStatus: 'authorized' | 'pending' | 'unauthorized';
  authorizationId?: string;
  contact: string;
  offeredRates: Partial<Record<MaterialCategory, number>>;
  pickupAvailable: boolean;
  serviceArea: string;
}

interface Transaction {
  transactionId: string;
  lotId: string;
  collectorId: string;
  recyclerId: string;
  quotedPrice: number;
  finalPrice?: number;
  collectionLocation: { lat: number; lng: number };
  handoverLocation?: { lat: number; lng: number };
  dateTime: number;
  paymentStatus: 'pending' | 'paid_cash' | 'paid_digital';
  transactionStatus: 'pending' | 'handed_over' | 'confirmed' | 'disputed';
}

interface TraceabilityRecord {
  lotId: string;
  photoBlobs: Blob[];
  weight: number;
  timestamp: number;
  location: { lat: number; lng: number };
  handoverReference: string;   // human-readable short code, e.g. KC-8F3A2C
  handoverHash: string;        // sha256 of (lotId+weight+timestamp+lat+lng+collectorId+recyclerId)
  recyclerConfirmation?: { confirmedAt: number; confirmedBy: string };
  status: 'pending_confirmation' | 'confirmed';
}

interface CollectorProfile {
  collectorId: string;
  preferredLanguage: 'en' | 'hi' | 'mr';
  operatingLocation: string;
  // no name/phone/address required — keep this minimal per the problem statement's privacy note
}

interface LedgerEntry {
  entryId: string;
  lotId: string;
  amount: number;
  type: 'earning' | 'due';
  status: 'pending' | 'settled';
  date: number;
}
```

All six datasets (Material, Price, Recycler, Transaction, Traceability, Collector) get their own IndexedDB object store. Do not merge them into one blob — the judges will ask about the datasets specifically, and separable stores make that answer concrete.

## 4. Feature build order — this is the actual priority list for tomorrow, don't reorder it

**Tier 1 — must work, this is the whole demo:**
1. Language toggle (en/hi/mr) — swaps `strings.ts` lookups app-wide, persisted in a settings store
2. New lot flow: camera capture (`<input type="file" accept="image/*" capture="environment">`) → category picker (icon grid, not a dropdown — low literacy) → weight entry (large numeric stepper, not a keyboard) → instant valuation screen showing price with a "🔊 speak price" button wired to `speechSynthesis`
3. Recycler match + rank screen: filter `Recycler[]` by `materialsAccepted` includes lot category and `authorizationStatus === 'authorized'`, then rank by a scoring function — implement this as one pure function you can unit-test:
   ```typescript
   function rankRecyclers(lot: MaterialLot, recyclers: Recycler[]): Recycler[] {
     // score = normalized(offeredRate) * 0.5 + normalized(1/distance) * 0.3 + (pickupAvailable ? 0.2 : 0)
   }
   ```
4. Handover flow: capture confirmation photo, grab GPS via `navigator.geolocation`, generate `TraceabilityRecord` with hash, show the human-readable reference code big on screen (this is the "wow" moment in the demo — show it working with airplane mode on, then reconnecting and syncing)
5. Recycler-side confirmation screen: a second simple view (can be a `?role=recycler` route in the same app) where entering/scanning the reference code marks the record `confirmed` and settles the ledger entry
6. Earnings ledger: list view of `LedgerEntry[]`, running total, pending vs settled split
7. Offline queue + sync: a `SyncQueue` in IndexedDB; every write while offline gets queued; on `window.ononline` (or a manual "Sync now" button — safer for a live demo than relying on real network events), flush the queue against `services/api.ts` and update statuses

**Tier 2 — do these only if Tier 1 is solid with time to spare:**
8. Price trend mini-chart (sparkline) on the valuation screen
9. Safety guidance screen — a handful of pictorial cards with an audio button, static content, no logic needed
10. Basic anomaly flag: if `quotedPrice` deviates >40% from `marketRangeLow/High` for that category, show a warning badge — this is your one visible "AI/ML" touchpoint for the demo

**Explicitly do NOT build tonight** (say this out loud in the presentation instead — judges respect scoped honesty more than an over-promised broken feature):
- Real trained image classification model — stub it: on photo capture, just let the user confirm/pick the category from the icon grid; describe in the pitch that this is where a lightweight on-device model (e.g. MobileNet fine-tuned on a collector-labeled dataset) plugs in once you have field images
- Real payment gateway integration — cash + a manual "mark paid" toggle is enough
- Multi-tenant auth/accounts — a single local `collectorId` generated on first launch is fine for a prototype

## 5. Seed data (build this too — you need believable mock data for the live demo)

Write a `seed.ts` that populates on first load with:
- 8–10 recyclers around one real city (pick Nagpur or Pune — matches Marathi/Hindi target), mix of authorized/pending, varied `materialsAccepted` and rates
- 30–40 `PriceEntry` rows across all 7 categories, spanning the last ~60 days, with a believable trend (e.g. copper cable price drifting up 8% over the period) so the sparkline in Tier 2 has something real to show
- One pre-seeded confirmed transaction so the ledger screen isn't empty on first launch

## 6. Interface contract for Codex (design) — don't let logic and styling fight each other

- Every screen is a component that takes typed props and emits typed callbacks — no inline business logic in JSX beyond simple conditionals. Put all scoring/valuation/hashing/matching logic in `/src/logic/*.ts`, pure functions, unit-testable, zero DOM/React imports in those files.
- Components render from props only; they call hooks like `useLots()`, `useRecyclers()`, `useLedger()` (thin wrappers around the IndexedDB stores) for data, never touch `indexedDB` directly.
- Use semantic, unstyled-by-default markup (plain `<button>`, `<div className="lot-card">`) so Codex's CSS pass is additive, not a rewrite. Don't hand-roll one-off inline styles that Codex then has to hunt down and override.
- Icons/imagery: use placeholder emoji or simple SVG shapes for material categories for now (🔌 cable, 🔋 battery, etc.) — Codex will replace with real iconography.

## 7. File structure

```
/src
  /logic       -> ranking.ts, valuation.ts, hashing.ts, sync.ts (pure, tested)
  /data        -> db.ts (IndexedDB setup), seed.ts, models.ts (the interfaces above)
  /services    -> api.ts (mock backend)
  /hooks       -> useLots.ts, useRecyclers.ts, useLedger.ts, useSyncQueue.ts
  /screens     -> NewLot.tsx, Valuation.tsx, RecyclerMatch.tsx, Handover.tsx, RecyclerConfirm.tsx, Ledger.tsx, Safety.tsx
  /i18n        -> strings.ts
  App.tsx
manifest.json
service-worker.js
```

## 8. Definition of done for tomorrow

You can hand a phone to a judge, put it in airplane mode, walk through steps 2–6 of the demo flow above end to end, turn wifi back on, hit "Sync now," and see the transaction move from `pending` to `confirmed` with a matching entry in the ledger. Everything else is bonus.
