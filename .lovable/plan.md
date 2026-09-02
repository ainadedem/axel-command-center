# Spreadsheet-style tables everywhere

Today only the quotation and invoice line-item editors use the dense spreadsheet grid (`.sheet-grid`). Every other list (Projects, Clients, Invoices, Quotations, Suppliers, Expenses, Accounts, Transactions, Team, Payroll, Companies, Tasks, Purchase Orders, Payment approvals, Cash flow) and the accounting reports (Journal, Grand livre, Balance, Compte de résultat, Plan comptable, Reports, Pipeline, Timesheets, Users & access) use the softer list styling with no vertical rules.

Goal: one consistent Google-Sheets-like look across all tables, without changing any data, totals, filters, or business logic.

## What changes visually

- Continuous light gridlines: every cell gets a right and bottom border, so columns read as a grid.
- Sticky header row on all lists (already partially there), with a solid tinted background so numbers never scroll under it.
- Dense rows: tighter vertical padding, single-line cells, consistent 12–13px text — respects the existing Compact/Comfortable density toggle (compact = tighter).
- Zebra striping on alternating rows plus a hover highlight for the row under the cursor.
- Numeric columns right-aligned with tabular figures so digits line up vertically; currency/amount and date columns get fixed widths.
- Totals/footer rows styled like a spreadsheet summary band (top rule, tinted background).
- Selected row keeps a clear highlight that beats the zebra stripe.

Unchanged: column picker, column resize/reorder, row actions, master-detail panel behaviour, sorting, filters, exports, Kanban views, and all calculations.

## Technical approach

1. Generalise the existing `.sheet-grid` rules in `src/styles.css` into a shared `.sheet` table skin:
   - split out the parts that apply to read-only lists (borders, zebra, sticky head, tabular numerals, footer band) from the editor-only parts (borderless in-cell inputs, focus outline), keeping `.sheet-grid` as `.sheet` + editor extras so the quotation/invoice editors keep behaving exactly as now.
   - hook row density into the existing density variables rather than hard-coded padding.
2. Apply the skin at the primitive level in `src/components/list-table.tsx` (`ListTable`, `ListHeadRow`, `ListTh`, `ListTd`, `ListTableShell`) so every page using `ListTable` inherits it with no per-route edits. Add an `align="right"`/numeric affordance already present in `ListTd` to drive tabular alignment.
3. For pages that render raw `<table>` markup (Journal, Grand livre, Balance, Compte de résultat, Plan comptable, Reports, Pipeline, Users & access, Timesheets, admin panels, statement import dialog), add the `sheet` class and align their amount columns. Document preview / printed PDF tables are deliberately excluded so exports keep matching the preview.
4. Verify in the browser across a list page, an accounting report, and the quotation editor, and confirm the build is clean.
