# Recreation Prompt for Google AI Studio

Produce a single, self-contained specification prompt that another AI builder (Google AI Studio) can use to rebuild Axel — the Axiom Winford Group finance command center — as a fully working app.

## Deliverable

One markdown file, `docs/axel-recreation-prompt.md`, containing the complete prompt. Nothing else in the app changes.

## What the prompt will cover

**1. Product summary**
Multi-company, multi-currency finance and operations command center for The Axiom Winford Group: quotations, invoicing, receivables governance, accounting ledgers (French PCG), payroll, CRM pipeline and team/role administration.

**2. Stack and constraints**
React 19 + TypeScript, TanStack Router/Start, Vite 7, Tailwind v4 with semantic tokens, shadcn/Radix UI, TanStack Query, Recharts, Supabase (Postgres + Auth + Storage + RLS), html2pdf-style client PDF export. Includes a note on which parts are portable if the target platform uses a different backend.

**3. Full page inventory** (30 screens), each with purpose, key columns/actions and role visibility:
Dashboard, Quotations, Invoices, Purchase Orders, Clients, Projects, Suppliers, Expenses, Transactions, Accounts, Balance, Journal, Grand Livre, Plan Comptable, Bilan, Compte de Résultat, Budgets, Billing, Reports, Payroll, Pipeline, Sales Team, Team, Users & Access, Companies, SOPs, Settings, About, Login, and the hidden Axel AI assistant (feature-flagged off).

**4. Data model**
Table-by-table schema: companies, clients, projects, suppliers, quotes (+ line items, discounts, assignees, follow-ups), invoices (+ PO link/waiver, handover proof, ingestion date), purchase_orders, expenses, transactions, accounts, budgets, payroll_runs, salary_register, team_members, sales_members, profiles, user_roles, user_company_access, notification_prefs, ar_alert_log, audit log. Plus the roles model (super_admin, group_admin, company_admin, manager, finance, project_manager, sales) and the rule that roles live in a separate table with security-definer checks.

**5. Business rules that must be reproduced**
Document numbering series continuity per company, Madagascar TVA 20% applying only from 2026-04-01 for Logia, MGA formatting and amount-in-words, PO-before-invoice with explicit waiver flag, SOP-OPS-FIN-002 receivables ladder (day 15/30/45/60 actions plus nightly email escalation), aging buckets (current/30/60/90+), sales-role scoping (own quotations, clients without financials, projects only), bilingual FR/EN documents.

**6. Design system**
ClickUp-inspired purple primary, Plus Jakarta Sans headings + Inter body, dense 44px rows, icon-only status chips that expand on hover, hover-reveal bottom-left action pills, 150ms cubic-bezier motion, tabular numerals everywhere, sticky headers and filter bars, premium empty/error states, light + dark themes via CSS tokens.

**7. Interaction and performance requirements**
Risk-scoped optimistic UI with save-state indicators, debounced inline text writes, a write journal/rollback trail for failed financial writes, virtualized rows on large tables, cached filter/company/currency switching with background refetch, undo/redo of the last 5 actions, saved filter presets, resizable persisted columns, bulk edit and bulk actions.

**8. Documents and exports**
PDF/print pipeline that matches the on-screen preview exactly: embedded fonts, company logo with crop/size controls, stamps and per-person signatures with drag placement, object title and second description column, optional unit column, fit-to-one-page mode, CSV/Excel table exports.

**9. Build order**
A staged sequence (auth and companies → core CRM entities → documents → accounting → governance/SOPs → polish) so the target builder produces a working app at each step, plus acceptance checks per stage.

## Technical notes

The prompt is written as direct build instructions in second person, with explicit schema blocks, RLS intent, and enumerated acceptance criteria — not as a description of the existing codebase. Secrets, project IDs and real client data are excluded; seed data is described generically.
