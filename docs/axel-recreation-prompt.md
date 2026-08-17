# Axel — Full Recreation Prompt (for Google AI Studio)

Copy everything below the line into Google AI Studio (or any capable AI app builder) as a single build brief. It is written as direct instructions to the builder. No secrets, project identifiers, or real client data are included.

---

## 0. Mission

Build **Axel**, the finance and operations command center of **The Axiom Winford Group** (AXWG). It is a multi-company, multi-currency web application that runs a real services business end to end: CRM pipeline, quotations, purchase orders, invoicing, receivables governance, treasury, French-plan accounting (PCG), payroll, team and role administration.

Ship a working app, not a mockup: every screen reads and writes real persisted data, authentication and per-company permissions are enforced server-side, and documents export to PDF exactly as previewed.

Primary users: group executives, company admins, finance controllers, project managers, and sales representatives — with strictly different visibility.

Locales: English UI, French/English business documents. Primary currencies: MGA (Malagasy ariary), EUR, USD.

---

## 1. Stack and hard constraints

- React 19 + TypeScript, Vite 7.
- File-based routing (TanStack Router or equivalent). Client-rendered SPA behind an auth gate; no SSR requirement.
- TanStack Query for all server state, with cached data kept on screen during background refetch.
- Tailwind CSS v4 with **semantic design tokens only** — every color, shadow, gradient and radius is a CSS variable in one global stylesheet. Never hardcode `text-white`, `bg-black`, or hex values in components; both light and dark themes must work.
- shadcn/ui + Radix primitives for all interactive components.
- Recharts for charts.
- Postgres backend with Row Level Security, email/password + Google auth, object storage buckets, and server-side functions (Supabase or an equivalent managed Postgres/auth/storage platform).
- Client-side PDF generation from HTML (html2canvas + jsPDF style pipeline) with fonts embedded as base64.
- `@tanstack/react-virtual` (or equivalent) for row virtualization.

Rules that must hold:
1. Roles are **never** stored on the profile/users table. They live in dedicated `user_roles` and `user_company_access` tables and are checked through `SECURITY DEFINER` SQL functions to avoid recursive RLS.
2. Every public-schema table gets explicit `GRANT`s alongside RLS policies.
3. Server-only keys are never exposed to the browser.
4. No money value is ever optimistically shown as "saved" before the server confirms it.

---

## 2. Roles and access model

Platform roles (`app_role` enum): `super_admin`, `group_admin`, `company_admin`, `manager`, `finance`, `project_manager`, `sales`.

- `super_admin` / `group_admin`: every company, every screen, user administration.
- `company_admin`: full access within granted companies.
- `finance`: all money screens within granted companies; no user administration.
- `manager` / `project_manager`: operational screens, documents they own or are assigned to.
- `sales`: **only** Pipeline, Quotations (only ones they created or are assigned to), Clients (with all financial fields hidden), Projects, and their own profile. No treasury, accounting, payroll, invoices, reports, or admin. Enforce this both in navigation and in RLS.

Company scoping: a workspace switcher at the top of the sidebar toggles between "Group" (aggregate of every company the user may see) and a single company. All queries, KPIs, numbering, and write permissions respect the active scope. Maintain a separate list of *writable* company ids so read-only visibility never produces silent RLS rejections on save.

A **Users & Access** page (group admins only) lists every user with a per-company role matrix of checkboxes, lets an admin invite/create a user with an initial role, shows an "Effective access" diagnostics panel (what this user can actually do, computed server-side), a "verify my role" button, and an append-only audit log of every role change.

---

## 3. Data model

Create these tables in the public schema. Every table carries `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (via a shared `update_updated_at_column()` trigger), and — where documents are concerned — `created_by uuid` set by trigger from the session and **frozen** on update.

**Organisation**
- `companies` — name, short_name, legal_name, address, nif, stat, rcs, phone, email, website, base_currency, logo_url, logo_width, logo_crop, stamp_url, bank_accounts (jsonb array: label, bank, iban/rib, swift, currency), invoice/quote numbering prefixes and formats, document_language default.
- `profiles` — user_id (fk to auth user), display_name, email, avatar_url, signature_url, job_title.
- `user_roles` — user_id, role (`app_role`), unique(user_id, role).
- `user_company_access` — user_id, company_id, role.
- `user_admin_audit` — actor_user_id, target_user_id, action, detail jsonb, created_at.

**CRM and delivery**
- `clients` — company_id, name, address, billing_email (optional), contact_name, phone, nif, stat, rcs, payment_terms_days, currency, notes.
- `projects` — company_id, client_id, name, code, status, start_date, end_date, budget, owner_user_id.
- `suppliers` — company_id, name, category, contact, payment_terms, nif/stat.
- `opportunities` (Pipeline) — company_id, client_id, title, stage (lead → qualified → proposal → negotiation → won/lost), value, currency, probability, expected_close, owner_user_id.
- `team_members` — company_id (nullable = global), user_id (nullable for non-login staff), full_name, role_title, email, phone, employment_type, monthly_salary, avatar_url, active.
- `sales_members` — company_id, user_id, display_name, target, commission_rate. Kept in sync automatically: any user granted the `sales` role appears here and links back to their team profile.

**Documents**
- `quotes` — company_id, client_id, project_id, number, object_title, issue_date, valid_until, currency, fx_rate, status (draft/sent/accepted/rejected/expired), language (fr/en), subtotal, discount_percent, discount_amount, tax_rate, tax_amount, total, notes, terms, bank_account_index, signer_user_id, stamp_position jsonb, show_unit_column, fit_one_page, column_widths jsonb, assigned_to uuid[] (max 3, no duplicates — enforced by trigger), created_by, pdf_url.
- `invoice_lines` and quote lines — document_id, position (for drag reordering), description, details (markdown/rich text, second column), unit, quantity, unit_price, discount_percent, line_total.
- `invoices` — same document fields as quotes, plus client_id, project_id, quote_id, po_id, `po_waived boolean`, ingestion_date (date the client formally received it), handover_proof_url, due_date, amount, paid, status (draft/sent/partial/paid/overdue/cancelled).
- `purchase_orders` — company_id, client_id, number (the **client's** PO number), issue_date, amount, currency, file_url, notes. POs are captured from the client, not authored in the app.
- `recurring_billings` — company_id, client_id, template jsonb, cadence, next_run, active.
- `document_activity` — document_type, document_id, actor_user_id, action, detail jsonb, created_at (timeline shown on each document).
- `pvr_records` — handover/acceptance certificates linked to invoices.

**Treasury and accounting**
- `accounts` — company_id, name, type (bank/cash/mobile money), currency, opening_balance, opening_date, bank_name, iban.
- `transactions` — company_id, account_id, date, label, amount (signed), currency, category_id, counterparty, reference, reconciled, reconciliation_id, attachment_url.
- `categories` — company_id, name, kind (income/expense), pcg_account.
- `expenses` — company_id, supplier_id, project_id, date, description, amount, currency, category, payment_status, receipt_url.
- `budgets` — company_id, period, category_id, planned_amount.
- `bank_reconciliations` — company_id, account_id, period_start, period_end, statement_file_url, opening_balance, closing_balance, matched jsonb, status.
- Accounting views/derivations for Plan comptable (French PCG chart of accounts), Journal, Grand-livre, Balance, Bilan, Compte de résultat.

**Payroll**
- `payroll_runs` — company_id, period, status, gross_total, net_total, charges_total.
- `salary_register` — payroll_run_id, team_member_id, gross, deductions jsonb, net, paid_at.

**Governance**
- `invoice_escalations` — invoice_id, stage, performed_at, performed_by, note.
- `ar_alert_log` — company_id, invoice_id, stage, recipients text[], error_message, created_at (deduplication key = invoice_id + stage).
- `notification_prefs` — user_id, ar_alerts_enabled, stages int[], weekly_summary_enabled.

**Storage buckets** (all private, served through signed URLs): `avatars`, `documents` (PO files, receipts, statements, handover proofs), `quote-pdfs`, `branding` (logos, stamps, signatures).

**Required SQL helpers**
- `has_role(_user_id uuid, _role app_role) returns boolean` — stable, security definer, `set search_path = public`.
- `has_company_access(_user_id, _company_id)` and `has_company_role(_user_id, _company_id, _roles text[])` in a private schema.
- `document_numbers(_company_id uuid, _kind text) returns text[]` — returns every number already used company-wide even for users who can only see their own documents, so numbering series never collide or restart.
- `can_touch_quote(_quote_id uuid)` — true for company admins/managers/finance/PM, the creator, or an assignee.

---

## 4. Screens

Sidebar, grouped and collapsible (all groups collapsed by default except the active one), with the workspace switcher on top and a context-aware primary "New …" button in the header that always creates the entity of the current page.

**Overview** — Dashboard.
**Sales** — Pipeline, Quotations, Clients, Projects, Sales team.
**Billing** — Purchase orders, Invoices, Recurring billing.
**Treasury** — Accounts, Transactions, Expenses, Suppliers.
**Accounting** — Plan comptable, Journal, Grand-livre, Balance, Bilan, Compte de résultat.
**Analysis** — Budgets, Reports.
**Operations** — SOPs & Compliance.
**Administration** — Companies, Team, Payroll, Users & Access (group admin only), Settings, About.

Plus `/login` and a feature-flagged AI assistant route that ships **disabled** behind a `FEATURES.axelAI = false` flag.

Screen notes:

- **Dashboard** — KPI cards (cash position, receivables outstanding, revenue MTD/YTD, overdue count, pipeline weighted value), revenue vs expense chart, invoice aging chart, recent activity, SOP compliance summary. All reactive to the workspace scope.
- **Quotations** — dense table, per-line editor with drag reordering, object title, second "details" column, per-line and global discounts, optional unit column, up to 3 assignees, follow-up panel with dated notes and next-action reminders, duplicate → invoice conversion, PDF preview and export.
- **Invoices** — everything quotations has, plus PO linkage or explicit waiver (rows without either show a "PO missing" flag), payment recording with partial payments, aging bucket chart with click-through drawer, saved filter presets, status + PO-state filter bar, bulk actions (mark paid / mark sent / cancel / bulk reassign client or project), resizable persisted columns.
- **Purchase orders** — capture the client's PO number, amount, date and uploaded file; link to invoices.
- **Clients** — full legal identity form (name, address, billing email *optional*, NIF, STAT, RCS, payment terms). Sales users see the record without any financial column.
- **Accounts / Transactions** — real-time balance derived from opening balance + transactions, virtualized transaction table with inline debounced editing, CSV/statement import, and a four-step bank reconciliation wizard (upload statement → auto-match → resolve exceptions → lock period) with exportable results.
- **Accounting screens** — French PCG chart, double-entry journal, general ledger by account, trial balance, balance sheet, income statement; each period-filterable and exportable.
- **Payroll** — monthly runs built from team members with per-company scoping; salary register per run.
- **SOPs & Compliance** — renders SOP-OPS-FIN-002 as a live checklist per invoice: each rung turns green when performed and red when due, every warning deep-links to the exact source document, plus a weekly compliance summary card and a demo workspace toggle for training.
- **Settings** — profile (avatar upload with cropping, signature upload), theme (light/dark/system), notification preferences (AR stages, weekly summary), export defaults.
- **Companies** — company profile, branding (logo with crop + width control, stamp upload with background keying), bank accounts editor, numbering formats, default document language.

---

## 5. Business rules (non-negotiable)

1. **Numbering** — per company and document kind, format `PREFIX-YYYY-NNNN`. The next number is computed from `document_numbers()` so it is continuous across all users, even for sales users who can only see their own quotes.
2. **VAT** — Malagasy TVA at 20% applies to the Logia entity **only for documents dated on or after 2026-04-01**; earlier documents carry no VAT. Other entities follow their own configured rate. Implement this as one pure function used by preview, totals and export.
3. **Amounts** — MGA is formatted with no decimals and a space thousands separator; documents print the total in words ("Arrêté à la somme de …") in French or English per document language.
4. **PO before invoice** — an invoice must reference a client PO or carry an explicit `po_waived` flag with a reason; waived invoices are visibly flagged everywhere.
5. **Receivables ladder (SOP-OPS-FIN-002)** — measured from ingestion_date (fallback issue_date):
   - Day 15: courtesy confirmation that the invoice is booked and scheduled.
   - Day 30: written follow-up to the client finance contact, copying the project sponsor.
   - Day 45: formal reminder with completion certificate and handover proof attached.
   - Day 60: executive escalation — suspend new work pending settlement.
   A nightly scheduled job scans open invoices, computes the highest crossed rung, emails finance/company admins of the owning company (respecting each user's notification preferences), and writes one `ar_alert_log` row per invoice+stage so nobody is emailed twice. The endpoint is a public HTTP route protected by a **server-only shared secret header** — never by a browser-visible key — and the scheduler is configured with that same secret.
6. **Aging buckets** — current, 1–30, 31–60, 61–90, 90+; one shared computation feeds both receivables and payables charts and the click-through drawer.
7. **Sales scoping** — enforced in RLS, not just in the UI.
8. **Ownership** — `created_by` is set by trigger and frozen; every document shows who created it, who last updated it and when, with an activity timeline.

---

## 6. Design system

- **Palette**: Material 3 / Google Workspace inspired. Light theme primary `#0B57D1` (hover `#0A4CB8`, container `#C2E7FF`, on-container `#001D35`), dark theme primary `#A8C7FA` on `#062E6F`. Neutral surfaces expressed as `--surface`, `--surface-container`, `--surface-container-high`. Semantic status colors for success/warning/danger/info. Base radius `0.75rem`, pill-shaped (`rounded-full`) navigation and action controls.
- **Typography**: `Plus Jakarta Sans` for headings/display, `Inter` for body, loaded via a `<link>` in the document head (never a CSS `@import` of a remote URL). Weights 400–700. Tabular numerals (`font-feature-settings: "tnum" 1`) on every numeric cell, KPI, input and chart axis so digits never jitter.
- **Density**: table rows ~44px, compact padding, sticky table headers and sticky filter bar (measure the header with a ResizeObserver so offsets stay correct).
- **Motion**: 150ms `cubic-bezier(0.2, 0, 0, 1)` for hover/press; transform and opacity only, never layout properties. Buttons press to `scale(0.99)`; cards lift subtly on hover.
- **Row actions**: hidden until row hover, then a floating rounded pill pack anchored bottom-left of the row, icon-only, with labels fading in on icon hover. Same animation everywhere.
- **Status**: icon-only colored chips (paid, sent, overdue, draft, cancelled, PO missing) that expand to show their label on hover.
- **States**: designed empty state, "no results for these filters" state, and error state with retry for every list; skeletons that match final row height so nothing shifts.
- **Charts**: shared `ChartFrame` wrapper — consistent margins, muted gridlines, brand palette, rounded bar corners, tabular tick labels, accessible tooltips.
- **Accessibility**: landmarks, visible focus rings, keyboard-reachable row actions, ARIA labels on icon-only controls, contrast ≥ 4.5:1 including sidebar text.
- **Responsive**: below `md`, tables collapse to stacked cards with label/value pairs — never horizontal scroll for primary data. The sidebar becomes a sheet.

---

## 7. Interaction and performance requirements

- **Risk-scoped optimistic UI**: low-risk edits (labels, notes, filters, ordering, presets) apply instantly and reconcile in the background. High-risk financial mutations (amounts, payments, status transitions, reconciliation locks) wait for server confirmation and show a pending state — never a premature "Saved".
- **Save-state indicators**: each editable row/field shows idle → saving → saved → error. On error, a popover shows the previous value, the attempted value and the server message, with one-click restore.
- **Write journal**: a global, persisted trail of write attempts (entity, field, before, after, result, timestamp) reachable from the app shell, so a failed financial write is always auditable and reversible.
- **Debounced writes**: inline text and number editing debounces ~500ms; high-risk mutations bypass the debounce and commit explicitly.
- **Cached switching**: changing company, currency, filter or sort renders instantly from cache with a quiet "Updating…" marker while the background refetch reconciles.
- **Virtualized rows** on Transactions, Invoices, Quotations, Grand-livre and any table that can exceed a few hundred rows.
- **Undo / redo** of the last 5 user actions, with a toast and keyboard shortcuts.
- **Persistence per user**: column widths, visible columns, filter presets, sidebar group state, theme.
- **Deep links**: clicking an aging bucket or a compliance warning navigates to the target list and scrolls to and highlights the exact row.

---

## 8. Documents and exports

- The PDF must be pixel-faithful to the on-screen preview. Render the document into an isolated iframe with the same stylesheet, wait for fonts and images to resolve (with a timeout and a safe fallback), then rasterize and paginate manually.
- Embed brand fonts as base64 in the export pipeline and cache the fetched font payloads across exports.
- Company logo with adjustable width and crop; company stamp and per-signer signature images with background keying and draggable placement (position stored as percentages so it survives any page size).
- Document options: object title, second "details" column, optional unit column, per-line and global discounts, bank account selection, FR/EN language, fit-to-one-page mode, and column widths shared between the on-screen table and the export.
- Bulk re-render action to refresh stamps/signatures on existing documents after branding changes.
- CSV/Excel export on every table honoring current filters, sort and visible columns.
- Include an automated typography regression check that asserts exported HTML resolves to the same font stack and numeric features as the preview.

---

## 9. Build order (ship something working at each stage)

1. **Foundation** — design tokens, layout shell, sidebar, theme switching, auth (email + Google), profiles, companies, workspace switcher. *Accept when:* a user can sign in, switch companies, and see an empty but styled dashboard.
2. **Access control** — user_roles, user_company_access, security-definer helpers, RLS on everything created so far, Users & Access page with the role matrix and audit log. *Accept when:* a sales user is blocked from finance screens by the database, not just the menu.
3. **CRM** — clients, projects, suppliers, pipeline, team members, sales-team sync. *Accept when:* CRUD works with per-company scoping and sales users see clients without financials.
4. **Documents** — quotations then invoices: line editor, numbering, VAT, discounts, preview, PDF export, purchase orders, PO waiver, activity timeline. *Accept when:* a quote converts to an invoice and both export identically to their preview.
5. **Treasury and accounting** — accounts, transactions, expenses, budgets, reconciliation wizard, PCG, journal, ledger, balance, bilan, compte de résultat. *Accept when:* account balances reconcile to opening balance + transactions and the trial balance nets to zero.
6. **Governance** — SOP checklist, escalation ladder, aging charts and drawer, nightly alert job with secret-protected endpoint, notification preferences, weekly summary. *Accept when:* an invoice past day 30 shows red on the ladder and produces exactly one logged alert.
7. **Payroll** — runs and salary register per company.
8. **Polish** — virtualization, optimistic UI and write journal, undo/redo, filter presets, resizable columns, empty/error states, mobile stacked tables, accessibility pass.

Seed a small generic demo dataset (two companies, a handful of clients, projects, quotes, invoices across aging buckets, and transactions) via SQL inserts so every screen is populated on first load.
