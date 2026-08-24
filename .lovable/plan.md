# Add the missing navigation modules

Audit of the six requested sections against what the app already has:

| Requested section | Status | Action |
| --- | --- | --- |
| Axel Sales (CRM) | Exists — "Sales" group: Pipeline, Quotations, Clients, Projects, Sales team | Skip entirely |
| Axel Books (Finance) | Exists — Billing, Treasury, Accounting, Analysis groups (Invoices, Expenses, Reports, cash flow) | Skip entirely |
| Axel Forge (files, tasks, projects) | Partial — Projects exists; Files and Tasks are missing | Build Files + Tasks only |
| Axel Customer Support | Missing | Build |
| Axel People (HR & Payroll) | Exists — "People" group: Team, Time & Attendance, Leave, Kiosk, Payroll | Skip entirely |
| Integrations Hub | Missing | Build |

## New sidebar grouping

```text
Axel Forge          (new group, placed after Sales)
  Files
  Tasks

Customer Support    (new group, placed after Billing/Treasury blocks)
  Tickets
  Service requests

Administration      (existing group — one item appended)
  ...
  Integrations Hub
```

Existing groups, labels, order and items are left untouched. Projects stays where it is under Sales; it is not duplicated into Axel Forge.

## New pages (5)

Each new page is a shell only — no data model, no backend, no writes:

- `/files` — Files: "Shared documents and assets for your team."
- `/tasks` — Tasks: "Track work items across projects and teams."
- `/tickets` — Tickets: "Customer issues raised through support channels."
- `/service-requests` — Service requests: "Formal requests for service, access or change."
- `/integrations` — Integrations Hub: "Connect Axel to the tools your team already uses."

Every page uses the same shell as current pages: `AppShell` + `PageHeader` (title + one-line description), then a content area containing:

- A placeholder table (Files, Tasks, Tickets, Service requests) styled like existing list pages, with realistic column headers and no rows.
- The shared `ListEmptyState` "No records yet" block with a disabled "Add" button (icon + message + button), matching current empty states.
- Integrations Hub instead shows a card grid of placeholder connected apps (name, short description, "Not connected" chip, disabled Connect button), reusing the panel/card styling used elsewhere.

## Technical notes

- Routes: new files under `src/routes/_authenticated/` (`files.tsx`, `tasks.tsx`, `tickets.tsx`, `service-requests.tsx`, `integrations.tsx`), each `createFileRoute("/_authenticated/<name>")`. The generated route tree picks them up automatically.
- Nav: two new entries in the `sections` array in `src/components/app-shell.tsx` plus one item appended to Administration, using lucide (Material-style) icons: FolderOpen, CheckSquare, LifeBuoy, Ticket, ClipboardCheck, Plug.
- Empty states reuse `ListEmptyState` from `src/components/list-state.tsx`; the "Add" button is rendered disabled since there is no create flow yet.
- Sales-only users: the new routes are not added to `SALES_ROUTES`, so behaviour for that role is unchanged.
- No database, migration or permission changes.
