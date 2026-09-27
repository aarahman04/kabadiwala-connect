# Design guide (for Codex / the visual design pass)

You own **how the app looks**. The logic, data, sync and backend are done and tested, so this guide says what you can change freely, what you must not change, and who you are designing for.

## Who you are designing for

**Primary user: a kabadiwala, an informal scrap collector** in Nagpur/Maharashtra.
- Often limited literacy.
- Reads **Hindi or Marathi** (Devanagari). The app **starts in Hindi**.
- Uses a cheap Android phone, outdoors in sunlight, often with **no signal**, often wearing gloves.
- Deals in **cash**.
- Wants three things: *a fair price, a trustworthy buyer, proof of the sale.*

**Second user: an authorized recycler**, a facility staff member using the "recycler" side of the app. More literate; uses a phone or a laptop.

The judges' rubric rewards **"genuinely usable for low-literacy users"** more than polish. Design for that:

- **Icon + short word, always together.** Never a text-only button for a core action.
- **Big tap targets:** at least 48 px high, and bigger for the main action on each screen. One obvious primary action per screen.
- **Numbers are the hero.** The ₹ amount, the kg weight and the handover code `KC-XXXXXX` should be the largest things on their screens.
- **High contrast, and readable in sunlight.** Avoid light-grey text. Font size is 16 px minimum for body text and 18+ px for actions.
- **Devanagari is taller and often longer than English.** Test every screen in हिन्दी and मराठी (header toggle). Nothing may truncate or overflow at **360 px** width. Use a font with good Devanagari support (e.g. *Noto Sans Devanagari*, *Mukta*, *Hind*); self-host it or cache it, because the app runs offline.
- **Colour must never be the only signal.** Status also has an icon and a word (✅ ⏳ ⚠️ ❌ are used now).
- **Audio buttons (🔊) matter** for low-literacy users. Keep them visible, next to the thing they read aloud.
- **The phone offline is the normal case, not an error.** The offline badge and "💾 saved on phone" notes should be calm, not red alarms.

## Rules: what you must not change

1. **Logic and data:** don't edit `src/logic/*`, `src/data/*`, `src/services/*`, `src/hooks/*`, `backend/`, `classifier/` or `database/`.
2. **Component contracts:** don't change any component's props, callback names or their meaning. Screens receive data via props and report actions via callbacks, so you restyle and restructure the markup *inside* a screen.
3. **Behaviour:** don't remove or reword behaviour.
   - Every button, input and conditional block exists for a reason. Buttons marked "double-tap safe" rely on their current handlers.
   - Moving an element within its screen is fine; deleting it is not.
4. **Text:** don't hard-code text. **All** user-facing text comes from `src/i18n/strings.ts` via `t('key')`.
   - To change wording, edit the string in **all three languages** (en, hi, mr). TypeScript fails the build if a key is missing from one of them.
   - `{name}` placeholders must stay.
5. **Semantics:** keep the accessibility attributes that are already there (`aria-pressed`, `aria-live`, `role="alert"`, `aria-label`, `<label>`s). Keep `<button>` for actions and `<a>` for links (`tel:`, maps).
6. **Test hooks:** don't rename these class hooks: `.handover-code`, `.pickup-panel .pickup-status`, `.lookup-result`, `.confirm-result`, `.recycler-card`, `.pickup-request`, `.ai-suggestion`, `.category-tile`, `.connection-badge`, `.sync-bar`, `.simulate-offline`. The QA click-through scripts select on them.

## What you are free to do

- Write all the CSS: `src/index.css`, Tailwind utilities, and a design-token layer. The current styling is deliberately bare placeholder.
- Rearrange layout within a screen, add wrappers, add decorative elements, and animate transitions (respect `prefers-reduced-motion`).
- **Replace the emoji icons** with real iconography. Material icons are in `CATEGORY_ICONS` (`src/i18n/strings.ts`); UI emoji are inline in the screens. Use SVG, inline or bundled, **not** an icon CDN, because the app must work offline.
- Replace `public/icon.svg` and the manifest colours (`public/manifest.json`, `theme_color` in `index.html`).
- Add a dark theme if you want, though sunlight readability matters more.

## Where things live

| Screen | File | Main thing on screen |
|---|---|---|
| First launch: who are you? | `screens/RoleChooser.tsx` | Two large choices (collector / recycler) and the language toggle |
| Header (every screen) | `components/Header.tsx` | App name, language toggle, online/offline badge, queue count, **Sync now**, demo "simulate offline" checkbox |
| Collector home | `screens/Home.tsx` + bottom nav in `App.tsx` | "➕ New lot" and the list of lots (`.lot-card` with `.status-badge.status-<status>`) |
| New lot (3 steps) | `screens/NewLot.tsx` + `components/PhotoInput`, `CategoryGrid`, `WeightStepper` | Photo → **AI suggestion** (`.ai-suggestion`) + category tiles → big weight stepper + optional condition/source chips (`.chip-row`) |
| Valuation | `screens/Valuation.tsx` + `components/Sparkline` | **₹ estimate** (`.estimated-value`), market range, 🔊 hear price, 60-day trend |
| Recycler match | `screens/RecyclerMatch.tsx` | Ranked `.recycler-card`s: rate, "you get ≈ ₹", distance, pickup, ⭐ best match, ⚠️ `.anomaly-badge` |
| Pickup + handover | `screens/Handover.tsx` | `.pickup-panel` (request pickup → status steps `.pickup-steps` → call recycler), then the handover photo + create record |
| Handover receipt | `screens/Handover.tsx` (after record) | **`.handover-code`** (the biggest element in the app), 🔊, confirmation status, details, cash/digital buttons |
| Earnings | `screens/Ledger.tsx` | Total / received / pending summary, `.ledger-entry` list |
| Prices | `screens/PriceBoard.tsx` | `.price-row` per material, with a sparkline |
| Safety | `screens/Safety.tsx` | `.safety-card`: large pictogram, title, text, 🔊. Pictorial guidance is an explicit requirement, so real illustrations here are high-value |
| Recycler: confirm | `screens/RecyclerConfirm.tsx` | Code input `.code-input`, `.lookup-result` (✅ fingerprint check, photos, ⚠️ price warning), payment choice, confirm |
| Recycler: desk | `screens/RecyclerDesk.tsx` | Facility picker, **🚚 pickup requests** (`.pickup-request`: Accept/Decline → On my way → Arriving), incoming handovers, rate editor, dataset links |

## Existing class hooks

These are the classes you can style (a full list is at the bottom). Components use **semantic hooks plus a few Tailwind utilities**; restyle through the hooks.

- **Buttons:** `.btn` `.btn-primary` `.btn-secondary` `.btn-link` `.chip` `.stepper-btn` `.role-option`
- **State modifiers:** `.is-selected` `.is-active` `.is-done` `.is-online` `.is-offline` `.is-confirmed` `.is-pending` `.is-valid` `.is-invalid`
- **Status families:** `.status-<lotStatus>` (draft, valued, matched, handed_over, confirmed, paid), `.status-<pickupStatus>` (requested, accepted, on_the_way, arriving, completed, declined), `.entry-<pending|settled>`
- **Key blocks:** `.handover-code-card` `.handover-code` `.estimated-value` `.valuation-card` `.recycler-card` `.best-badge` `.anomaly-badge` `.ai-suggestion` `.ai-status` `.pickup-panel` `.pickup-steps` `.pickup-request` `.pickup-inbox` `.lookup-result` `.hash-check` `.ledger-summary` `.safety-card` `.price-row` `.category-tile` `.category-icon` `.weight-value` `.empty-state` `.offline-note`

Full list: `app app-header app-title language-toggle sync-bar connection-badge queue-count last-sync sync-result sync-error simulate-offline screen role-chooser role-option home-screen lot-list lot-card lot-thumb status-badge new-lot-screen step-indicator photo-input photo-preview category-grid category-tile category-icon category-name weight-stepper stepper-btn weight-value quick-add chip-row live-estimate ai-status ai-suggestion valuation-screen valuation-card estimated-value price-trend sparkline recycler-match-screen recycler-list recycler-card best-badge hidden-note anomaly-badge handover-screen pickup-panel pickup-status pickup-steps location-status handover-receipt handover-code-card handover-code confirmation-status offline-note record-details record-photos payment-actions ledger-screen ledger-summary summary-total summary-settled summary-pending ledger-list ledger-entry entry-status price-board-screen price-row safety-screen safety-card safety-icon recycler-confirm-screen code-input lookup-result hash-check confirm-result recycler-desk server-mode pickup-inbox pickup-request incoming-card rate-editor nav-tab empty-state`

## Brand direction

This is a suggestion, and you decide.
- **Tone:** trustworthy, government-adjacent, green/clean-tech, but warm and human rather than corporate. The current placeholder primary is `#166534` (green-800).
- **Money green** for earnings, **amber** for warnings/anomalies, **red** only for real errors.

## How to check your work

```bash
npm install
npm run dev        # http://localhost:5173 ; pick "I collect scrap", then try हिन्दी / मराठी
npm test           # must stay green (45 tests)
npm run build      # must pass (TypeScript)
```

- Walk the demo script in the root `README.md` in all three languages at 360 px wide.
- Open `?role=recycler` in a second tab for the recycler side.
- The "Demo: simulate offline" checkbox shows the offline states.

When done, add one line per changed file to `docs/PROGRESS.md`.
