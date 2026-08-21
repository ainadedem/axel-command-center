# Fix: bulk-select checkbox hidden by hover action pill

## Problem
On the invoices and quotations tables, each row renders a floating icon-only action pill (`ListRowActions` → `td.row-actions-cell`) that is absolutely positioned at the bottom-left of the row (`left: 0.5rem; bottom: 0.125rem; z-index: 5`). The bulk-select checkbox (`SelectRowCell`) is the first real data column (`w-10` ≈ 2.5rem wide), sitting immediately under that pill. When the row is hovered/focused, the pill fades in directly on top of the checkbox and covers it, so the checkbox becomes invisible and unclickable.

The pill position is global in `src/styles.css` (`td.row-actions-cell { left: 0.5rem }`), so the fix must only shift it on rows that actually have a bulk-select column — pages without bulk select (transactions, accounts, etc.) keep today's left edge.

## Fix
1. **`src/components/bulk-select.tsx`** — add a `bulk-select-cell` class to `SelectRowCell`'s `<td>` and `SelectAllHeaderCell`'s `<th>` so they are identifiable from CSS.
2. **`src/styles.css`** — shift the action pill right of the checkbox column only when the row has a bulk-select cell:
   ```css
   .stacked-table tbody > tr:has(td.bulk-select-cell) td.row-actions-cell {
     left: 3rem; /* clear the w-10 (2.5rem) checkbox column + padding */
   }
   ```
   Also raise the checkbox cell above the pill so it stays clickable even mid-transition:
   ```css
   .stacked-table td.bulk-select-cell {
     position: relative;
     z-index: 6;
   }
   ```
   No change to the default `left: 0.5rem` — pages without bulk select are untouched.

## Verify
- Build passes.
- Playwright on `/invoices` and `/quotations`: hover a row → action pill appears to the right of the checkbox, checkbox stays visible and clickable; click checkbox → row selects; click "select all" header → all visible rows select.
