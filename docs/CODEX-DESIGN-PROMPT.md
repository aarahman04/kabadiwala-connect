# Prompt for the design pass (paste into Codex)

> Completed in `a078fc0` on 2026-09-28. Retained as the original design brief; see `PROGRESS.md` for verification and remaining physical-phone checks.

---

You are a senior product designer and front-end engineer. Your job is to give an existing, fully working app a **professional, polished, award-level visual design**. This is for a national hackathon final (Smart India Hackathon). The live demo and the screenshots in our presentation decide whether we win, so the app must look like a **real, funded product built by a design team**. It must not look like a hackathon prototype or "vibe-coded" AI output.

## 0. Read first (mandatory)

Before changing anything, read these files in the repo:
1. `docs/DESIGN-GUIDE.md`: the users, the hard rules, the screen map and the class hooks. **Follow it strictly.**
2. `docs/README.md` and `docs/ARCHITECTURE.md`: how the app works.
3. The root `README.md`: the demo scripts. You will walk them to check your work.
4. All files in `src/screens/`, `src/components/`, `src/App.tsx`, `src/index.css` and `src/i18n/strings.ts`.

## 1. What the product is

**Kabadiwala Connect** is an offline-first, installable PWA (React 18 + Vite + TypeScript + Tailwind v4). It helps India's **informal e-waste collectors (kabadiwalas)** in four steps:
1. photograph scrap and get a fair, spoken price;
2. find **government-authorized recyclers**;
3. request a pickup and complete a **verifiable, fingerprinted handover**;
4. track their earnings.

A second side of the app serves the **recycler facility**: a pickup inbox, verifying the handover code, confirming payment, and publishing rates.

The primary users have **limited literacy**, read **Hindi or Marathi** (the app starts in Hindi), use **cheap Android phones outdoors**, often **offline**, and are paid in cash. The design must feel **trustworthy, dignified and simple**, like a serious public-good product (think Google Pay India, PhonePe, Zomato, or GOV.UK/UPI-grade clarity). It must not look like a toy.

## 2. Hard constraints (breaking any of these fails the task)

- **Don't change logic.** Don't touch `src/logic/*`, `src/data/*`, `src/services/*`, `src/hooks/*`, `backend/`, `classifier/` or `database/`.
- **Don't change contracts.** Component props, callback names and their behaviour stay exactly as they are. Every button, input, state and conditional block must still exist and still work. You may restructure markup **inside** a component, and you may add new presentational components.
- **Text lives in one place.** All user-facing text comes from `src/i18n/strings.ts` via `t()`. If you change wording, change **en, hi and mr** together (TypeScript enforces it). Keep every `{placeholder}`.
- **Keep the test hooks.** Keep all the class names listed as test hooks in `docs/DESIGN-GUIDE.md` (e.g. `.handover-code`, `.pickup-panel`, `.lookup-result`, `.recycler-card`, `.ai-suggestion`, `.category-tile`, `.sync-bar`). Add your own classes alongside them.
- **Keep accessibility attributes:** `aria-*`, `role`, `<label>`s, `<button>` for actions, `<a>` for `tel:` and map links.
- **Offline-first.** No runtime CDN requests of any kind: no Google Fonts link, no icon CDN, no remote images. Every asset must be **bundled through Vite** so the service worker precaches it.
- **Performance budget:** stay light for entry-level Android phones. The total added JS should be under about 60 KB gzipped. Prefer CSS over JS animation libraries, and don't add a heavy UI framework.
- `npm run build` and `npm test` (45 tests) must pass at the end.

## 3. Design requirements

### No emojis anywhere
Right now the UI uses emoji as placeholder icons: in `strings.ts` (e.g. `'📷 Take photo'`, `'🔊 Hear price'`, `'✅ …'`), in `CATEGORY_ICONS`, and inline in screens.
- **Remove every emoji** from the rendered UI in all three languages.
- Replace them with a **consistent, professional SVG icon set**. Recommended: `lucide-react` (tree-shaken, bundled, works offline). Use one stroke width and size scale throughout.
- Material categories need **distinctive, meaningful icons**: CRT monitor, flat LCD panel, circuit board, cable, battery, motor/magnet, plastic. Where the library has no good match, draw a clean custom SVG in the same style, and create a `CategoryIcon` component.
- Emoji in notification text should become plain text.
- **Acceptance check:** a regex search for emoji in `src/**/*.{ts,tsx}` returns nothing user-visible.

### Visual identity
- **Not boring, not generic.** No default blue-and-grey Tailwind look, and no flat "AI template" gradients.
- Build a **deliberate palette** with a design-token layer (CSS custom properties in `src/index.css`, exposed to Tailwind v4 via `@theme`). Suggested direction, which you may refine:
  - a deep, confident **green/teal** primary (clean-tech, trust, money);
  - a warm **saffron/marigold** accent for key actions and highlights (Indian, human, energetic);
  - rich neutrals with a slight warm tint;
  - semantic colours for success, warning/anomaly and danger.

  Colour must pass **WCAG AA contrast** outdoors, and it must never be the only signal.
- **Typography:** self-host fonts via `@fontsource`, e.g. **Inter** or **Plus Jakarta Sans** for Latin, paired with **Noto Sans Devanagari** or **Mukta** for Hindi/Marathi. Use a clear type scale. Numbers (₹ amounts, kg, the `KC-XXXXXX` code) are the heroes: large, tabular figures (`font-variant-numeric: tabular-nums`).
- **Spacing and shape:** use an 8-pt spacing system, consistent radii and a subtle elevation system (soft layered shadows, not harsh ones). Cards should feel crafted.
- **App icon and branding:** design a proper logo mark and wordmark for "Kabadiwala Connect" as SVG. Replace `public/icon.svg`, and add maskable PNG icons (192 and 512) generated at build time or committed. Update the `manifest.json` colours and `theme-color`.

### Components to build (presentational only)
Build these as reusable components in `src/components/ui/` with variants:
- `Button`: primary, secondary, ghost, danger; sizes md and lg (≥ 48 px tall, the primary action ≥ 56 px); icon + label; loading and disabled states.
- `Card`
- `Badge`/`StatusPill`: every lot, pickup and transaction status, each with an icon and word.
- `Stat` (big number with label), `Stepper`/progress (the 3-step new-lot flow and the pickup timeline), `SegmentedControl` (language, payment method), `EmptyState` (icon + friendly line), `Skeleton` (loading), and a `Banner` for offline, "saved on phone" and warnings. Offline is normal here, so style it calmly, not as a red error.

Then restyle every screen with them.

### Screen by screen (all of them, collector and recycler side)
Walk every screen in `docs/DESIGN-GUIDE.md` and make each one excellent at **360 px wide**, then up to tablet and desktop width with a centred phone-width layout.

The moments that matter most in the live demo:
1. **Role chooser (first launch):** a beautiful, confident first impression, with the brand, a one-line value proposition and two large illustrated choices.
2. **Valuation:** the ₹ estimate as a hero number, with the market range, a clean trend sparkline and an obvious "Hear price" audio button.
3. **Recycler match:** premium list cards (rate, "you get ≈ ₹", distance, pickup), a "Best match" treatment, a clear authorized-facility badge, and an amber anomaly warning.
4. **Handover receipt:** `KC-XXXXXX` as the single most prominent element in the app, styled like a ticket or receipt, with the verification fingerprint shown elegantly. This is the "proof of transaction" moment.
5. **The pickup timeline:** requested → accepted → on the way → arriving, as a polished vertical or horizontal stepper with timestamps, like food-delivery tracking.
6. **Earnings:** a dashboard feel, with total / received / pending stat cards and a clean transaction list.
7. **Safety:** replace the emoji with **simple, clear pictograms** (custom SVG illustrations: don't burn cables, don't break batteries, don't smash CRT tubes, no acid baths, wear gloves and a mask). Pictorial guidance is an explicit requirement of the problem statement.
8. **Recycler desk:** it should feel like a professional operator console (inbox cards with clear Accept / Decline / On my way / Arriving actions, and the facility identity at the top).
9. **Header:** compact and elegant. It holds the language switcher, a connection state pill and the sync button. The "Demo: simulate offline" control stays, but make it discreet (for example in a small settings or overflow menu). It must stay reachable, and keep its `.simulate-offline` class.

### Motion and feel
- Use subtle, fast transitions (150–250 ms): screen changes, button press, status changes, and suggestion reveals.
- Respect `prefers-reduced-motion`.
- Add a satisfying but restrained success moment when the handover is confirmed or paid.

### Low-literacy usability (the judges score this explicitly)
- Every primary action pairs an **icon with a short label**.
- Use big tap targets, with one obvious primary action per screen.
- **Devanagari must never truncate or overflow.** Test every screen in हिन्दी and मराठी. Hindi labels run longer, so layouts must wrap gracefully.

## 4. Process

1. Read the docs and the code. Write a short design plan (palette, type, component list), then implement it.
2. Install only what you need (`lucide-react`, `@fontsource/*`), and keep it minimal.
3. Build the tokens and UI components first, then restyle the screens one by one.
4. Replace every emoji: strings (all 3 languages), category icons, inline screen emoji.
5. Run `npm run build` and `npm test`, and fix anything you broke.
6. Run `npm run dev`. Walk the collector flow (choose "I collect scrap") and the recycler side (`?role=recycler`) in **English, हिन्दी and मराठी** at 360 px. Check the offline states (the "simulate offline" control).
7. Update `docs/PROGRESS.md` with one line per changed file, and note the new components in `docs/DESIGN-GUIDE.md`.
8. Commit with a clear message.

## 5. Definition of done

- The app looks like a **professionally designed product**: cohesive, branded, polished and presentation-ready, with **zero emojis**.
- Every screen works at 360 px in all three languages, with no overflow.
- No logic, prop or behaviour changes. Build and tests are green. It works fully offline, with no network assets.
- The screens would make strong full-bleed slides in a pitch deck.

---
