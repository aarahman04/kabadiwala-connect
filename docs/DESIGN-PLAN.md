# Visual design plan

- Palette: deep teal `#103f38`, leaf `#287461`, marigold `#efb744`, paper `#f6f7f2`, ink `#183c34`, warning `#805400`. White surfaces and quiet green borders keep the outdoor contrast strong.
- Type: locally bundled Manrope for headings and money; Noto Sans Devanagari for Hindi and Marathi. Large tabular numbers, 16 px body copy, generous Devanagari line height.
- Layout: centered 448 px app; 16 px screen gutters; 48 px minimum touch targets; 56 px primary actions. Compact brand, separate language and sync rows, fixed five-item navigation.
- Signature: a perforated handover receipt, with its reference code, verification fingerprint and payment state. The first-launch illustrations depict a collector's cart and recycler facility.
- Shared presentation: Button, Card, StatusPill, Stat, Stepper, SegmentedControl, EmptyState, Skeleton, Banner, Brand, CategoryIcon and SafetyPictogram. Existing event handlers, props, accessible controls and QA hooks stay in place.
- Verification: production build and existing tests, all screens in three languages at 360 px, full collector/recycler pickup and confirmation flow, simulated offline and service-worker offline reload. Record limits honestly.
