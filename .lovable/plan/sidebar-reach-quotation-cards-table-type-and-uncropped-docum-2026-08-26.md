# Sidebar reach, quotation cards, table type, and uncropped document editors

Four presentation fixes. No data, permission, or business-logic changes.

## 1. Sidebar reaches every feature in the suite

Today the sidebar only lists the sections of the module you are currently in (Sales, Books, Forge, Support, People, Integrations), plus Administration. To reach a page in another Axel you must go back to the launcher. Confirmed in the code: the sidebar builds its list from the active module's sections only.

Change: the sidebar lists **all** modules, grouped by module, with Administration pinned at the bottom.

- Each module is a collapsible group headed by its name and icon; inside it, its sections and labelled links.
- The module containing the current page is expanded on load; the others stay collapsed so the list stays short.
- Expanded/collapsed state is remembered per user.
- The slim icon rail gets the same reach: one icon per module, its flyout listing that module's pages.
- Role filtering is unchanged — sales-only users still see only their allowed pages, and Users & Access stays admin-only. Modules that end up with no visible pages are not shown.
- The "Switch module" header link to the launcher stays.

## 2. Quotation page cards match the rest of the app

The quotation board cards were built separately from the rest of the app's card language and read heavier and wider than the ones on other boards. They get realigned to the shared minimal card pattern already used elsewhere:

- Same padding, radius, border, and hover/press feel as the other boards' cards.
- Same information order: client line, amount, then a compact signal row of icons (status, follow-up, links, assignees) instead of stacked text rows.
- Same truncation rules with tooltips, so nothing wraps into ragged blocks.
- Card hover actions (Open, Assign to me, Comment) keep working exactly as now.

## 3. Consistent text size and format in table columns

Across the list pages, cells set their own size ad hoc: some inherit the default, others hard-code smaller sizes, with several one-off values for badges and dates. The result is columns that visually disagree on the same row.

Change: define one table type scale in the shared list-table primitives and remove the per-cell overrides.

- One body size for all data cells; one smaller size for the column headers; one size for in-cell chips/badges.
- Numbers always tabular-figure and right-aligned; dates always the same format; empty values always the same muted dash.
- Emphasis is expressed with weight and colour only (primary column medium, secondary muted) — never with a different font size.
- Applies to every list page: quotations, invoices, purchase orders, clients, suppliers, projects, expenses, transactions, accounts, companies, team, payroll, journal, budgets.

## 4. Nothing cropped in the invoice and quotation makers

The line-items table inside both editors is forced to a fixed layout inside a capped dialog. In rate-card mode it carries up to eight columns, so at normal widths the price, discount and amount inputs get squeezed and their content is cut off.

Change:

- Give the line table a real column model: the description flexes, numeric columns get fixed minimum widths that fit their content, and the row never compresses below that — the table area scrolls sideways only as a last resort rather than clipping.
- Widen the dialog on large screens and keep the sticky header/footer so Cancel/Save stay visible.
- Suffixes inside inputs (currency, %) get reserved space so the typed value is never hidden underneath them.
- Long descriptions and detail text wrap inside their cell instead of being cut.
- Both editors are changed identically so the invoice and quotation makers stay twins.

## Technical notes

- `src/lib/modules.ts` / `src/components/app-shell.tsx`: replace the module-scoped `useVisibleSections` with an all-modules grouped list plus per-module collapse state in `localStorage`; `RailNav` iterates modules instead of the active module's sections.
- `src/components/list-table.tsx`: `ListTh`/`ListTd` own the type scale (size, weight, tabular numerals, alignment); route files drop their `text-xs` / `text-[10px]` / `text-[11px]` cell overrides.
- `src/routes/_authenticated/quotations.tsx`: board card render reuses `CardSignal`/`CardSignalRow`/`CardInitial` in the same shape as the other boards.
- `src/routes/_authenticated/quotations.tsx` and `invoices.tsx`: line table drops `min-w-[720px] md:table-fixed` for a colgroup with explicit widths inside a scroll container; dialog `max-w` raised.
- Verification: Playwright pass at 1280px and 1440px opening both editors in rate-card and free-form mode, confirming no clipped inputs, plus a screenshot check of the quotation board and a list page.
