# Adjustable columns + fit-to-one-page for quotations & invoices

## What you get

In the document preview (invoices, quotations, purchase orders):

1. **Drag column edges** — grab the border between any two column headers in the preview and drag to resize. Widths are remembered per document type and carry into Print / Export PDF. A "Reset columns" button restores the defaults.
2. **Auto shrink to one page** — a "Fit 1 page" toggle, on by default. When the document would spill onto a second page, the print scale (font size and vertical padding) is stepped down until it fits a single A4 sheet, down to a readable floor. If it still can't fit (long rich-text line details, many lines), the toolbar shows "2 pages — can't fit" instead of shrinking to unreadable text.
3. **Manual density override** — a Compact / Normal / Spacious control that overrides the auto choice, plus a live page-count badge so you see the effect before exporting.

## Behaviour details

- Resizing works on the description, quantity, unit, unit price and line-total columns; the description column absorbs remaining width so the table always fills the page.
- Hidden columns (unit column toggle off) drop out of the width model automatically.
- Density affects only the printable document: base font size, row padding, table margins, and the header/party block spacing. It does not change wording, currency, VAT, or totals.
- Auto-fit measures the rendered sheet height and tries successive density steps; the resulting scale is what gets written into the print window, so the PDF matches the preview exactly.
- Column widths and density persist per document kind alongside the existing zoom/scroll memory.

## Technical

Everything stays in `src/components/document-preview.tsx` (plus a small helper module):

- Extend the saved-view record (`axel:doc-preview:view`) with `colWidths: Record<string, number>` (percent) and `density: "auto" | "compact" | "normal" | "spacious"`.
- Add `colWidths` and `density` to `DocumentHtmlArgs`; `buildHTML` emits a `<colgroup>` with percentage widths and a density-scaled CSS variable set (`--fs`, `--pad`) used by `.doc`, `th`, `td`, `.totals`, `.paycard`.
- Overlay drag handles absolutely positioned over the header cell boundaries of the rendered sheet (measured from the sheet DOM, scaled by current zoom), reusing the pointer-drag pattern from `src/components/resizable-columns.tsx`.
- Auto-fit loop: after each render, measure `sheetRef.offsetHeight` against 297mm; if over, step density down (normal -> compact -> extra-compact) and re-measure; expose the resulting page count in the toolbar.
- `buildPrintableDocument` receives the same args, so print/PDF output is identical to the preview.

No database, schema, or document-logic changes — presentation only.
