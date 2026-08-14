# Make every "New" button page-specific

Today the purple "New" button in the top bar and the "New" button inside each page are generic. On some pages the label says just "New", and on pages with no create action (dashboard, reports, ledgers, settings, SOPs, Users & Access, Axel chat) the top-bar button silently jumps to Transactions — which feels broken.

## What changes

1. **Page-specific labels everywhere**
   Each page's own button becomes the real action: "New invoice", "New quote", "New PO", "New client", "New supplier", "New project", "New transaction", "New account", "New expense", "New team member", "New sales member", "Add opportunity", "New company", "New category", "New schedule", "New payroll run", "New journal entry".
   The top-bar button already shows a per-page label; the two are aligned so they always read and do the same thing.

2. **Pages that currently ignore the top-bar button get wired up**
   Clients and Suppliers have their own "New" button but don't respond to the top-bar one. Both will open the same create dialog.

3. **Pages with no create action stop pretending**
   On the dashboard, reports, accounting ledgers (Balance, Grand Livre, Compte de Résultat, Bilan, Plan Comptable), Settings, About, SOPs, Users & Access and Axel, the top-bar button is either mapped to a real, meaningful action for that page or hidden:
   - Dashboard: "New invoice" (goes to Invoices and opens the form)
   - Users & Access: "Add user" (opens the existing Add User dialog, admins only)
   - SOPs: "Log escalation"
   - Axel: "New conversation"
   - Ledgers / reports / settings / about: button hidden, since nothing can be created there.

4. **Permissions respected**
   Sales-only users don't see create buttons on pages they can't write to; the top-bar button hides in the same cases.

## Technical notes

- `CrudToolbar` (src/components/crud-toolbar.tsx) gains an optional `createLabel` prop (defaults to "New"); each page passes its noun. `EmptyState` reuses the same wording.
- `NEW_BUTTON_ROUTES` in src/components/app-shell.tsx is extended with the missing routes and a `hidden: true` case; `Topbar` renders nothing when no action matches instead of falling back to `/transactions`.
- Clients, Suppliers, Users & Access, SOPs and Axel subscribe to the existing `CREATE_EVENT` (either by adopting `CrudToolbar` or a small `useCreateAction(onCreate)` hook extracted from it) so the top-bar button triggers their dialog.
- No data, routing or business-logic changes — labels, visibility and event wiring only.
