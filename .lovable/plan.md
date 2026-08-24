# Align all entity list pages with the Projects page UI

The Projects page is the reference layout. Every other entity list page adopts the same shell, so the app reads as one product instead of a dozen hand-rolled tables.

## The reference pattern (from Projects)

1. `AppShell` + `PageHeader` (title + one-line description).
2. A KPI strip at the top (`KpiCard`), values relevant to the page.
3. `DataToolbar` — search, sort, group-by, filters — driven by `useDataView` field definitions.
4. `CrudToolbar` — "New X" action plus a live record count.
5. A fixed-width table built from the shared `list-table` primitives (`ListTableShell`, `ListTable`, `ListHeadRow`, `ListTh`, `ListTd`), so columns always fit the container with truncation + tooltips instead of horizontal scroll.
6. A `ColumnPicker` backed by `useColumnPrefs`, with optional columns hidden by default and preferences remembered per page.
7. Row hover actions on their own line (`ListRowActions` / `RowAction`): Details, Edit, Delete.
8. Click a row to open a right-side `MasterDetail` / `DetailPanel` with `DetailSection` + `DetailField` blocks and an Edit button that opens the existing dialog.
9. `EmptyState` when there are no records.
10. Grouped rows use `GroupHeaderRow` when group-by is active.

## Pages to convert

Full conversion (currently hand-rolled grids or partial adoption):

- Clients — has a detail panel already; replace the CSS-grid rows with the list table, add DataToolbar, column picker and KPI strip. Keep the card/list layout toggle and lead highlighting.
- Suppliers — same treatment as Clients; keep the expandable bank-details block, moved into the detail panel.
- Expenses — replace the 12-column div grid with the list table; keep the KPI cards, aging panel, and Bill/Ad-hoc tabs above the toolbar.
- Companies — list table + detail panel; keep logo/stamp editing inside the dialog.
- Team — list table + detail panel; keep the existing `useDataView` fields and company-visibility badge.
- Budgets — list table for categories with a detail panel showing period breakdown.
- Payroll and Journal — replace hand-rolled 12-column grids with the list table primitives (read-only rows; detail panel where a record has a drill-down).
- Purchase orders — already uses the primitives; align the detail panel, KPI strip, and toolbar ordering with Projects.

Alignment-only (already table-based; needs detail panel + consistent header/toolbar/KPI order):

- Transactions — add a `DetailPanel` on row click (amounts, account, project, matched invoice) and align chrome.
- Accounts — add a `DetailPanel` (balance, currency, reconciliation state) and align chrome.
- Invoices and Quotations — already close; only fix ordering/spacing differences so all pages match.

## Behaviour rules kept intact

- Role restrictions stay: sales-only users keep seeing no revenue/cost/profit/margin columns or finance KPIs, on every converted page.
- Company scoping (`inScope`), aging panels, Kanban/list layout toggles, bulk-select, reconcile buttons, notifications and status menus keep working exactly as today.
- Existing create/edit dialogs are reused unchanged; the detail panel only links to them.
- No database, RLS, or business-logic changes — this is presentation only.

## Technical notes

- Reuse existing primitives; no new shared components unless a page needs a genuinely new cell type.
- Each converted page gets a `COLUMNS: ColumnDef[]` constant and a `useColumnPrefs("<page>", COLUMNS)` call, with heavy or secondary columns marked `priority: "optional"`.
- Each page gets a `FieldDef<T>[]` array and `useDataView<T>("<page>", fields)`; grouped output renders through `GroupHeaderRow`.
- Detail panels are local `DetailPanel` renders inside each route file, following the `projectDetail` shape in `projects.tsx`.
- Mobile: the list table already truncates rather than scrolling; the existing stacked/card fallbacks stay for narrow viewports.

## Suggested order

1. Clients, Suppliers (highest traffic, largest visual gap).
2. Expenses, Transactions, Accounts.
3. Companies, Team, Budgets.
4. Payroll, Journal, plus final alignment pass on Invoices, Quotations, Purchase orders.
