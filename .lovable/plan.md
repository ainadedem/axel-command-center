# Gemini-calm redesign of Axel

Rework the app's scale, arrangement, and atmosphere so it reads like the Gemini interface: a near-white canvas, soft floating rounded panels, an icon rail, pill inputs, and lots of breathing room. No changes to the data model, routes, business logic, icons, or design tokens.

Delivered in two stages. Stage 2 starts after you review Stage 1.

## Stage 1 — Canvas, shell, panels, headers, inputs

**The canvas**
- App background moves to the lowest surface tone (near-white), with one ambient gradient wash in the top-left corner: very low saturation primary/lavender fading out. Fixed behind everything, never on content, hidden for reduced-motion-sensitive contrast needs.
- Page containers get large outer margins so the canvas shows through around content.

**Icon rail + flyout navigation**
- The left sidebar becomes a thin icon-only rail sitting on the canvas: app mark at top, section icons in the middle, avatar and settings at the bottom.
- Hovering or clicking a section icon opens a floating rounded flyout panel listing that section's labelled links, so all pages stay reachable. Existing icons and grouping (Overview, Sales, Billing, Treasury, Accounting, Analysis, Operations, Administration) are unchanged.
- Active route stays highlighted on both the rail icon and inside the flyout. Mobile keeps the existing drawer, restyled.

**Floating panels**
- A shared panel surface: ~24px radius, surface tone just above the canvas, no hard border, very soft or no shadow, 24–32px internal padding, generous gaps between panels.
- Existing cards, tables, filter bars, and KPI blocks adopt this surface. Nested hard boxes are removed — inner sections separate by space and tone instead.
- Dashboard KPI panels are spaced out rather than a packed grid.

**Headers**
- Page headers become quiet: plain title on the left, small pill-style actions/status on the right. The heavy toolbar treatment is dropped; filters move into a light pill row.

**Pill inputs**
- Top search, the AI input, and primary New/Add actions become large near-white rounded pills with a soft shadow, a leading icon or +, and a trailing action — the visual anchor of each screen.

**List rows and typography**
- Table and list rows lose borders: borderless rows with barely-there hover and selected backgrounds, near-black titles, grey subtitles, quiet metadata, and hover-revealed overflow controls.
- Status becomes quiet text/subtle chip rather than a loud badge.
- Line height and text sizes ease up; numeric columns keep tabular figures and compact row height so finance data stays scannable.

**Motion**
- Gentle 150ms fades and soft transitions, shimmer skeleton loaders, all respecting `prefers-reduced-motion`.

## Stage 2 — Master-detail on every list page

Each record list page moves to a two-panel arrangement, both panels floating on the canvas:
- Left: a calm list column of quiet rounded rows (title, grey subtitle, metadata, hover overflow).
- Right: a large focused work panel for the selected record. For invoices and quotations this is the live document editor/preview; for other entities it's the record's detail/edit view.
- Selecting a row swaps the right panel. With nothing selected, the right panel shows a calm empty state.
- Below a large breakpoint it collapses to list-first, with the detail panel sliding over.
- Pages covered: invoices, quotations, purchase orders, clients, projects, suppliers, transactions, expenses, accounts, pipeline, team, sales team, payroll, billing, budgets, companies, journal, users & access, SOPs. Report/statement screens (balance, bilan, compte de résultat, grand-livre, plan comptable, reports) stay single-panel with the airier treatment.

## Technical notes

- New shared primitives: a `Panel` surface component, a `PillInput`/`PillAction` pair, a `MasterDetail` layout shell, and a `RailNav` with flyout — all built on existing tokens in `src/styles.css` (`--surface`, `--surface-container`, `--radius`, motion tokens). No new colour tokens; only new spacing/radius utilities where needed.
- The gradient wash is a single fixed pseudo-element in the app shell.
- Selection state in master-detail lives in local component state (no route or search-param changes), so routing and deep links behave exactly as today.
- Data hooks, stores, RLS, exports, and PDF pipeline are untouched; only presentation components change.

## Acceptance checks

- Near-white canvas with a subtle top-left gradient; content floats as rounded panels with visible canvas gaps.
- Icon rail with working flyouts reaches every page; active route is clear.
- Search, AI, and add actions render as large rounded pills.
- Rows are borderless with quiet titles, grey subtitles, and hover-revealed controls.
- Headers are quiet with small pill actions.
- Finance tables remain compact and scannable inside their airy panels.
- Icons and design tokens unchanged; routes, data, and logic unchanged.
