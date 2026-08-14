# Typography consistency: PDF export, shared tokens, global audit

## 1. Same fonts in exported PDFs
Today the printable document explicitly sets a system font stack (`-apple-system, Segoe UI, Helvetica, Arial`), so exported and printed quotations/invoices do not match the on-screen ClickUp typography.

- Switch the printable document to the app pairing: Plus Jakarta Sans for the document title, headings, totals and status pill; Inter for body text, party blocks, table cells and notes.
- Make sure the fonts are actually available at render time: the standalone printable HTML gets its own Google Fonts `<link>` (needed for the print window), and the PDF renderer waits for the required font faces to finish loading — alongside the existing image wait — before snapshotting, so no page falls back to Helvetica mid-render.
- Keep tabular figures on all number columns and totals so amount alignment in the PDF matches the preview.
- Stamp/signature geometry, sizes and opacity stay untouched; this is a font change only.

## 2. Shared typography tokens
Introduce a small set of reusable typography utilities in the stylesheet so new UI picks up the right font automatically:

- `text-display-xl / lg / md / sm` — Plus Jakarta Sans, tight tracking, 1.2–1.25 line height, for page titles, section titles and stat numbers.
- `text-body / text-body-sm / text-caption` — Inter, 1.5 line height, for paragraphs, table cells, form labels and helper text.
- `text-overline` — Inter uppercase micro-label used by table headers and section eyebrows.

Base element rules stay in place (h1–h4 already map to the display font), and the new classes are documented at the top of the typography block so future components use them instead of ad-hoc size/weight combinations.

## 3. Global typography audit
Sweep the app for places that bypass the pairing and fix them:

- Headings, page headers, KPI/stat numbers, dialog titles — must resolve to Plus Jakarta Sans.
- Tables, forms, inputs, buttons, badges, toasts, tooltips — must resolve to Inter.
- Charts: SVG text does not inherit body font reliably, so chart tick labels, legends and tooltips get an explicit Inter family through the shared chart defaults.
- Remove any leftover hardcoded families (Roboto/system stacks) outside the intentional monospace token.

Verification: load the main screens in a headless browser and read the computed `font-family` of headings, table cells, inputs and chart labels, then report any element still falling back.

## Technical notes
- `src/components/document-preview.tsx`: replace the `.doc` font stack with `"Plus Jakarta Sans"`/`"Inter"` families and add a fonts `<link>` inside `buildPrintableDocument`'s `<head>`.
- `src/lib/pdf-export.ts`: add a `waitForFonts` step using `document.fonts.load(...)` for the weights used by the document plus `document.fonts.ready`, called before `html2pdf` renders the off-screen container.
- `src/styles.css`: add the typography utilities with `@utility` (Tailwind v4) next to the existing `--font-sans` / `--font-display` theme tokens.
- `src/components/charts.tsx`: set the family on the chart text defaults.
