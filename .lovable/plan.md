# Spreadsheet-style line-items grid in the quotation maker

Turn the line-items table inside the quotation editor into a dense, Google Sheets-like grid so numbers and details are readable at a glance.

## What changes

- **Grid look**: every cell gets thin, continuous borders (vertical and horizontal), a light zebra tint on alternating rows, and a sticky header row that stays visible while scrolling long line lists.
- **Borderless inputs**: text, number and select controls lose their individual rounded boxes and fill their cell edge-to-edge, like a spreadsheet cell. The cell shows a focus ring only when you are editing it, and hover tints the row.
- **Denser rows**: row height drops from the current padded inputs to a compact single-line cell; the Details rich-text field collapses to a one-line preview under the description and expands only when focused, so ordinary rows stay one line tall.
- **Clear numbers**: Qty, Rate, Disc % and Amount are right-aligned tabular figures at the same size, with the currency/percent suffix kept inside the cell without covering the typed value. The Amount column gets a slightly stronger weight since it is the read-only result.
- **Readable totals**: the footer (line discounts, global discount, subtotal, tax, total) becomes a compact right-aligned block with a rule above the Total, matching the invoice editor.
- **Column widths**: description flexes; numeric columns keep fixed minimum widths so nothing is cropped, and the grid scrolls horizontally only when the dialog is genuinely too narrow.

Both rate-card and standard modes get the same treatment, and the same grid styling is applied to the invoice editor's line table so the two makers stay twins.

## Technical notes

- Add a small shared `sheet-grid` style block in `src/styles.css` (cell borders, zebra, sticky thead, focus-within ring, borderless `input`/`SelectTrigger` inside `.sheet-grid td`).
- `src/routes/_authenticated/quotations.tsx` (line-items table, ~lines 1216–1360): apply `sheet-grid`, drop per-cell `px-2 py-1.5` padding for a uniform compact cell, keep drag handle and remove button columns.
- `src/routes/_authenticated/invoices.tsx`: same class swap on its line table.
- `src/components/rich-text-field.tsx`: use its existing `compact` mode with a collapsed height that grows on focus (no API change to callers beyond a prop).

No changes to pricing, VAT, rate-card logic, totals math, or any stored data — presentation only.
