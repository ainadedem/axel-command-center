# Denser, spreadsheet-style tables everywhere

The spreadsheet skin (gridlines, zebra rows, tinted header, tabular numbers) already exists and is applied to list tables and opted-in raw tables. What is still missing is real spreadsheet *density* and readability of numbers: rows are still tall, text sizes vary, headers and the first column scroll away, and some tables (dialogs, drawers, detail panels, reconciliation, cash flow, kanban side lists) never opted in.

## What changes

1. **One row-height scale for every table**
   - Compact (default): ~28px rows, 26px header, 12px text, 6px horizontal cell padding.
   - Comfortable: ~34px rows, 13px text.
   - Applied through shared CSS variables so every table — list tables, raw tables, dialog tables — follows the same scale instead of per-page padding.

2. **Numbers read like a sheet**
   - All numeric/amount/date cells get tabular numerals and right alignment.
   - Thin vertical gridlines on every column, quieter horizontal lines, so columns are visually separated.
   - Negative amounts and totals rows keep their emphasis.

3. **Sticky header and sticky first column**
   - Header band pinned on scroll for all scrollable tables (already partial — extended to raw `.sheet` tables).
   - First identifying column (number/name) pinned horizontally on wide tables so you never lose the row's identity while scrolling right.

4. **Full coverage**
   - Sweep the remaining tables that are not yet on the skin: dialogs and drawers (aging, statement import, reconciliation wizard, payment run review, audit/history panels), detail-panel sub-tables, cash flow, project margins, time & attendance, notifications lists.
   - Excluded on purpose: document preview and printed PDF tables, so export/preview parity stays exact.

5. **Row hover + selection stay legible**
   - Hover tint and selected-row tint sit above the zebra stripe; keyboard focus keeps a visible cell outline.

## Technical notes

- Density tokens (`--tbl-row-h`, `--tbl-font`, `--tbl-pad-x`) defined in `src/styles.css` under `:root[data-density=...]`, consumed by `.list-aligned table` and `table.sheet`.
- Sticky first column via `position: sticky; left: 0` with a right shadow on scroll; only for tables wider than their container.
- Mobile keeps the existing stacked-card layout; the grid remains `md`-and-up.
- Remaining raw tables get `class="sheet"`; no data, totals, or business logic touched.
- Verification: build check plus browser passes over invoices, quotations, projects, journal, cash flow, and one dialog table.
