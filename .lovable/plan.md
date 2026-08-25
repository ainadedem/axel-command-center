# Notion-dense Projects-style UX unification

Unify the high-traffic entity pages around one dense, readable Projects-style pattern: persistent navigation, compact table-first layouts, one-click row focus, and consistent right-side detail panels.

## Goals

- Make Axel feel closer to Notion: dense, calm, readable, and everything important visible without jumping between views.
- Reduce page-to-page friction by making desktop navigation more direct and less hidden behind the icon rail/module switcher.
- Remove inconsistent table/grid/card styling across similar modules.
- Keep all existing business logic, permissions, dialogs, Kanban boards, status flows, PDF previews, and backend data unchanged.

## Current state confirmed

- `Projects` is the clearest reference: `AppShell`, `PageHeader`, `CrudToolbar`, `DataToolbar`, `ColumnPicker`, KPI strip, `ListTable`, and `MasterDetail`/`DetailPanel`.
- `Companies` already uses `ListTable`, `ColumnPicker`, `DataToolbar`, KPI cards, and a `MasterDetail` panel, but should be folded into the new shared shell for spacing and behavior consistency.
- `Team` still uses a hand-rolled 12-column div grid and has no row detail panel.
- `Payroll` uses separate card/grid layouts for salary register and monthly runs, with inline expanded details instead of the shared list/detail pattern.
- `Invoices`, `Quotations`, and `Purchase orders` already use many shared primitives, but their toolbar ordering, sticky/filter chrome, spacing, and detail panel behavior are not consistent.
- Desktop navigation currently defaults to a compact icon rail, which adds a click before many page switches.

## Shared Projects-style shell

Create a shared component for entity-list pages, for example `ProjectsStylePageShell`, with these slots:

1. Optional KPI strip.
2. Compact toolbar row:
   - record count / create action
   - search, sort, group, filters
   - column picker
   - page-specific controls such as layout toggle, export, reconcile, status presets
3. Main list area using `ListTableShell` / `ListTable`.
4. Optional `MasterDetail` detail panel using the existing compact panel primitives.
5. Empty, no-match, and loading/error slots.

This gives every page the same spacing, typography, toolbar order, panel sizing, selected-row state, and mobile behavior.

## Navigation and density improvements

- Make the desktop sidebar expanded by default so page-to-page movement is one click again.
- Keep the collapsed rail available as a user choice, but do not make it the default experience.
- Tighten global page spacing through the new shell rather than scattered `p-5 sm:p-10 lg:p-12` blocks.
- Reduce oversized rounded panels and inconsistent gaps so the interface reads more like a dense workspace than separated cards.
- Fix broken/unreadable text by standardizing table cell truncation, line clamping, tooltips, and minimum widths in the shared list primitives.

## Page conversion plan

### Team

- Replace the hand-rolled grid rows with `ListTable` primitives.
- Add `ColumnPicker` with sensible default columns: person, company, role, email, phone, department, linked app user, sales role.
- Keep existing admin-only create/edit/delete behavior.
- Add click-to-open `DetailPanel` with identity, contact, company visibility, app-user link, and sales role details.
- Use the shell toolbar for count, create action, search/sort/group/filter.

### Payroll

- Keep the existing two modes: Monthly runs and Salary register.
- Convert both modes to the shared shell/table pattern.
- Add `useDataView` filters/sorting/grouping to both tables.
- Add `ColumnPicker` for register and runs separately.
- Replace inline run expansion with a right-side detail panel showing entries, paid states, posted transactions, and validate/reopen/delete actions.
- Keep the existing payroll run creation, validation, reopen, timesheet integration, and payment toggles unchanged.

### Invoices

- Preserve Kanban/list toggle, aging panel, bulk selection, status menus, payment matching, PDF preview, and history.
- Reorder the toolbar to match the shared shell: count/create, search/sort/group/filter, status presets, layout/export/columns/reconcile.
- Make detail panel structure match the compact shared pattern and avoid duplicate/oversized filter chrome.
- Keep table virtualization and resizable/reorderable columns.

### Quotations

- Preserve Kanban/list toggle, assignees, follow-ups, history, status actions, and PDF preview.
- Align toolbar ordering and density with Invoices and Purchase orders.
- Use the same compact detail panel behavior as Invoices, including one-click row selection and clear actions.
- Keep sales-scoped visibility and ownership rules unchanged.

### Purchase orders

- Keep the client-PO upload/recording workflow and existing status/document filters.
- Move toolbar and detail panel into the shared shell.
- Standardize row hover actions, selected-row styling, empty states, and detail panel sections.
- Keep quote/invoice linking and document history unchanged.

### Companies

- Keep the existing Projects-style table and sales-user scoped figures.
- Move it onto the shared shell so spacing, toolbar order, selected-row behavior, and detail panel sizing match the other converted pages.
- Keep entity-wide cash/account data hidden for sales-only users.

## Technical notes

- This is a frontend/UX refactor only: no database, policy, storage, or business-rule changes.
- Prefer small reusable layout wrappers over rewriting page business logic.
- Keep existing dialogs and stores; the new shell only standardizes layout and interaction.
- Use semantic design tokens and existing UI components only.
- Verify desktop and mobile rendering after implementation, especially table readability and detail-panel behavior.

## Suggested implementation order

1. Build the shared Projects-style shell and tighten shared list/detail styling.
2. Convert Team and Payroll first because they currently differ most from Projects.
3. Align Purchase orders, Invoices, and Quotations toolbar/detail behavior while preserving their advanced controls.
4. Fold Companies into the shared shell and do a final cross-page density/readability pass.
5. Verify navigation friction, text readability, table alignment, and mobile stacked layouts.
