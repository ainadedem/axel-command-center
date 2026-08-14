# Export typography + table row actions

## 1. Row actions move into a left column on the same row

Today each record renders two rows: the data row and a second-tier action bar
underneath. Replace that with a single row layout.

- Retire the second-tier `ListRowActions` bar and render actions in a fixed
  first column on the data row itself (left of the record's content).
- Icons only — no label text on hover, no sliding text reveal. Each button keeps
  an `aria-label` and a native tooltip so it stays accessible and discoverable.
- Actions stay invisible (opacity 0) until the row is hovered or focused, then
  fade in with the sidebar's 150ms cubic-bezier motion. On touch/mobile they are
  always visible.
- The actions column is excluded from resizing/reordering/hiding so it can't be
  dragged away.
- Applied consistently across invoices, quotations, purchase orders,
  transactions, accounts, and projects.

## 2. "New" buttons share the top bar animation

Audit every page-level "New …" button and give them the exact hover/press
treatment of the top bar's New button (same scale, shadow, and 150ms easing) via
a single shared button variant, so no page defines its own.

## 3. Column resizing everywhere

Confirm each list table passes resize handles and per-route width persistence,
and add them where missing so every column in every list can be dragged wider or
narrower and remembers the size per user.

## 4. Faster, more reliable fonts in print/export

- Serve the export fonts from a single cached source: fetch Plus Jakarta Sans
  and Inter once, cache the encoded faces in memory (and browser cache), and
  inline them into every export document instead of hitting Google Fonts on each
  render. Repeated exports then need no network at all.
- Same font stack shared by the PDF renderer, printable HTML, table exports, and
  reconciliation exports, so all four paths look identical.

## 5. Font-loading timeout and fallback

- Hard cap on font loading (about 3s) before the renderer proceeds anyway with a
  metric-compatible fallback stack, so an export can never hang on a slow font
  request.
- When the fallback is used, the export still completes and the user is told the
  document rendered with substitute fonts.

## 6. Typography regression check

Add an automated check that opens the app, samples headings, table cells, form
labels/inputs, and chart text, and fails if any resolved font is not Plus Jakarta
Sans or Inter. It also renders one invoice export and one table export and checks
the export documents resolve the same pairing.

## 7. Cross-browser verification

Run the export path in Chromium, WebKit (Safari engine), and Firefox, compare the
generated output against the on-screen preview, and fix any divergence found
(most likely candidates: font-weight synthesis and letter-spacing rounding).

## Technical notes

- `src/components/list-table.tsx`: new leading actions cell, removal of the
  second-tier row and its `row-actions-*` CSS in `src/styles.css`.
- `src/lib/pdf-render.ts`: font cache + timeout/fallback in `waitForFonts`.
- New `src/lib/export-fonts.ts` holding the shared, cached `@font-face` CSS used
  by `pdf-export.ts`, `table-export.ts`, `reconciliation-export.ts`, and
  `document-preview.tsx`.
- Regression check as a Playwright-driven script run alongside the other tests.
