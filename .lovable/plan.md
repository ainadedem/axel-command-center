# Fix column headers not matching the data underneath

## What is actually wrong

Confirmed by measuring the live tables on Quotations and Invoices: every data cell sits one column to the left of its header. On Invoices, the header row reads Number | Client | Project | Company..., while the row underneath renders the invoice number and the client name stacked in the same slot, the project name under the "Client" header, the company under "Project", and so on to the end of the row. Same shift on Quotations. It is a layout bug, not wrong data.

Cause: the hover action pill cell in each row is taken out of the table's column flow (`td.row-actions-cell` is absolutely positioned in `src/styles.css`). The header still keeps a placeholder cell for it, so the browser lines the body up against the wrong header slots. Every list page built on the shared list-table primitives is affected (Quotations, Invoices, Clients, Suppliers, Projects, Transactions, Expenses, Accounts, Purchase orders, Team, Payroll, Companies), on desktop and on mobile cards, since the mobile labels are derived from the same header positions.

## The fix

1. Keep the actions cell in the table flow: the `<td>` stays a normal zero-width cell and only the pill inside it (`.row-actions-inner`) floats over the row. Move the absolute positioning from the cell to the inner pill, anchored to the row.
2. Keep the current look and behaviour: the pill still appears on hover/focus, still sits at the left of the row above the checkbox column, and still overlaps the row content rather than adding a column of blank space.
3. Keep the mobile stacked-card override working: on narrow screens the actions block stays a full-width block at the bottom of the card.
4. Re-measure Quotations and Invoices in the browser to confirm each header now sits exactly above its own values, then spot-check Clients, Projects and Transactions, plus one narrow-viewport pass for the stacked cards.

## Notes

- CSS-only change in `src/styles.css`; no page, data, column-picker or business-logic changes.
- Nothing about the column definitions, ordering or visibility preferences changes — those were already correct.
