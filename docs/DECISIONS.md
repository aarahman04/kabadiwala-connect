# Decision log

Short records of why things are the way they are. Add new entries at the bottom.

**D-1 PWA, not native.** React + Vite + TypeScript: installable, no app store, small, and one codebase. It came from the build brief (no time to debug native builds). The statement's "entry-level Android, small size" is met: about 240 KB of JS, about 75 KB gzipped.

**D-2 Offline-first, with IndexedDB as the phone's source of truth.**
- Every write and its sync op commit in one IDB transaction.
- The queue is sent strictly in order and halts when offline.
- Statuses only ever move forward, so a stale copy can't roll a lot back.

**D-3 Transparent rules instead of ML for valuation, matching and anomalies.** The statement asks for AI "wherever sufficient training data is available", and there is none yet. Rules make the prototype explainable to judges:
- matching: a weighted score (0.5 × rate, 0.3 × proximity, 0.2 × pickup);
- anomalies: flag anything more than 40% outside the market band or away from the quote.

**D-4 SHA-256 handover fingerprint + short code `KC-XXXXXX`.**
- The recycler's device and the server both re-compute the hash, so tampering is detectable.
- It is **not** a signature. Production should sign server-side.
- A pure-JS fallback covers insecure contexts.

**D-5 Cash is first-class.** Payment happens at the recycler's confirmation (cash is the default), or through the collector's "cash received" toggle. There's no payment gateway.

**D-6 A shared backend, added the night before the demo.** Without one, the recycler role only worked in the same browser. Judges holding a second phone as the recycler is the strongest proof of the "recycler-side interface" and "confirmable by the recycler" requirements.
- The rules live in `serverCore.ts`, shared with the in-browser mock, so the two can't drift.
- Unreachable or 5xx servers look like offline to the client, so the backend can't break offline mode.

**D-7 The committed backend bundle.** Railway's Root Directory = `backend` only ships that folder, but the backend reuses frontend code (`serverCore`, `logic`, `seedData`, `models`). So `backend/dist/server.mjs` is prebuilt and committed, and `bundle.test.ts` guards against staleness. The alternative, moving the shared code under `backend/`, would have churned import paths that the Codex design pass depends on.

**D-8 Postgres tables as `data jsonb` plus generated columns.** One write path (upsert the record the app already syncs), clean SQL columns for analysis, and no ORM or mapping layer.
- The server keeps state in memory and writes through, so it's **single instance only**. That's fine for the prototype.
- RLS is on with no policies, which blocks Supabase's public REST access.

**D-9 Accounts: none for collectors; Google sign-in is optional and recycler-only. _Awaiting the owner's decision._**
- The first-launch role chooser (collector / recycler) needs no login.
- Against mandatory Google sign-in for collectors:
  - the statement stresses low literacy, minimal personal data and no added compliance burden;
  - sign-in needs a network on the very first launch;
  - it adds OAuth redirect setup and session-expiry risks during a live demo.
- For **recyclers**, sign-in has real value: it stops anyone who knows the URL from confirming codes as any facility.
- Ready: the database side (`database/01_users.sql`: `kc_profiles`, role, `recycler_verified`, RLS, signup trigger).
- Not built yet:
  - the frontend: `@supabase/supabase-js` and a "Sign in with Google" button on the recycler side;
  - the backend: verify the Supabase JWT on recycler ops and look up `kc_profiles` for the role and facility;
  - the setup: a Google Cloud OAuth client, with the redirect set to the Supabase callback and the Vercel URL added to Supabase Auth redirect URLs.
- Estimate: 1.5–2 h plus owner setup.

**D-10 Material image classifier: not built. Here is what one would need.**
- **Model:** an image classifier over the 7 categories (CRT, LCD_PANEL, PCB, CABLE, BATTERY, MOTOR_MAGNET, MIXED_PLASTIC). It must be small enough for entry-level phones (≤ 5–10 MB), exportable to **TF.js or ONNX** (runs in the PWA offline via `onnxruntime-web`/`@tensorflow/tfjs`), with a known input size and a label map. A good base: MobileNetV3 or EfficientNet-Lite fine-tuned on e-waste images.
- **Data:** labeled e-waste photos per category, with source, licence, size and known biases documented (the statement requires this). Plus field photos from collectors.
- **Plug-in point:** the NewLot category step. Pre-select the top prediction and let the collector confirm or override. Keep the icon grid as the fallback.
- **A real recycler dataset** matters more for credibility than the classifier: the CPCB and Maharashtra PCB published lists of authorized e-waste dismantlers/recyclers, which would replace the fictional `seedData.ts` recyclers.

**D-11 The role chooser is stored per device, and `?role=` overrides it.** The URL override keeps shareable demo links working (`/?role=recycler`) and needs no auth.
