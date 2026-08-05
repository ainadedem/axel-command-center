# Sales role scoping + quotation owner

## Goal
1. A user with the **Sales** role only works with sales: their own quotations, the client directory (without any money information), and projects. Everything else is out of reach.
2. Every quotation shows who created it (owner name) inside the app. The printed/PDF document is not changed.

## What changes for a Sales user

Visible pages: Quotations, Clients, Projects (plus About/Settings profile).
Hidden pages: Dashboard/finance KPIs, Invoices, Purchase orders, Expenses, Transactions, Accounts, Journal, Grand livre, Balance, Bilan, Compte de résultat, Reports, Budgets, Payroll, Billing, Suppliers, Team, Sales team, Companies, Users & access, Pipeline.

- **Quotations**: sees and edits only quotations they created. Revenue/aggregate stat cards limited to their own quotes.
- **Clients**: sees the client directory (name, contacts, address, industry, tax IDs) but no revenue, outstanding balance, lifetime value, invoices, or payment/bank details. The bank-details section of the client form is hidden.
- **Projects**: sees project names/clients but not revenue, cost, or margin columns.

## Quotation owner

- Each quotation records the user who created it.
- The Quotations table gets an **Owner** column (display name, falling back to email), sortable and groupable like the other columns.
- The quotation preview/PDF prints a small "Prepared by: <name>" line in the document meta block.
- Existing quotations have no recorded owner and will show "—" until edited; no back-filling is attempted.

## Technical notes

Database migration:
- Add `created_by uuid` to `quotes`, defaulting to `auth.uid()` on insert.
- Replace the quotes SELECT policy so a user with only the `sales` company role sees rows where `created_by = auth.uid()`; other roles keep full company-scoped visibility. Same restriction on UPDATE/DELETE for sales.
- Add a small read path so quote owner names can be resolved: allow authenticated users to read `display_name`/`email` from `profiles` of users sharing a company (via `app_private.has_company_access`), so the Owner column can render a name instead of a UUID.

Frontend:
- Extend `AppRole` usage with a `isSalesOnly` helper in `src/lib/auth-context.tsx` (`roles` contains `sales` and none of super_admin/group_admin/company_admin/finance).
- `src/components/app-shell.tsx`: filter the nav sections by `isSalesOnly`.
- Add a route-level guard: sales-only users hitting a restricted route are redirected to `/quotations`.
- `src/routes/_authenticated/quotations.tsx`: stamp `createdBy` on create, filter list when sales-only, add the Owner column, resolve names from a profiles map.
- `src/routes/_authenticated/clients.tsx` and `projects.tsx`: hide money columns/cards and the payment-details block when sales-only.
- `src/lib/mock-data.ts` + `src/lib/db-sync.ts`: add `createdBy` to the `Quote` type and its row mapping.
- `src/components/document-preview.tsx`: optional `preparedBy` field rendered in the meta block.

## Out of scope
- Changing what other roles (finance, viewer, admins) can see.
- Per-client ownership for sales users (they see the whole client directory).
