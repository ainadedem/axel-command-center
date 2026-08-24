# Regroup Axel into 6 modules with a home launcher

Everything the app already does stays exactly as it is. This is a navigation and entry-point change: the nine current sidebar groups are regrouped into the six requested modules, and a new home page lets the user pick which Axel to work in.

## The launcher at /

`/` becomes the Axel launcher: a calm card grid, one card per module (Material icon, module name, one-line description, and the count of pages inside). Picking a card navigates to that module's default page and sets it as the active module. The current finance dashboard moves to `/dashboard` (unchanged content), and `/` no longer renders it.

The last chosen module is remembered locally, so a returning user goes straight back to it; the launcher is always reachable from the app logo and from a "Switch module" item at the top of the sidebar.

## Module map (existing pages only)

```text
Axel Sales        default /pipeline
  Pipeline, Quotations, Clients, Sales team

Axel Books        default /dashboard
  Dashboard
  Billing:     Purchase orders, Invoices, Recurring billing
  Treasury:    Accounts, Transactions, Expenses, Suppliers
  Accounting:  Plan comptable, Journal, Grand-livre, Balance, Bilan, Compte de resultat
  Analysis:    Budgets, Reports

Axel Forge        default /projects
  Projects, Files, Tasks, SOPs & Compliance

Axel Customer Support   default /tickets
  Tickets, Service requests

Axel People       default /team
  Team, Time & Attendance, Leave, Kiosk, Payroll

Integrations Hub  default /integrations
  Integrations Hub
```

Administration (Companies, Users & Access, Settings, About) stays available in every module as a small group pinned at the bottom of the sidebar, since it is not one of the six modules.

Projects moves from Sales to Forge, as requested; it is not duplicated.

## Sidebar behaviour

- The sidebar shows only the active module's pages, with the module name at the top and a "Switch module" action returning to `/`.
- Books keeps its internal sub-groups (Billing, Treasury, Accounting, Analysis) as collapsible blocks; the block containing the active route auto-expands.
- Opening a URL directly (bookmark, deep link, notification) infers the module from the route, so the sidebar always matches the page you are on.
- Sales-only users see just the Sales module (Pipeline is replaced by their allowed pages: Quotations, Clients) plus Forge's Projects and Settings — same access as today; modules with no visible pages are hidden from the launcher and the switcher.

## Technical notes

- New `src/lib/modules.ts`: the six module definitions (id, label, description, icon, default route, page list) derived from the current `sections` array in `src/components/app-shell.tsx`; a `moduleForRoute(pathname)` helper for deep links.
- `src/components/app-shell.tsx`: renders the active module's items instead of all groups, plus the module header, switcher and pinned Administration group. Breadcrumbs use the module label as the first crumb; the existing "New" button map, search, undo/redo and topbar are untouched.
- New `src/routes/_authenticated/dashboard.tsx` holding the current dashboard component; `src/routes/_authenticated/index.tsx` becomes the launcher. Existing links to `/` for the dashboard (breadcrumb "Home", "New invoice" default action) are repointed to `/dashboard`.
- Active module persisted with the existing `usePersistentState` helper.
- No database, RLS, permission or data changes.
