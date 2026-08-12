# Apple-grade polish: accessibility, theming, charts, motion

A five-part pass that turns the current styling into one governed design system, adds real light/dark theming, and brings charts and interactions to Apple-level quality.

## 1. Design system consolidation

- One token source in `src/styles.css`: color, elevation, radius, spacing scale (4/8/12/16/24/32), type ramp, motion durations and easings. Remove ad-hoc `oklch(...)`, hex, and one-off shadow values from components and pages.
- Chart palette becomes tokens (`--chart-1..8`) plus semantic aliases (income, expense, forecast, neutral) so every graph uses the same hues.
- Shared primitives so pages stop hand-rolling layout:
  - `Section` / `PanelCard` wrapper (title, description, actions, consistent padding)
  - `StatPill`, `EmptyState`, `ToolbarRow`
  - Extended `Button`, `Badge`, `Input`, `Tabs` variants instead of custom class strings
- Sweep the remaining pages (invoices, quotations, team, payroll, reports, settings, etc.) to replace leftover literal colors (`bg-violet-500`, `text-violet-700`, raw hex) with tokens.

## 2. iOS-style theming: light / dark / system

- Theme provider with `light | dark | system`, persisted, applying the `.dark` class; respects OS changes live and avoids a flash on load.
- Complete dark palette: full parity for surfaces, borders, materials, chart hues, shadows, and gradients (dark uses lower-chroma tints and stronger separation instead of heavy shadows).
- Text-size control (Default / Large / Larger) mapped to a root font-size token so the entire type ramp and spacing scale with it, mirroring iOS Dynamic Type.
- Theme and text-size controls live in the topbar menu and in Settings.

## 3. Accessibility pass

- Contrast: audit every muted/secondary text and badge combination in both themes to clear WCAG AA; fix low-contrast pairings by adjusting tokens rather than per-component overrides.
- Focus: single `focus-visible` ring recipe (2px ring + offset, token-driven) applied through primitives so every button, link, input, tab, row action, and menu item shows it. Add a "Skip to content" link and visible focus in the sidebar.
- Labels: `aria-label` on every icon-only button (sidebar toggles, row actions, dialog closes, chart toolbar), `aria-current` on active nav, labels or `aria-label` on all inputs, `aria-live` for toasts, save states, and async results.
- Structure: one `<main>` landmark in the shell, ordered headings per page, tables with real `<th scope>`, dialogs and menus kept on Radix primitives.
- Tap targets at least 44x44 on touch, and `h-dvh` instead of `h-screen` for full-height layouts.

## 4. Charts with Apple-grade defaults

Applies to the dashboard and reports charts, via a shared chart layer:

- Shared `ChartFrame` (title, subtitle, legend, period control) and shared axis/grid/tooltip config so density and styling are identical everywhere.
- Grid: horizontal-only, dashed, low contrast; axes without lines, tick labels in muted token color, compact number formatting.
- Tooltips: one custom tooltip component — rounded, elevated, series swatches, aligned values, formatted currency, with the hovered series emphasized.
- Legends: consistent placement, interactive (click to toggle a series), keyboard-operable.
- Keyboard exploration: charts are focusable, arrow keys move through data points with an announced value via a live region, Escape exits, and each chart has a screen-reader data table fallback.
- Motion: entry animations and hover transitions disabled under reduced motion.

## 5. Interaction and transition tuning

- Elevation ladder (rest → hover → active) with subtle, short-travel lift; springy but restrained easing curves defined once as tokens.
- Consistent press feedback on all interactive surfaces, sidebar item transitions, and a refined route transition (short fade + small rise) that respects reduced motion.
- Full reduced-motion fallbacks: transforms become instant state changes, no shimmer or count-up, while focus and hover states remain clearly visible.

## Technical notes

- Tailwind v4: all tokens stay in `src/styles.css` under `@theme` / `@theme inline`; new utilities via `@utility`; dark handled by the existing `@custom-variant dark`.
- New files: theme provider and hook, chart primitives (`ChartFrame`, shared tooltip/legend/axis config, keyboard navigation hook), shared UI primitives.
- Changes to existing files: `src/styles.css`, `src/components/app-shell.tsx`, `src/components/ui/*` variants, `src/routes/_authenticated/index.tsx`, `src/routes/_authenticated/reports.tsx`, `src/routes/_authenticated/settings.tsx`, plus token sweeps across remaining feature pages.
- Document print/PDF templates keep their fixed print palette and are excluded from dark mode.
- Verification: typecheck, plus preview checks in light and dark at desktop and mobile widths.
