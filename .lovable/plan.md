# Mobile readability overhaul — tables and columns

## Problem

On phones every data page still renders the full desktop table inside a horizontal scroller (for example the invoices list is a 900px-wide table squeezed into a 390px screen). The result: tiny text, columns cut off, side-scrolling to reach amounts and actions, and cramped toolbars above the table.

## Approach

Stop shrinking desktop tables on small screens. Below the `md` breakpoint, the same data renders as a stacked card list; from `md` up, the existing table is unchanged.

### 1. Shared responsive list primitive

A new `ResponsiveTable` / `RecordCard` pair in `src/components`:

- Desktop (`md+`): renders the current `<table>` markup exactly as today.
- Mobile: renders one card per row — a title line (document number / name), a secondary line (client, date), a right-aligned key figure (amount), a status pill, and an actions menu. Secondary fields become label/value pairs inside the card.
- Row click, focus highlighting (`?focus=` deep links), and selection behave identically in both modes.

### 2. Page-by-page rollout

Business lists get the card treatment (priority fields in brackets):

- Invoices, Quotations [number, client, date, amount, status, PO/flag badges]
- Purchase orders, Expenses, Suppliers [reference, party, amount, status]
- Clients, Projects, Team, Sales team, Users & access [name/avatar, company, role/stage, secondary meta]
- Transactions [date, label, category, signed amount]
- Payroll, SOPs compliance + escalation ladder [subject, period/step, state]

Accounting ledgers (journal, grand-livre, balance, bilan, compte-résultat, plan comptable) stay tabular because columns are numerically aligned by nature, but get: sticky first column, smaller gutters, right-aligned monospace figures, and a visible scroll affordance instead of a silent cut-off.

### 3. Surrounding chrome

- Toolbars/filters: stack full-width on mobile, search first, filters collapse into a single "Filters" sheet.
- Page headers: title truncates, primary action becomes a full-width button under the title.
- KPI/stat grids: 1 column on phones, 2 on tablets.
- Dialogs and preview panes: full-height sheets on mobile with scrollable body and pinned footer actions.
- Minimum 14px body text and 44px tap targets everywhere in the mobile list views.

## Technical notes

- Breakpoint logic uses Tailwind classes (`hidden md:block` / `md:hidden`) so both variants render from one data map — no JS viewport detection, no duplicate state.
- Applies the responsive-layout rules already used in the shell: `grid-cols-[minmax(0,1fr)_auto]` header rows, `min-w-0` on text containers, `shrink-0` on icons, `truncate` on single-line headings.
- No changes to data fetching, RLS, roles, numbering, or document logic — presentation only.

## Verification

Playwright screenshots at 390px, 768px and 1280px for invoices, transactions, team, clients and SOPs to confirm nothing is clipped and no horizontal page scroll remains.
