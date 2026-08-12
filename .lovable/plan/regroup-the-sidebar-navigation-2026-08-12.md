# Regroup the sidebar navigation

The sidebar currently mixes sales documents, banking, day-to-day operations and accounting inside the same groups. Proposed regrouping, based on the pages that actually exist in the app.

## Current problems

- "Finance" holds Quotations, Purchase orders and Invoices — those are the sales/billing cycle, not treasury.
- Expenses sits in "Operations" while Transactions and Accounts sit in "Finance", although all three are money movements.
- Billing (recurring) is far away from Invoices.
- Projects and Sales team sit in "Organization" next to Companies and Users & Access, away from Clients/Pipeline.
- Reports and Budgets sit with banking rather than with analysis.
- About and Settings are not in the sidebar at all.

## Proposed grouping

```text
Overview
  Dashboard
  Axel AI

Sales
  Pipeline
  Quotations
  Clients
  Projects
  Sales team

Billing
  Purchase orders
  Invoices
  Recurring billing

Treasury
  Accounts
  Transactions
  Expenses
  Suppliers

Accounting
  Plan comptable
  Journal
  Grand-livre
  Balance
  Bilan
  Compte de resultat

Analysis
  Budgets
  Reports

Administration
  Companies
  Team
  Payroll
  Users & Access   (group admin only)
  Settings
  About
```

## Behaviour that stays the same

- Sections stay collapsed by default; the section containing the active route auto-expands.
- The group-admin-only flag on Users & Access is preserved.
- Sales-only users still see just Quotations, Clients, Projects and Settings — those items now live under Sales and Administration, so empty groups are hidden automatically for them.

## Technical notes

Single edit to the `sections` array in `src/components/app-shell.tsx`, plus icons for the two newly-listed pages (Settings, About) and a filter so a group with no visible items is not rendered. No routes, data or permissions change.

## Open point

If you prefer different group names (for example keeping "Finance" and "CRM"), or want a specific page moved elsewhere, tell me and I will adjust before implementing.
