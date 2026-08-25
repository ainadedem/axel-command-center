# Companies page — Projects-style layout with sales-scoped figures

Convert `Companies` from its card grid to the same shell every converted page uses (Projects is the reference), and make the money on it personal for sales users.

## Layout (matching Projects)

1. `AppShell` + `PageHeader` (unchanged title/description).
2. KPI strip (`KpiCard`): total cash, income, spend, net, entity count — all in MGA.
3. Toolbar row: `CrudToolbar` ("New company" + live count) on the left, `ColumnPicker` + `DataToolbar` on the right.
4. `ListTableShell` / `ListTable` fixed-width table replacing the card grid, columns:
   - Company (logo/color chip + trading name) — always on
   - Code, Base currency — always on
   - Cash, Income, Spend, Net, Accounts, Projects, Clients — the money ones optional-by-default where secondary
5. `ColumnPicker` backed by `useColumnPrefs("companies", COMPANY_COLUMNS)`.
6. Row hover actions on the leading cell (`ListRowActions` / `RowAction`): Details, Edit, Delete — same handlers as today (`companiesStore` + backend delete by code).
7. Row click opens a right-side `MasterDetail` / `DetailPanel`: identity (legal name, code, currency), contact (email, phone, website, address), legal IDs (NIF, STAT, RCS, Tax ID), and a Financials section. Edit button opens the existing `CompanyDialog` unchanged (logo, stamp, bank accounts all stay in the dialog).
8. `EmptyState` when there are no companies; `GroupHeaderRow` when group-by is active.
9. `useDataView<Company>("companies", fields)` for search / sort / group-by (group by base currency, sort by name or any figure).

## Sales users see only their own figures

Sales-only users (`useEffectiveRole().isSalesOnly`) keep the same page and table, but every money value is computed from records that belong to them instead of the whole entity:

- Their clients: clients where they are the acquisition or closer contact.
- Their documents: quotations and invoices they created or are assigned to.
- Their projects: projects whose client is one of their clients.

Cash, Income, Spend, Net, and the KPI strip are then derived from that subset only:
- Income = collected on their invoices; Spend = expenses/transactions linked to their projects; Net = the difference.
- Cash (entity bank balance) is not attributable to a person, so it is hidden for sales users along with the Accounts column.
- Counts (Projects, Clients, documents) also reflect their subset.

Each figure keeps a "yours" marker in the header tooltip so a sales user knows the number is personal, not the entity total. Nothing is computed for a sales user from records outside their ownership, so no group-wide finance leaks through this page.

## Rules kept intact

- Company scoping, create/edit dialog, logo & stamp editing, bank accounts editor, stamp-dirty refresh, and delete-by-code behaviour are untouched.
- No database, RLS, or business-logic changes — presentation plus a client-side ownership filter for the displayed figures.

## Technical notes

- New `COMPANY_COLUMNS: ColumnDef[]` + `useColumnPrefs("companies", …)`; `FieldDef<Company>[]` + `useDataView`.
- Ownership resolution reuses existing helpers already used by the sales-scoped pages (`useEffectiveRole`, the auth user id, quote `assignedTo` / `createdBy`, client `acquisition` / `closer`), extracted into a small local `useOwnedScope()` memo inside the route file.
- Detail panel is a local `DetailPanel` render following the `projectDetail` shape in `projects.tsx`.
