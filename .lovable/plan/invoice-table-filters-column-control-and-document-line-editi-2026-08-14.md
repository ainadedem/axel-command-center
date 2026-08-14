# Invoice table filters, column control, and document line editing

## 1. Status and PO filters on invoices

- Add a filter chip bar above the invoices table with one-click toggles for Paid, Overdue, Partial, Draft, Sent, Cancelled. Chips use the existing colored status pills, show a live count, and multi-select (Paid + Overdue at once).
- Add a separate PO filter with three states: PO linked, PO bypassed (waived), PO missing. Invoices already store a linked PO id and a bypass flag, so each state maps directly.
- Both filters plug into the existing saved-view system, so a chosen filter set survives a reload, and a "Clear filters" action resets them.

## 2. Exports that match the table

- Add an Export menu to the invoices toolbar with CSV and PDF.
- Exports respect the current state of the table: only visible columns, in the current column order, honoring the active filters, sort, and search.
- Amounts always export in full form (no compact 1.2M shortening), with currency, even when the screen is in compact mode.
- The PDF is a landscape table styled like the app (same fonts and status colors) with column widths proportional to the on-screen widths.

## 3. Shared status and PO chips across finance tables

- Reuse the same status pill and a new PO chip component in the other finance surfaces: receivables (dashboard + aging), payables/suppliers, and purchase orders, so a status looks identical everywhere.

## 4. Column widths and order

- Column widths persist per signed-in user and per table route, so invoices, quotations, and other lists keep their own settings and one user's resizing does not affect another on a shared machine.
- Columns become draggable: grab a header to move it left or right, with a drop indicator while dragging. The new order is saved with the same per-user, per-route key and is what exports use.
- The column menu gains "Reset order" alongside the existing reset options.

## 5. Reorderable lines on invoices and quotations

- Each line in the invoice and quotation editors gets a drag handle to reorder lines; the order saves with the document and is what the PDF prints.
- Keyboard alternative (move up / move down) for accessibility.

## 6. Editor UI polish

- Tighten the invoice/quotation line editor: aligned column grid, clearer description vs details fields, right-aligned numeric inputs, subtle row hover, sticky totals summary, and clearer empty state.

## 7. Hover animation consistency

- Align the invoice table's row action buttons with the sidebar's hover motion: same duration and easing curve, same background/level change, no scale jump.

## Technical notes

- Filters: extend the field definitions in `src/routes/_authenticated/invoices.tsx` with a derived `poState` field and drive the chip bar through the existing `useDataView` filter state.
- Persistence: rework `src/components/resizable-columns.tsx` and `src/lib/column-prefs.ts` to namespace storage keys with the authenticated user id and route id, and add an `order` array alongside visibility/widths.
- Drag-and-drop: header reorder and line reorder implemented with native HTML5 drag events (no new dependency), sharing one small helper.
- Export: new `src/lib/table-export.ts` producing CSV via the existing `exportCsvRows` helper and PDF via the existing `html2pdf` pipeline in `src/lib/pdf-export.ts`.
- Chips: extend `src/components/status-badge.tsx` with a `PoBadge` and reuse it in receivables, payables, and purchase orders.
- Motion: use the shared sidebar transition tokens in `src/styles.css` for row actions rather than a per-component curve.
