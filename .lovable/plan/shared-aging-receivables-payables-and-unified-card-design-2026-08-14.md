# Shared aging (Receivables + Payables) and unified card design

## What you get

1. Two new Treasury pages — **Receivables** (open client invoices) and **Payables** (open supplier bills) — that share the exact same aging buckets, tiles, chart and click-to-filter behaviour as the Invoices page.
2. One card design across the whole app: every page's summary/metric card and every content panel matches the dashboard's card look (rounded, soft border, card shadow, hover lift, trend pill, tone colors).

## 1. Shared aging logic

Today the aging buckets are computed inline inside the Invoices page only (Current / 0-30 / 31-60 / 61-90 / 90+ days past due, on open balance converted to MGA). That logic moves into one shared module so all three pages agree on definitions.

- Bucket definitions, day thresholds, colors and labels live in one place.
- Works for both directions: receivables use invoice `dueDate` / `amount - paid`; payables use supplier bill `dueDate` / `amount - paid` (ad-hoc expenses without a due date are excluded).
- Invoices page switches over to the shared module — same visuals, no behaviour change.

## 2. Shared aging component with click-to-filter

A single reusable block rendering the bucket tiles plus the bar chart:

- Clicking a bucket tile or a bar filters the table below to that bucket only.
- The selected bucket is highlighted; a clear chip removes the filter.
- The chart always reflects the currently active filters (status, PO state, search, company scope) in real time.
- Keyboard accessible (tiles and bars are buttons, Enter/Space toggle, ARIA pressed state) and announced to screen readers.

## 3. New pages

**Receivables** (`/receivables`, Treasury section)
- KPI cards: open, overdue, current, average days late.
- Shared aging tiles + chart with click-to-filter.
- Table of open invoices (number, client, project, company, due, days late, status/PO chips, amount, balance) reusing the existing list table: column resize/reorder persistence, exports, row action icons.
- Row actions link to the invoice (preview, payment, open in Invoices).

**Payables** (`/payables`, Treasury section)
- Same structure against supplier bills: KPI cards, shared aging tiles + chart, table (bill number, supplier, company, due, days late, status, amount, balance).

Both pages respect the current company scope and existing role rules (finance/admin only; sales users don't see them in the sidebar).

## 4. Card design unification

- Every page's local stat/summary card is replaced by the dashboard's `KpiCard` (label, value, sub-line, optional trend pill and tone), keeping each page's existing numbers and semantics.
- Local one-off card definitions on Balance, Clients, Compte de resultat, Pipeline, Invoices, Payroll, Team, Suppliers, Budgets, Expenses, Billing, Projects, Reports, Accounts, SOPs and Settings are removed in favour of the shared component.
- Content panels/section containers are unified to the same surface as the dashboard (same radius, border, shadow, header spacing) via the existing `PanelCard`, so tables, charts and forms all sit on identical surfaces.
- Dark mode and reduced-motion behaviour preserved; no hardcoded colors, tokens only.

## Technical notes

- New `src/lib/aging.ts`: `AGING_BUCKETS`, `bucketOf(daysLate)`, `buildAging(items, { due, balance })` returning tiles + chart rows; consumed by Invoices, Receivables, Payables.
- New `src/components/aging-panel.tsx`: tiles + `ChartFrame`/`BarChart` with `onSelect(bucket)` and `selected` props; uses existing `chartBarProps`, `CHART_SEMANTIC`, `ChartTooltip`.
- New routes `src/routes/_authenticated/receivables.tsx` and `payables.tsx`, registered in the Treasury group in `src/components/app-shell.tsx`, each with its own `head()` metadata and a "New" button mapping (new invoice / new bill).
- Tables reuse `ListTable`, `table-prefs` (per-route width/order persistence), `StatusBadge`/`PoBadge`, `StatusFilterBar` and the existing export menu.
- Card refactor is presentation-only: swap local card markup for `KpiCard` / `PanelCard` imports; no data or business-logic changes.
