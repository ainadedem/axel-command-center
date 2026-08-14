# No-scroll list rows with a bottom action bar

Goal: every list page fits its width with no left/right scrolling, each value stays on a single line, action buttons move to their own padded line under each record, and nothing touches anything else.

## What changes for you

- **No horizontal scrolling.** Each table shows a prioritised set of columns that fit the screen. A **Columns** button in the toolbar lets you switch the extra columns on or off; your choice is remembered per page.
- **Two-tier rows.** Each record keeps its data row (values truncated to one line, full text on hover) and gains a second, indented line underneath holding Edit / Preview / History / Payment / Delete etc. Buttons are always visible (no hover-to-reveal), labelled, and spaced apart.
- **Consistent breathing room.** One shared set of cell padding, row separators, and button gaps across all list pages, so badges, dates and amounts no longer collide.
- **Phones.** The existing card-style stacking stays, with the same action bar at the bottom of each card.

## Pages covered

Invoices, Quotations, Purchase orders, Projects, Clients, Accounts, Transactions, Users & Access, Team, Journal, Grand livre, Balance, Plan comptable, Compte de résultat, Reports.

## Technical approach

1. **Shared list-table primitives** in a new `src/components/list-table.tsx`:
   - `ListTable` (wrapper, `table-fixed w-full`, no `min-w`, no `overflow-x-auto`),
   - `ListCell` (padding + `truncate` + `title` tooltip by default),
   - `ListRowActions` (renders a `<tr>` with a single full-width `<td colSpan>` holding a flex, gap-2, padded action bar; grouped as the second tier of the record).
   - Row pairs share a bottom border so a record reads as one block; hover highlights both tiers via `group/row`.
2. **Column visibility** in a new `src/lib/column-prefs.ts`: per-page column descriptor list (`key`, `label`, `priority: always | default | optional`), a `useColumnPrefs(pageKey, columns)` hook persisting to `localStorage`, and a `ColumnPicker` dropdown (shadcn `DropdownMenu` with checkboxes) placed in each page's toolbar next to the existing controls.
3. **Per-page migration**: replace raw `<table className="min-w-[...]">` + `overflow-x-auto` markup with the primitives; move the hover-only action `<div>` from the last `<td>` into `ListRowActions`; drop the now-unneeded trailing action column and `w-20` spacer; wrap multi-badge cells (status + "PO missing", due date + "late" chip) in `inline-flex flex-wrap gap-1.5` so badges never touch.
4. **Stacked (mobile) CSS** in `src/styles.css`: extend the `.stacked-table` rules to treat the action row as a full-width footer of the card and add the same gap/padding tokens; keep `TableStackLabeler` working by ignoring rows marked `data-row-actions`.
5. **Grouped rows** (`GroupHeaderRow colSpan`) and bulk-select cells stay; `colSpan` values become derived from the visible-column count instead of hardcoded numbers.
6. No data, query, or permission logic changes — presentation only.

## Verification

Check invoices, quotations, transactions and users at 1280px, 1024px and 390px widths: no horizontal scrollbar, no clipped text, action bars aligned and evenly spaced, column picker persists after reload.
