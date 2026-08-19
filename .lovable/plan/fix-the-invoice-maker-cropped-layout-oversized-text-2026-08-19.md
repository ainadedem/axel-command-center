# Fix the invoice maker: cropped layout, oversized text

Both the New/Edit invoice form and the document preview window are too cramped for their content, so parts get cut off and the type looks oversized for the density of the screen.

## What is wrong today

**New/Edit invoice form**
- The dialog is capped at 672px wide while the line-items table is forced to at least 720px, so the Price / Discount / Amount columns are cut off and need sideways scrolling inside a scrolling dialog.
- The whole dialog scrolls as one block: the title and the Cancel/Create buttons scroll out of view, so on a long invoice you lose the save button.
- Labels, inputs and helper text inherit the enlarged app body scale, which makes a 12-field form far taller than it needs to be.

**Document / PDF preview**
- The window is capped at 896px, so an A4 sheet plus the left/right padding leaves the page small while the toolbar rows (stamp, columns, zoom, density, language, export) crowd and wrap into several lines.

## What changes

**1. Wider, properly framed invoice dialog**
- Widen the form dialog so the line-items table fits without horizontal scrolling on desktop, and keep a comfortable full-width sheet on mobile.
- Make the dialog a fixed frame: sticky title at the top, sticky action bar at the bottom, only the middle section scrolls. Cancel/Create stay reachable at all times.
- Let the line table use the available width (description flexes, the numeric columns keep fixed compact widths) instead of a hard minimum width; below tablet it keeps the existing stacked/scroll behaviour.

**2. Right-sized, denser form typography**
- Apply a compact form scale inside document dialogs: smaller labels, tighter field height and consistent helper-text size, with more predictable vertical rhythm between groups.
- Group the form into clear blocks (Document, Links, Lines, Payment) with lighter section labels so the height drops without losing readability.

**3. Roomier preview window**
- Give the preview a larger max width and height so the sheet is bigger at fit-zoom, with the page centered in the scroll area.
- Reorganise the preview toolbar into a single quiet row with the frequently used controls (zoom, fit, export) visible and the rest grouped into a compact "Display options" popover, so it stops wrapping and cropping.
- Keep every existing control, shortcut and saved preference (zoom mode, column widths, density, stamp placement) working exactly as now.

## Out of scope
No change to invoice data, totals, VAT, numbering, PO rules, or the exported PDF output itself — this is layout and typography only.

## Technical notes
- `src/routes/_authenticated/invoices.tsx`: `InvoiceDialog` gets a wider `DialogContent` with `flex flex-col`, a `flex-1 overflow-y-auto` body and non-scrolling header/footer; the line table drops `min-w-[720px]` in favour of `table-fixed` column widths (kept inside the existing `stacked-table` wrapper for small screens).
- Same treatment applied to the quotation dialog in `quotations.tsx` so the two stay identical.
- Compact form scale added as a scoped utility in `src/styles.css` (label/input/helper sizes) rather than hardcoded sizes per field, so other dialogs can opt in.
- `src/components/document-preview.tsx`: raise `max-w-4xl`/`max-h-[90vh]` to a larger frame, and move secondary toolbar groups into a popover; zoom/fit logic, `ResizeObserver` and persisted view state are untouched.
- Verification: Playwright pass at 1573px and at a narrow width, opening the invoice form and the preview, confirming no horizontal clipping, visible action buttons, and no console errors.
