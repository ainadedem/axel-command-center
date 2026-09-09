# Axel — 100% Clone Build Prompt (for Google AI Studio)

Copy everything below the horizontal rule into Google AI Studio (or any capable AI app builder) as a single build brief. It is written as direct instructions to the builder and describes the application exactly as it exists today. No secrets, project identifiers, credentials or real client data are included.

---

# BUILD BRIEF — AXEL

## 0. Mission

Build **Axel**, the business operating platform of **The Axiom Winford Group** (AXWG). It is a multi-company, multi-currency, role-scoped web application organised into six modules — Sales (CRM), Books (finance & accounting), Forge (projects, files, tasks, SOPs), Customer Support, People (HR, time, payroll) and an Integrations Hub — sitting behind a module launcher home screen.

Reproduce it **exactly**: every screen, every column, every dialog field, every rule, every token, every animation. Do not redesign, simplify, rename or "improve" anything. Where this brief gives a number, a hex value, a label or a class name, use it literally.

Ship a working app, not a mockup: every screen reads and writes persisted data, authentication and per-company permissions are enforced in the database, and documents export to PDF pixel-identically to their on-screen preview.

- Primary users: group executives, company admins, finance controllers, managers, project managers, sales representatives, and clock-in-only staff.
- UI language: English (the Reports screen is French; business documents are FR/EN per document).
- Currencies: MGA (Malagasy ariary, primary), EUR, USD.
- Time zone for attendance: Madagascar, UTC+3.

---

## 1. Stack and hard constraints

- React 19 + TypeScript, Vite 7.
- TanStack Start + TanStack Router (file-based routing under `src/routes`, `__root.tsx`, an `_authenticated` layout route gating everything).
- TanStack Query for all server state; cached data stays on screen during background refetch.
- Tailwind CSS v4 configured through one global stylesheet (`src/styles.css`) with `@theme inline`, `@utility` and `@custom-variant dark (&:is(.dark *))`. **No `tailwind.config.js`.**
- **Semantic design tokens only.** Every colour, gradient, radius and shadow is a CSS variable. Never write `text-white`, `bg-black` or a hex value in a component. Light and dark themes must both work everywhere.
- shadcn/ui + Radix primitives for all interactive components. `sonner` for toasts.
- Recharts for charts; `@tanstack/react-virtual` for row virtualization.
- Postgres backend with Row Level Security, email/password + Google auth, private storage buckets, typed server functions (`createServerFn`) for app-internal server logic, and HTTP routes under `src/routes/api/public/*` for webhooks and scheduled jobs.
- Client-side PDF generation from HTML (html2canvas + jsPDF pipeline) with fonts embedded as base64.
- Fonts loaded with `<link>` tags in the root route head — never a CSS `@import` of a remote URL.

Non-negotiable rules:

1. Roles are **never** stored on the profiles/users table. They live in `user_roles` and `user_company_access` and are checked through `SECURITY DEFINER` SQL functions to avoid recursive RLS.
2. Every public-schema table gets explicit `GRANT`s alongside its RLS policies.
3. Server-only keys never reach the browser.
4. No money value is ever shown as "saved" before the server confirms it.
5. Document preview and printed/exported PDF layouts are excluded from the app's table skin and typography scale — they carry their own print typography so export matches paper exactly.

---

## 2. Roles and access model

`app_role` enum: `super_admin`, `group_admin`, `company_admin`, `finance`, `sales`, `viewer`. Legacy per-company role strings `manager` and `project_manager` remain readable and are displayed read-only in the admin UI.

- `super_admin` / `group_admin` — every company, every screen, user administration.
- `company_admin` — full access within granted companies.
- `finance` — all money screens within granted companies; no user administration.
- `manager` / `project_manager` (legacy per-company) — operational screens and documents they own or are assigned to.
- `sales` — **only** Pipeline, Quotations (only those they created or are assigned to), Clients (all financial fields hidden), Projects, Sales team, and their own profile. Enforced in navigation, in the launcher, in a route gate, **and in RLS**.
- `viewer` — read-only within granted companies.

Company scoping: a workspace switcher at the top of the sidebar toggles between **Group** (aggregate of every company the user may see) and a single company. All queries, KPIs, numbering and write permissions respect the active scope. Maintain a separate list of *writable* company ids so read-only visibility never produces silent RLS rejections on save.

A route gate inside the authenticated layout redirects sales-only users away from any route not in the sales allow-list, but only **after** company access has resolved (before it resolves, every non-platform user momentarily looks sales-only).

**Users & Access** page (group admins only) — see §5.

---

## 3. Data model

Postgres, `public` schema. Every table: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at` (shared `update_updated_at_column()` trigger). Documents also carry `created_by uuid` set by trigger from the session and **frozen** on update, plus `updated_by`.

### Organisation / access

- **companies** — name, short_name, code, legal_name, color, address, email, phone, website, nif, stat, rcs, tax_id, base_currency, default_document_language, intl_enabled, is_demo, logo_url, logo_crop jsonb, logo_height, logo_max_width, stamp_url, stamp_position, stamp_width, stamp_opacity, show_stamp, show_payment_details, bank_name, bank_account, bank_holder, bank_swift, bank_code, branch_code, account_number, rib_key, iban, mobile_enabled, mobile_provider, mobile_number, mobile_name, bank_accounts jsonb[].
- **profiles** — user_id, display_name, email, avatar_url, signature_url.
- **user_roles** — user_id, role app_role, unique(user_id, role).
- **user_company_access** — user_id, company_id, role text.
- **user_admin_audit** — actor_user_id, actor_email, target_user_id, target_email, company_id, action, requested_role, success bool, error_message, details jsonb.

### CRM

- **clients** — company_id, name, display_name, address, country, email, phone, website, industry, categories text[], color, avatar_url, contacts, nif, stat, rcs, tax_id, status, acquisition, acquisition_year, acquired_at, referral, payment_terms_days, payment_terms_by_currency jsonb.
- **client_bank_details** — client_id, company_id, bank_name/account/holder/swift/code, branch_code, account_number, rib_key, iban, intl_enabled, mobile_enabled/provider/number/name.
- **suppliers** — company_id, name, kind, account, category list, contact_person, email, phone, website, address, country, nif, stat, rcs, tax_id, payment_terms, notes, avatar_url, full bank + mobile-money block.
- **opportunities** — company_id, client, client_id, name, stage, value, currency, probability, expected_close, closer.
- **sales_members** — team_member_id, role, source (auto-synced from `sales` role grants).
- **projects** — company_id, client_id, name, currency, revenue, cost.
- **project_stages** — project_id, company_id, key, name, position, status, auto, owner, planned_start, due_date, started_at, completed_at, blocked_reason, notes.
- **project_stage_templates** — company_id, name, stages jsonb, is_default.
- **recurring_billings** — company_id, client_id, project_id, name, amount, currency, frequency, start_date, end_date, next_run_date, last_generated_at, payment_terms_days, active, notes.

### Documents

- **quotes** — company_id, client_id, project_id, opportunity_id, number, subject, issue_date, valid_until, language, currency, fx_base_currency, fx_rate, mode, lines jsonb, amount, discount_pct, tax_rate, tax_amount, total_amount, status, notes, bank_account_id, signer_id, assigned_to uuid[] (max 3, no duplicates — trigger-enforced), stamp_x, stamp_y, stamp_scale, stamp_dirty, sent_at, sent_to, next_follow_up_at, cancelled_at, cancellation_reason, pdf_url, created_by, updated_by.
- **quote_followups** — quote_id, company_id, kind, note, happened_at, created_by.
- **invoices** — same document envelope as quotes plus quote_id, po_id, po_waived bool, po_waiver_reason, ingestion_date, dating_note, due_date, paid, paid_date, handover_by, handover_proof_url, handover_proof_name, handover_stamped_at, status.
- **invoice_lines** — invoice_id, position, description, details, unit, quantity, rate, discount_pct, level, capability, created_by.
- **purchase_orders** — company_id, client_id, project_id, quote_id, number (the client's PO number), client_reference, buying_entity, issue_date, amount, currency, language, lines jsonb, subject, status, document_url/name/type/uploaded_at, document_history jsonb, bank_account_id, signer_id, stamp fields.
- **pvr_records** — company_id, project_id, quote_id, invoice_id, reference, completion_pct, signed_by, signed_date, scm_coordinator, document_url/name, notes.
- **document_activity** — company_id, doc_type, doc_id, doc_number, actor_id, action, summary, details jsonb.
- **invoice_escalations** — invoice_id, company_id, stage int, action, notes, performed_at, performed_by, performed_by_name.

### Treasury

- **accounts** — company_id, name, type, currency, balance, opening_balance, opening_balance_date, statement_name, statement_uploaded_at.
- **transactions** — company_id, account_id, date, description, amount, type, currency, category, category_id, client_id, supplier_id, project_id, invoice_id, source.
- **bank_reconciliations** — company_id, account_id, period_start, period_end, statement_name, opening_balance, statement_closing_balance, computed_closing_balance, difference, adjustment_amount, adjustment_transaction_id, row_count, created_by.
- **payment_requests** — company_id, title, kind, description, amount, currency, payee, supplier_id, project_id, expense_id, account_id, needed_by, run_id, status, off_cycle bool, off_cycle_reason, attachment_url/name, requested_by, submitted_at, reviewed_by/at, approved_by/at, rejected_by/at, rejection_reason, paid_at.
- **payment_request_events** — request_id, company_id, action, from_status, to_status, actor_id, actor_name, note.
- **payment_runs** — company_id, run_date, status, note, released_by, released_at.
- **ar_alert_log** — company_id, invoice_id, stage, recipients text[], sent_at, error_message. Dedup key = invoice_id + stage.

### Accounting

- **journal_entries** — company_id, date, journal, piece, description, lines jsonb, source.
- **categories** — company_id, name, kind, account, color.
- **budgets** — company_id, year, category_id, amount, currency.
- **expenses** — company_id, supplier_id, project_id, account_id, account, number, kind, category, description, payee, issue_date, due_date, amount, paid, currency, status, payment_cycle, reimbursable_pct, medical_claim bool, funding_invoice_id, attachment_url/name, created_by.

### Payroll / HR

- **team_members** — company_id (nullable), is_global bool, user_id (nullable for non-login staff), name, first_name, last_name, email, phone, job_title, department, avatar_url.
- **salary_register** — team_member_id, company_id, gross, currency, cnaps_rate, irsa_rate, ostie_rate, start_date, active.
- **payroll_runs** — company_id, month, currency, entries jsonb, status, posted_transaction_ids jsonb.
- **leave_requests** — company_id, employee_id, kind, start_date, end_date, half_day, note, status, approved_by, approved_at.
- **holidays** — company_id, date, name, recurring.

### Time & attendance

- **schedules** — company_id, employee_id (nullable), role, name, start_time, end_time, break_minutes, grace_minutes, working_days int[].
- **time_entries** — company_id, employee_id, project_id, clock_in, clock_out, duration_minutes, activity, billable, method, note, photo_url, gps_lat, gps_lng, status, created_by.
- **time_entry_audit** — entry_id, company_id, action, actor_id, actor_name, before jsonb, after jsonb.
- **timesheets** — company_id, employee_id, period_start, period_end, regular_minutes, overtime_minutes, break_minutes, leave_minutes, unpaid_leave_minutes, status, note, approved_by, approved_at.
- **kiosk_credentials** — company_id, employee_id, pin_hash, qr_token.

### Tasks, governance, AI

- **tasks** — company_id, title, notes, status, priority, due_date, assigned_to uuid[], project_id, client_id, quote_id, invoice_id, payment_request_id, completed_at, created_by.
- **notifications** — user_id, company_id, kind, title, body, href, doc_type, doc_id, doc_number, actor_id, actor_name, read_at.
- **notification_email_queue** — user_id, company_id, kind, title, body, href, doc_number, actor_name, scheduled_for, sent_at.
- **notification_prefs** — user_id, ar_alerts_enabled, stages int[], events jsonb, watch_rules jsonb, watch_company_ids uuid[], digest_modes jsonb, quiet_hours jsonb, time_zone.
- **axel_chat_threads** — user_id, title. **axel_chat_messages** — thread_id, user_id, role, parts jsonb. (Behind a disabled feature flag; build the tables and routes, ship the flag off.)

### Required SQL helpers

- `has_role(_user_id uuid, _role app_role) returns boolean` — stable, security definer, `set search_path = public`.
- `has_company_access(_user_id, _company_id)` and `has_company_role(_user_id, _company_id, _roles text[])`.
- `company_directory(_company_id uuid) returns setof (user_id, display_name, email, avatar_url, role)` — security definer, stable. Guard: caller authenticated **and** (has company access, or is group admin, or is super admin). Body unions `user_company_access` rows for that company (priority 0) with `user_roles` rows for `super_admin`/`group_admin` (priority 1), dedupes by user keeping the company-specific role, left-joins profiles. `REVOKE EXECUTE FROM PUBLIC, anon; GRANT TO authenticated`. This is what powers every signer/assignee/owner picker — org-wide admins have no per-company access row, so a naive per-company lookup returns nothing for them.
- `document_numbers(_company_id uuid, _kind text) returns text[]` — every number already used company-wide, even for users who can only see their own documents, so numbering series never collide or restart.
- `can_touch_quote(_quote_id uuid)` — true for company admins/managers/finance/PM, the creator, or an assignee.
- `decide_payment_request(_request_id uuid, _decision text, _note text)` — single-row approval mutation.

### Storage buckets (private, signed URLs)

`avatars`, `documents` (PO files, receipts, statements, handover proofs, attachments), `quote-pdfs` (`{company_id}/{quote_number}.pdf`), plus branding assets (logos, stamps, signatures).

---

## 4. Navigation and shell

### Module launcher (`/`)

Full-page launcher, max width 5xl. Wordmark + active workspace label + theme controls in the header. Greeting `Welcome back, {firstName}.` and the line "Choose which Axel you want to work in. You can switch at any time from the sidebar." If a last-used module exists in localStorage, a pill button `Continue in {module}` with a right-arrow. Below, a responsive grid (1 / 2 / 3 columns) of module cards: rounded-2xl bordered card, 44px `primary-container` icon tile, chevron that nudges right on hover, module name, description, and `N pages`. The resumed module carries a `ring-1 ring-primary/40`. Modules and items are filtered by role; a module with zero visible items disappears.

### The six modules

| Module | Description | Landing | Sections → pages |
|---|---|---|---|
| **Axel Sales** | CRM: leads, pipeline, deals and contacts. | `/pipeline` | Sales → Pipeline, Quotations, Clients, Sales team |
| **Axel Books** | Finance: invoices, expenses, reporting and cash flow. | `/dashboard` | Overview → Dashboard, My tasks (+ Axel AI when enabled); Billing → Purchase orders, Invoices, Recurring billing, Cash flow; Treasury → Accounts, Transactions, Expenses, Payment approvals, Suppliers; Accounting → Plan comptable, Journal, Grand-livre, Balance, Bilan, Compte de resultat; Analysis → Budgets, Reports |
| **Axel Forge** | Collaboration: projects, files and tasks. | `/projects` | Axel Forge → Projects, Files, Tasks, SOPs & Compliance |
| **Axel Customer Support** | Tickets and service requests from your clients. | `/tickets` | Customer Support → Tickets, Service requests |
| **Axel People** | HR & payroll: records, attendance and compensation. | `/team` | People → Team, Time & Attendance, Leave, Kiosk, Payroll |
| **Integrations Hub** | Connect Axel to the tools your team already uses. | `/integrations` | Integrations → Integrations Hub |

Pinned to the bottom of every sidebar: **Administration** → Companies, Users & Access (group admin only), Settings, About. Plus `/login` and the feature-flagged `/axel` assistant.

### Sidebar

Three levels: **Module group → Section (collapsible; hidden when a module has one section) → Item.** Widths: expanded `15rem`, icon rail `4.5rem`, mobile drawer `min(19rem, 86vw)` sliding in from the left over 250ms with a rounded right edge.

Rail mode renders 44px circular module buttons with a floating labelled flyout on hover/click. Toggle button uses `PanelLeftClose`/`PanelLeftOpen`.

localStorage keys: `axel.activeModule`, `axel.navModuleOpen.v1`, `axel.navSectionOpen.v1`, `axel.navMode.v2` (`expanded|rail`), `axel.theme`, `axel.textSize`, `axel.density`.

**Company switcher** — pill button on `--surface-container` (hover `--surface-container-high`), 28px gradient avatar (`from-primary to-chart-2`), dropdown as a `rounded-2xl` glass panel with 150ms fade/zoom/slide-in, listing Group (group admins only) then each company with coloured initials and a check on the active one.

**Top bar**, left to right: hamburger (mobile), history back/forward (`Undo2`/`Redo2`), breadcrumb trail, search input (`h-10 rounded-lg`, icon-left), write-trail button, **Create** button (`Plus` icon rotating 90° on hover, always creating the entity of the current page), notification bell, account avatar (`from-chart-2 to-chart-4`) with a dropdown menu. All icon buttons: `h-9 w-9 rounded-full`, focus ring, hover `--surface-container`, `active:scale-95`, 200ms.

A module header shows the current module icon in a `primary-container` circle plus a "Switch module" link back to `/`.

---

## 5. Screens

### Dashboard
KPI cards (cash position, receivables outstanding, revenue MTD/YTD, overdue count, pipeline weighted value), revenue-vs-expense chart, invoice aging chart, recent activity, SOP compliance summary. Everything reactive to the workspace scope.

### My tasks
"What is waiting on me". Four KPIs: Approvals waiting on you (count), Value to decide (compact MGA), Urgent to-dos (danger tone when > 0), Other to-dos. Section 1 "Approvals waiting on you" — rows with title, amount chip, status chip, run-day chip, danger "Off-cycle" chip, payee/project/client chips and a **Review** button to `/payment-approvals`; visibility by role (draft → requester only; submitted → finance/admin; reviewed → group admin; approved → finance/admin). Section 2 "Business to-dos" — generated next-actions across quotes, invoices, POs and accounts, each with a tone-coloured left border (urgent / attention / routine), an amount-at-stake chip and a deep-link CTA. Read-only.

### Tasks
Toolbar: search, filter pills **Open / Mine / Overdue / Done / All** (default Open), record count, **New task**. Five KPIs: Open, Due this week, Overdue (danger), Assigned to me, Done this month. Columns: Task (strikethrough when done), Status (inline select), Priority (coloured pill), Due (red when overdue), Project, Client, row actions Edit/Delete. Detail panel sections: Task, Linked to, Notes; actions Edit and Complete. Dialog "New task"/"Edit task": Task title, Company, Status, Priority, Due date, Assignees, Project, Client, Quotation, Invoice, Notes.

### Pipeline
Kanban of opportunities: lead → qualified → proposal → negotiation → won/lost. HTML5 drag-and-drop between columns, Alt+Arrow keyboard moves on a focused card, `aria-live` announcements for accepted and rejected moves, column headers with coloured dot, count and a meta line of totals, dashed "Drop here" placeholder in empty columns, left accent bar per card, overflow "…" action menu.

### Quotations
Dense table with per-line editor (drag reordering), object title, second "details" column, per-line and global discounts, optional unit column, up to 3 assignees, follow-up panel with dated notes and next-action reminders, duplicate, convert to invoice, PDF preview and export, expiry card, status-request flow, sales role chips (owner/actor cells show **first name only**; full names appear in tooltips, detail panels, dialogs, pickers, exports, PDFs, emails and notifications).

### Invoices
Everything Quotations has, plus: PO linkage or explicit waiver with a reason (rows with neither show a "PO missing" flag), payment recording with partial payments, mark-paid dialog, payment matching against bank transactions and unlink, handover proof upload, ingestion date, aging bucket chart with a click-through drawer, saved filter presets, status + PO-state filter bar, bulk actions (mark paid, mark sent, cancel, bulk reassign client/project), resizable persisted columns, and a **Signer** select in the Document section.

### Purchase orders
Capture the client's PO number, client reference, buying entity, amount, date, uploaded file and document history; link to quotes, projects and invoices.

### Recurring billing
Three KPIs: Active schedules, MRR equivalent, Due in 7 days (warning). Toolbar with **New schedule**. Columns: Name (+ project subtext), Client, Company code, Cadence badge, Amount, Next run (+ "Nd overdue" / "in Nd"), Last generated (+ invoice count), Status (Active/Paused), row actions Generate now (⚡, active only), Pause/Resume, Edit, Delete. "Generate now" creates a draft invoice through the numbering service and advances `next_run_date` by the cadence. Dialog fields: Name, Company, Client, Project, Amount, Currency, Frequency (monthly/quarterly/yearly), Start, End, Payment terms days, Active switch, Notes.

### Cash flow
Finance/admin only, otherwise a restricted message. Above the toolbar: a monthly bar chart of Invoiced / Collected / Paid out. Below it: a monthly totals table (Month, Invoiced, Collected, Outstanding, Paid out, Net, Running). KPIs: Invoiced, Collected (success), Outstanding, Paid out, Net cash (collected − paid out, with committed-not-paid as the sub-caption), Overdue (danger). State pills: All / Open / Partly paid / Overdue / Paid. Main table: expand chevron, Invoice #, Client, Issued, Due, Amount, Paid, Paid on, Balance, Status; the expanded row lists linked bank transactions or a "recorded manually" note. Read-only.

### Clients
Full legal identity form (name, address, billing email *optional*, NIF, STAT, RCS, payment terms overall and per currency), categories, acquisition data, bank details, colour and avatar. Sales users see the record with every financial column hidden.

### Projects
Project list with client, revenue, cost and margin, stage workflow driven by `project_stages` and reusable stage templates, project time panel (monthly hours, billable hours and indicative labour cost at salary ÷ 173.33 per hour), and linked documents.

### Suppliers / Expenses / Accounts / Transactions
Suppliers mirror the client identity + bank block. Expenses cover supplier bills, reimbursements and medical claims with reimbursable percentage, payment cycle, funding invoice and attachments. Accounts show a live balance derived from opening balance + transactions. Transactions is a virtualized table with inline debounced editing, CSV/statement import, and a four-step reconciliation wizard (upload statement → auto-match → resolve exceptions → lock period) that writes a `bank_reconciliations` row and exports results.

### Payment approvals
Weekly Thursday payment run: draft → submitted → reviewed → approved → paid, with reject and off-cycle paths. KPIs: Awaiting review, Awaiting approval (warning), Approved to pay (success, this run), Off-cycle count (danger when > 0). Toolbar: search, pills Open / My requests / All, record count, **Request payment**. Rows grouped by run date, each group headed by the cut-off text. Columns: Payment (title + off-cycle warning icon), Payee, Type (bill/reimbursement/advance/other), Amount, Needed by, Status pill. Detail panel: Amount, Status, Run day, Needed by, Project, Details, Off-cycle reason, Rejection reason. Buttons by status and role: **Submit for review** (draft, owner), **Finance review done** (submitted, finance/admin), **Approve payment** (reviewed/submitted, group admin), **Mark paid** (approved, finance/admin), **Reject** (any open non-draft, finance/admin, prompts for a reason). Dialog "Request a payment": What is being paid, Type, Supplier or free-text Pay to, Amount + Currency, Needed by, Details, "Cannot wait for Thursday" switch + reason; footer **Save draft** / **Submit for review**. Every transition writes a `payment_request_events` row and fires notifications. Wednesday and Thursday reminders.

### Accounting — Plan comptable, Journal, Grand-livre, Balance, Bilan, Compte de résultat
French PCG chart of accounts with company-specific custom sub-accounts that finance can add and remove; a merged account index feeds a type-to-search account picker used by the Journal. Double-entry journal, general ledger by account, trial balance (rows come from the merged account list filtered to accounts with movement, labels resolved through the same lookup so custom sub-accounts are named correctly), balance sheet and income statement. Each is period-filterable and exportable. Plan comptable is gated on finance visibility.

### Budgets
Annual budget per category and currency, versus actuals.

### Reports
French-language consolidated P&L in MGA equivalent: period picker + **Exporter CSV**, three KPI cards with trend badges (Revenus, Charges, Résultat net versus the prior period), a per-company bar chart (Revenus / Charges / Résultat in M MGA) and a detail table per company with margin % and a group total row.

### Files, Tickets, Service requests, Integrations Hub — placeholders, built and reachable
- **Files**: title "All files", count "0 files", **Upload file**; columns Name, Type, Owner, Project, Size, Updated; empty-state copy only.
- **Tickets**: title "All tickets", **New ticket**; columns Reference, Subject, Client, Status, Priority, Opened.
- **Service requests**: title "All service requests", **New request**; columns Reference, Request, Requester, Type, Status, Requested.
- **Integrations Hub**: card grid — Email, Calendar, Chat, Payments, Cloud storage, Accounting export — each with icon, a "Not connected" badge, description and a disabled **Connect** button.

### SOPs & Compliance
Header actions: **60-second walkthrough** (guided tour) and, for group admins, demo controls **Load demo data** / **Reload demo data** / **Remove demo** (each reloads the page). The tour auto-opens on first visit (localStorage `sops-tour-v1`) and has 5 steps over the KPIs, weekly summary, tabs, violations and demo controls. Four KPIs: Compliance rate %, Critical violations, Warnings, Records checked. Three pill tabs:

- **Compliance** — weekly summary card (week-over-week comparison, aging buckets, owners with open items), Severity and Rule filters, **Export CSV**, and a violation list: Rule, Reference (deep-links to the invoice/PO/expense with a `focus` search param), Client, Company code, Detail, Exposure amount, Severity badge. Empty state "All checks pass".
- **AR escalations** — overdue invoices (balance > 0.5, stage > 0) with columns Invoice, Client, Balance, Age in days (colour-graded) and a Ladder of D15/D30/D45/D60 buttons (green = done and clickable to review, red = due now, grey = not yet due), plus a **Draft** button from day 30 opening a follow-up draft dialog. Below, "Logged actions" listing every escalation with stage badge, invoice number, action, notes, date and author. The log dialog has Action taken (prefilled per stage) and Notes, with Remove / Cancel / Save.
- **SOP library** — left list of SOP documents (code, title, version, date), right panel rendering Purpose, Scope and sections.

### Payroll
Monthly runs built from team members and the salary register, per-company scoped, with CNAPS / IRSA / OSTIE rates, entries jsonb per run, and posting to transactions.

### Team
Employee records: name, first/last name, email, phone, job title, department, avatar, company or global, optional link to a login user.

### Time & Attendance
Header action **Open kiosk** → `/kiosk`. Pill tabs: **Today**, **Timesheets**, **Reports** (admin/manager), **Settings** (admin/manager).

- **Today** — clock card (large clock in/out button, elapsed timer, project and activity selects, Selfie / Location / Billable switches; on clock-in optionally captures a selfie via `getUserMedia` + canvas and a geolocation fix), a strip of today's punches, an actions hint, and a live attendance board (per member: avatar, schedule hours, holiday/leave/late notes, worked duration, state pill Clocked in / Late / Out / On leave / Off; header counts and total hours; sorted by state then name).
- **Timesheets** — week/month switcher with prev/next, employee picker for managers, stats (Regular, Overtime, Breaks, Paid leave, Unpaid leave), a per-day table (Day, Entries, Worked, Regular, Overtime, Notes), a status pill (not saved / draft / submitted / approved + lock icon), and actions Save draft, Submit, Approve, Reopen.
- **Reports** — filters From / To / Employee / Project; per-employee summary cards (regular and overtime hours); full entry table (Date, Employee, Clock in, Clock out, Hours, Project, Activity, Billable, Method, Status, GPS); **CSV** and **Excel** exports; audit trail below (timestamp, action, actor).
- **Settings** — work schedules (Applies to, Start, End, Break, Grace, weekday toggles) with add/delete; public holidays (year input, **Seed {year}**, add date + name, delete); kiosk PINs (employee select, PIN input, **Set PIN** / **Remove**).

### Leave
Request form: Type (paid / unpaid / sick / other), From, To, Half day switch, Note, a live "N working days" count excluding weekends and holidays, **Send request**. "Pending approvals" (managers) or "Pending requests" (self) with Approve / Reject icon buttons for managers and Delete for managers or the owner of a pending request. History sorted by start date descending. Upcoming holidays list (max 8). Status tones: pending = warning, approved = success, rejected = destructive, cancelled = muted.

### Kiosk
Full-screen, no app shell. Header shows the company label and a **Back** link to `/time`. Step 1: search box and a grid of member buttons (avatar + name). Step 2: avatar and name, PIN dot indicator, numeric keypad (0–9, Clear, backspace), **Change** button, and a large **Clock in / out** button. Punching verifies the PIN server-side; success toasts the direction and worked duration; errors clear the PIN. Footer: "Shared device · Madagascar time (UTC+3)."

### Companies
KPIs Cash / Income / Spend / Net / Entities (sales reps see personal "yours" figures instead, with cash and account columns hidden). Toolbar: **New company**, record count, column picker, data toolbar. Columns: Company (coloured initials badge + name), Code, Base currency, Cash, Income, Spend, Net, Accounts, Projects, Clients; row actions Details / Edit / Delete. Detail panel sections: Identity, Contact, Legal IDs, Financials. Large create/edit dialog: Name, Short name, Code, Colour swatches, Base currency, Legal name, Address, Email, Phone, Website, NIF, STAT, RCS, Tax ID, the full bank block plus a multi-account editor, international and mobile-money toggles with provider/number/name, show-payment-details switch, logo upload with crop plus height and max-width sliders, stamp upload with position, width, opacity and show-stamp, and document language (en/fr).

### Users & Access (group admins only)
Search box, user count, **Add user**, an effective-access diagnostics panel computed server-side, and a table (User / Platform / Effective access) where each row expands into a grid of per-company role selects. The platform role select is editable only by super admins and blocks self-demotion. Each company card shows a coloured badge, the company name and a select of No access / Company admin / Finance / Sales / Viewer, with legacy roles displayed read-only; it is disabled when the user already holds a platform role ("all access"). The **Add user** dialog collects Email, Full name, team-profile mode (match by email / link existing / do not link, with a search list), activation mode (Send invite / Set temp password) with a password field, platform role (super admins only) and the per-company role grid; it creates the user through a server function, links or creates the team member record, and toasts the outcome. Every role change writes a `user_admin_audit` row and re-syncs the sales-role mirror into the Sales Team module.

### Settings
Account (avatar upload with crop, signature upload with mark and white key-out, Name input, read-only Email / Roles / User ID, **Save profile**, **Sign out**), Appearance (theme controls), Notification settings, Data export card, and a Workspace shortcuts grid linking to Companies, Clients, Accounts and Plan comptable with counts.

### About
Static page: "What is AXEL?" hero, a "Modules & Capabilities" grid of feature cards, "Platform Highlights" (Multi-currency, RBAC, AI Assistant, Multi-company, Security, Cloud-native), "Technology Stack" (React 19, TypeScript, TanStack Start, Cloud Backend), "Getting Help" contacts, and a copyright footer.

### Notification centre
Bell popover. Header "Notifications · N new" with **Mark all as read** (with an Undo toast) and **Clear all**. Accent-insensitive search across title, body, doc number, actor and client name. Filter chips: All, Unread, and one per event group with counts. Feed grouped into "Today" and "Earlier"; each row shows an unread dot, event label + doc number, title, 2-line-clamped body, actor and timestamp; clicking parses the href into path + search, navigates and marks it read; a hover button toggles read/unread. Distinct empty states for no notifications, no filter match, and no search match (with a Clear search link).

### Login
Email/password and Google sign-in, honouring a `redirect` search param back to the requested route.

---

## 6. Business rules (non-negotiable)

1. **Numbering** — per company and document kind, format `PREFIX-YYYY-NNNN`. The next number comes from `document_numbers()` so the series is continuous across all users, including sales users who can only see their own documents.
2. **VAT** — Malagasy TVA 20% applies to the **Logia** entity (company code `LOG`) **only for documents issued on or after 2026-04-01**; earlier documents carry no VAT and other entities use their own configured rate. One pure function serves preview, totals and export.
3. **Amounts** — MGA is formatted with no decimals and a space thousands separator; documents print the total in words ("Arrêté à la somme de …") in the document's language.
4. **PO before invoice** — an invoice must reference a client PO or carry an explicit `po_waived` flag with a reason; waived invoices are visibly flagged everywhere.
5. **Receivables ladder (SOP-OPS-FIN-002)** — measured from `ingestion_date`, falling back to `issue_date`:
   - Day 15 — courtesy confirmation that the invoice is booked and scheduled.
   - Day 30 — written follow-up to the client finance contact, copying the project sponsor.
   - Day 45 — formal reminder with completion certificate and handover proof attached.
   - Day 60 — executive escalation; suspend new work pending settlement.
   Severity is `warning` below stage 45 and `critical` from 45. A nightly job scans open invoices, computes the highest crossed rung, emails finance and company admins of the owning company respecting each user's notification preferences, and writes one `ar_alert_log` row per invoice + stage so nobody is emailed twice. The endpoint lives under `/api/public/` and is protected by a **server-only shared secret header**, never a browser-visible key.
6. **Aging buckets** — current, 1–30, 31–60, 61–90, 90+; one shared computation feeds the receivables chart, the payables chart and the click-through drawer.
7. **Sales scoping** — enforced in RLS, not just in the UI.
8. **Ownership** — `created_by` is set by trigger and frozen; every document shows creator, last editor and timestamp with an activity timeline.
9. **Notification inserts** require `actor_id = auth.uid()`. Project stage inserts and updates require `has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager'])`.
10. **Signer, assignee and owner pickers** always read `company_directory()`, so group and super admins appear even without a per-company access row. When the directory is empty the signer field still renders — disabled, with a "No signature" option and a one-line hint.

---

## 7. Design system — reproduce exactly

### Fonts
Load in the root head with `preconnect` to `fonts.googleapis.com` and `fonts.gstatic.com`:
`https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&family=Inter:wght@400;500;600&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=swap`

- `--font-sans: "Inter", -apple-system, BlinkMacSystemFont, ui-sans-serif, system-ui, sans-serif` — body text.
- `--font-display: "Figtree", -apple-system, BlinkMacSystemFont, sans-serif` — all headings, `.font-display`, KPI metrics, nav labels.
- `--font-mono: ui-monospace, "Roboto Mono", monospace`.
- Icons: Lucide React components plus the Material Symbols Outlined variable font.
- `svg text` is forced to `--font-sans` (charts do not inherit reliably).
- Base: `html, body { font-family: var(--font-sans); font-size: 0.875rem; line-height: 1.45 }`. Headings get `--font-display`, `letter-spacing: -0.005em`, weight 500.
- Export/PDF fonts are prewarmed and embedded as base64.

### Light theme (`:root`)
```
--radius:0.625rem
--background:#F7F9FC  --foreground:#1F1F1F
--surface:#FFFFFF --surface-elevated:#FFFFFF
--surface-container:#F1F4F9 --surface-container-high:#EAF1FB
--card:#FFFFFF --card-foreground:#1F1F1F --popover:#FFFFFF --popover-foreground:#1F1F1F
--primary:#0B57D1 --primary-hover:#0A4CB8 --primary-foreground:#FFFFFF
--primary-glow:#A8C7FA --primary-container:#C2E7FF --on-primary-container:#001D35
--secondary:#F0F4F9 --secondary-foreground:#1F1F1F
--muted:#F0F4F9 --muted-foreground:#5F6368
--accent:#EAF1FB --accent-foreground:#0B57D1
--destructive:#B3261E --destructive-foreground:#FFFFFF
--success:#146C2E --success-foreground:#FFFFFF
--warning:#E37400 --warning-foreground:#FFFFFF
--border:#EEF1F5 --outline:#D8DCE1 --input:#E7EBF0 --ring:rgba(11,87,209,.4)
--chart-1..8:#0B57D1 #4285F4 #7C4DFF #146C2E #E37400 #00A0B0 #C5221F #80868B
--chart-income:var(--chart-4) --chart-expense:#C5221F --chart-forecast:var(--chart-2)
--chart-neutral:var(--chart-8) --chart-grid:#E3E7EC
--sidebar:#F8FAFD --sidebar-foreground:#444746 --sidebar-primary:#0B57D1
--sidebar-primary-foreground:#FFFFFF --sidebar-accent:#C2E7FF
--sidebar-accent-foreground:#001D35 --sidebar-border:transparent --sidebar-ring:rgba(11,87,209,.4)
--gradient-surface:linear-gradient(180deg,#FFFFFF 0%,#F8FAFD 100%)
--gradient-primary:linear-gradient(135deg,#0B57D1 0%,#4285F4 100%)
--gradient-dark:linear-gradient(135deg,#1F1F1F 0%,#001D35 100%)
--gradient-glow:radial-gradient(ellipse at top, rgba(11,87,209,.07), transparent 62%)
--gradient-mesh:linear-gradient(135deg,#0B57D1 0%,#4285F4 50%,#A8C7FA 100%)
--shadow-soft:0 1px 2px rgba(60,64,67,.1)
--shadow-elevated:0 1px 3px rgba(60,64,67,.14), 0 4px 12px rgba(60,64,67,.1)
--shadow-glow:0 1px 3px rgba(60,64,67,.2)
--shadow-card:0 1px 2px rgba(60,64,67,.1)
--material-thin:rgba(248,250,253,.88) --material-regular:rgba(255,255,255,.96)
```

### Dark theme (`.dark`)
```
--background:#131314 --foreground:#E3E3E3
--surface:#1E1F20 --surface-elevated:#282A2C
--surface-container:#1E1F20 --surface-container-high:#282A2C
--card:#1E1F20 --popover:#282A2C
--primary:#A8C7FA --primary-hover:#C2E7FF --primary-foreground:#062E6F
--primary-glow:#0B57D1 --primary-container:#0842A0 --on-primary-container:#D3E3FD
--secondary:#282A2C --accent:#282A2C --accent-foreground:#A8C7FA
--muted:#282A2C --muted-foreground:#C4C7C5
--border:rgba(255,255,255,.10) --outline:#444746 --input:rgba(255,255,255,.14)
--ring:rgba(168,199,250,.5)
--destructive:#F2B8B5 --success:#6DD58C --warning:#FDC69C --warning-foreground:#2A1800
--sidebar:#1B1B1B --sidebar-foreground:#C4C7C5 --sidebar-accent:#0842A0 --sidebar-accent-foreground:#D3E3FD
--chart-1..8:#A8C7FA #7CACF8 #D0BCFF #6DD58C #FDC69C #4CD1DA #F2B8B5 #9AA0A6
--chart-expense:#F2B8B5 --chart-grid:rgba(255,255,255,.12)
--material-thin:rgba(19,19,20,.82) --material-regular:rgba(30,31,32,.96)
--shadow-soft:0 1px 2px rgba(0,0,0,.5) --shadow-elevated:0 4px 14px rgba(0,0,0,.6)
--shadow-card:0 1px 2px rgba(0,0,0,.5) --shadow-glow:0 2px 8px rgba(0,0,0,.5)
--gradient-surface:linear-gradient(180deg,#1E1F20 0%,#131314 100%)
--gradient-primary:linear-gradient(135deg,#0B57D1 0%,#A8C7FA 100%)
--gradient-mesh:linear-gradient(135deg,#0842A0 0%,#0B57D1 50%,#7CACF8 100%)
--gradient-glow:radial-gradient(ellipse at top, rgba(168,199,250,.14), transparent 62%)
```

Radii map: `--radius-sm = radius − 4px`, `-md = radius − 2px`, `-lg = radius`, `-xl = radius + 4px`, `-2xl = radius + 8px`.

### Motion
`--ease-out-soft`, `--ease-spring`, `--ease-snap` all `cubic-bezier(0.2, 0, 0, 1)`; `--dur-fast: 120ms`, `--dur-base: 150ms`, `--dur-slow: 150ms`. Interactive elements transition `color, background-color, border-color, box-shadow, transform, opacity` at 150ms ease-in-out. `prefers-reduced-motion: reduce` disables every transition and animation app-wide.

### Type scale — the one scale used everywhere
```
--text-display: clamp(1.375rem, 2vw, 1.625rem)
--text-title:    1rem
--text-subtitle: 0.875rem
--text-body:     0.75rem      /* 0.8125rem in comfortable density */
--text-label:    0.6875rem
--text-micro:    0.625rem
--field-h:       2rem          /* 2.25rem in comfortable density */
```
| Utility | Font | Size | Line-height | Weight | Tracking |
|---|---|---|---|---|---|
| `t-display` | display | `--text-display` | 1.15 | 500 | −0.015em, tabular-nums |
| `t-title` | display | `--text-title` | 1.3 | 600 | −0.01em |
| `t-subtitle` | display | `--text-subtitle` | 1.35 | 600 | −0.005em |
| `t-body` | sans | `--text-body` | 1.45 | inherit | — |
| `t-label` | sans | `--text-label` | 1.35 | inherit | — |
| `t-micro` | sans | `--text-micro` | 1.3 | inherit | 0.01em |

Never write ad-hoc `text-[10px]`-style sizes in components. Additional display utilities exist for marketing/KPI use: `text-display-xl` (clamp 1.9–2.45rem/500), `text-display-lg` (clamp 1.35–1.6rem/500), `text-display-md` (1.0625rem/500), `text-display-sm` (0.9375rem/500), `text-overline` (0.6875rem/600/uppercase/0.08em), `text-metric` (clamp 1.75–2.35rem/500, tabular-nums — KPI values), `text-caption`. `.font-tnum` = tabular numerals; apply to every numeric cell, KPI, input and chart tick.

### Utility primitives
`hover-lift`, `hover-row`, `m3-search` (28px pill search), `m3-pill-active` (999px pill on `primary-container`), `press-scale` (`active: scale(.97)`), `icon-nudge`, `underline-grow`, `shimmer`, `rise-in` / `stagger-in` (translateY(6px)→0, opacity 0→1, `--dur-slow --ease-out-soft`), `focus-glow`, `material-bar` / `material-panel` (`blur(20/24px) saturate(180%)` glass), `hairline`, `mesh-panel`, `segmented` (pill tab group, 3px padding, 2px gap, foreground/5% background), `focus-ring` (2px solid primary outline, 2px offset), `skip-link`, `elevate`, `tap-target` (44px on coarse pointers), `canvas-wash`, `panel`, `panel-pad` (1.5rem → 2rem at md), `pill-field`, `quiet-row`, `pill-chip`, `form-compact`, `no-scrollbar`.

- `.panel` — `background: var(--surface); border-radius: 10px; border: 0; box-shadow: 0 1px 2px fg/5%, 0 8px 24px -18px fg/32%`. Compact density drops the radius to 8px.
- `.pill-field` — height 3rem (2.5rem compact), `border-radius: 999px`, flex row, gap .625rem, soft double shadow deepening on hover/focus.
- Scrollbars — 10px, thumb foreground/14% (hover primary/45%), radius 999px, 3px transparent border with content-box clip.
- Inputs — no native outline on focus; `border-color: var(--primary)` plus `0 0 0 3px primary/18%, inset 0 0 0 1px primary`.

### Density
Compact (default) and comfortable, stored in `localStorage["axel.density"]` and applied as `document.documentElement.dataset.density`:

| Token | compact | comfortable |
|---|---|---|
| `--tbl-row-h` | 1.75rem | 2.125rem |
| `--tbl-head-h` | 1.625rem | 2rem |
| `--tbl-pad-x` | 0.5rem | 0.625rem |
| `--text-body` | 0.75rem | 0.8125rem |
| `--field-h` | 2rem | 2.25rem |

### Table / sheet system (≥768px), applied to `.list-aligned table` and any `table.sheet`
- `border-collapse: separate; border-spacing: 0`.
- Continuous gridlines: `border-right`/`border-bottom` 1px of foreground mixed at 8%/7%; the last column drops its right border.
- Cell height `--tbl-row-h`, padding `.125rem var(--tbl-pad-x)`, font-size `--tbl-font` (= `--text-body`).
- Header row height `--tbl-head-h`; header text at `--text-label`, weight 600, letter-spacing .02em, `nowrap`, background `mix(muted 65%, card)`.
- Zebra: even rows foreground/2.5%, yielding to `:hover`, `[data-selected]`, `[aria-selected]`, `[data-stack-full]`.
- Hover on sheet rows: primary/5%. Selected rows: primary/9%.
- Right-aligned and `.tabular-nums` cells get `font-variant-numeric: tabular-nums`.
- `table.sheet thead th` sticky at top 0, z-index 4.
- `sheet-pin1` pins the first column: `position: sticky; left: 0; z-index: 3; background: var(--card)` with a `1px 0 0 fg/10%` divider shadow; its header cell goes to z-index 5 with the tinted header background.
- `tfoot` totals band: `mix(muted 55%, card)`, weight 600, first row `border-top: 2px solid fg/14%`.
- Cell focus: `outline: 2px solid var(--ring); outline-offset: -2px`.
- `.list-aligned` grid alignment: th/td padding `0 .75rem` (1rem on first and last), th vertical `.5rem` at `0.6875rem/1rem/0.04em`, td vertical `.3125rem` at `0.8125rem/1.25rem`; the last row reserves `.875rem` bottom padding for the floating action pill, collapsing to `.3125rem` on hover/focus-within.
- Sticky header container: scroll pane `overflow: auto; max-height: calc(100dvh - var(--list-sticky-top,0) - 9rem)`; `thead th` sticky top 0 z-6 on `var(--card)` with `inset 0 -1px 0 var(--border)`; group-header rows sticky at `top: 2rem` z-5.
- `.filter-sticky` — `position: sticky; top: 0; z-index: 20; backdrop-filter: saturate(180%) blur(8px)`.
- **Row actions** — the `<td>` stays in column flow but collapses to `position: static; width: 0; padding: 0; border-right: 0; overflow: visible`. The inner pill is `position: absolute; left: .5rem; bottom: .125rem; z-index: 5` (shifting to `left: 3rem` when a bulk-select checkbox cell exists; the checkbox cell sits at z-index 6), styled `border-radius: 9999px; border: 1px solid var(--border); background: var(--card)` with a two-layer shadow, starting at `opacity: 0; transform: translateY(2px) scale(.98); pointer-events: none` and revealed on `tr:hover`, `tr:focus-within` or `[data-busy=true]` over 150ms `cubic-bezier(.2,0,0,1)`. Coarse pointers always show it. On mobile the actions cell becomes a static footer with a top border.
- **Spreadsheet line editor** (`.sheet-grid`, used for quote/invoice lines) — separate skin: 1px per-cell borders, sticky header, zebra `mix(muted 35%)`, hover `mix(primary 7%)`, borderless in-cell inputs at `height: 1.75rem; font-size: .75rem`, `td:focus-within { outline: 2px solid primary; outline-offset: -2px }`, tfoot last row `border-top: 2px solid var(--border)`.
- **Mobile (<768px)** — each `<tr>` becomes a card (`border-radius: 12px`, margin `.625rem`, `--shadow-soft`), `<thead>` hidden, each `<td>` a 2-column grid (label 7.5rem / value 1fr) labelled from a `data-label` attribute rendered at 10px uppercase 0.12em muted. Never horizontal-scroll primary data. The sidebar becomes a sheet.
- Table helpers provide `table-fixed` layout, truncation by default, optional 2- or 3-line clamping, column resize handles, drag reordering and alignment classes. Group header rows use `bg-surface-elevated/40` with an uppercase `t-label tracking-[0.16em]` label.

### Page shell anatomy
- **PageHeader** — padding `px-5 sm:px-10 lg:px-12 pt-8 sm:pt-12 pb-5 sm:pb-8`; workspace label above the title in `t-label tracking-[0.06em] text-muted-foreground`; title `font-display text-[1.6rem] sm:text-[2rem] font-medium tracking-[-0.01em]`; optional description in `text-muted-foreground t-body max-w-2xl`; actions right-aligned, wrapping on mobile.
- **Page shell** — root padding `.5rem 1rem 2rem` (1.25rem inline at sm, 1.5rem at lg); content wrapped in a master/detail layout; a stack with `.75rem` gaps; a toolbar that is a grid (`1fr` → `auto 1fr` at sm) with top and bottom hairlines on `mix(background 90%, surface)` and `.5rem` vertical padding, optionally sticky, with its buttons and pills forced to `rounded-lg` at `2rem` height and `.375rem` gaps; a KPI grid of 2 columns rising to 5 at lg with `.5rem` gaps where KPI values shrink to `1.125rem/1.2`; tables inside a panel get `border-radius: 8px`, `1px solid var(--border)`, no shadow, header row on `--surface-container` and body rows at `2rem`.
- **Toolbar controls** — search, sort, group and filter, each a popover on a pill chip (`h-8 rounded-full bg-surface`, hover `surface-elevated`) or, icon-only, an `h-8 w-8 rounded-full` button; active state `bg-primary/10 text-foreground`; a circular `bg-primary text-primary-foreground` badge counts active filters. A record-count chip shows `count/total` with a filter icon in tabular numerals.
- **KPI card** — `panel p-6 sm:p-7 overflow-hidden hover-lift rise-in`; tone surfaces `bg-destructive/8`, `bg-amber-500/8`, `bg-success/8`, or `bg-surface-elevated` when highlighted; hover reveals a radial sheen; the label row carries a `t-label` and an optional trend pill (success / destructive / muted tint, rounded-full, `ArrowUpRight`/`ArrowDownRight`); the value is `font-display text-metric` with a 650ms cubic count-up (`1 − (1−t)³`); an optional caption sits below in `t-label text-muted-foreground`.
- **Status badges** — one `.status-chip` class, icon-only by default (`border-radius: 9999px; padding: .1875rem .3125rem; font-size: 10px; text-transform: uppercase; letter-spacing: .06em`), with the label hidden in an absolutely-positioned span that fades and slides in on hover or focus — opacity and transform only, never layout. A static variant keeps the label inline. Tones: `neutral`, `info` (primary/30 border, primary text, primary/10 fill), `warning`, `success`, `danger` (each /40 border and /10 fill), `muted` (line-through on muted/30).
- **Master/detail** — list at `flex-1 min-w-0`; on desktop a sticky aside `hidden lg:block w-[20rem] xl:w-[22rem] sticky top-3 max-h-[calc(100dvh-5rem)]` with `rise-in`; on mobile a bottom sheet `fixed inset-x-0 bottom-0 z-50 max-h-[80dvh]`. The detail panel is `panel p-4 space-y-3` with an eyebrow, a `t-title font-semibold` title, a subtitle and a close button; fields are a label/value grid with a `6.75rem` label column at `t-label`; sections group onto `surface-container/60` with `rounded-lg`.
- **States** — every list has a designed empty state, a "no results for these filters" state and an error state with retry; skeletons match the final row height so nothing shifts; row-level busy states show a spinner in place of the action.
- **Charts** — a shared chart frame with consistent margins, muted gridlines, the brand palette, rounded bar corners, tabular tick labels and accessible tooltips.

### Theme, text size, density controls
Three segmented radio groups: **Appearance** (Sun / Moon / Monitor for light / dark / system), **Text size** (Type icon plus three "A" samples mapping to root font sizes 100% / 108% / 118% and a `data-text-size` attribute), **Density** (`AlignJustify` / `Rows3` for compact / comfortable). The active option gets `bg-card text-foreground shadow-[var(--shadow-soft)]`; inactive is muted; all use `focus-ring press-scale`. Theme resolves `system` through `matchMedia`, toggles `.dark` on the root element and sets `color-scheme`.

### Accessibility
Landmarks, a skip link, visible focus rings everywhere, keyboard-reachable row actions, ARIA labels on every icon-only control, live regions for drag-and-drop moves, and contrast ≥ 4.5:1 including sidebar text.

---

## 8. Interaction and performance requirements

- **Risk-scoped optimistic UI** — low-risk edits (labels, notes, filters, ordering, presets) apply instantly and reconcile in the background. High-risk financial mutations (amounts, payments, status transitions, reconciliation locks) wait for server confirmation and show a pending state, never a premature "Saved".
- **Save-state indicators** — each editable row and field cycles idle → saving → saved → error. On error a popover shows the previous value, the attempted value and the server message with one-click restore.
- **Write journal** — a global persisted trail of write attempts (entity, field, before, after, result, timestamp) reachable from the top bar, so a failed financial write is always auditable and reversible.
- **Debounced writes** — inline text and number editing debounces ~500ms; high-risk mutations bypass the debounce and commit explicitly.
- **Cached switching** — changing company, currency, filter or sort renders instantly from cache with a quiet "Updating…" marker while the refetch reconciles.
- **Virtualized rows** on Transactions, Invoices, Quotations, Grand-livre and any table that can exceed a few hundred rows.
- **Undo / redo** of the last 5 actions with a toast and keyboard shortcuts.
- **Per-user persistence** — column widths, visible columns, filter presets, sidebar and section state, nav mode, active module, theme, text size, density.
- **Deep links** — clicking an aging bucket or a compliance warning navigates to the target list and scrolls to and highlights the exact row via a `focus` search param.
- **Guided tours** — spotlight overlay rendered in a portal with a cut-out highlight, positioned tooltip (title, body, "Step X of N", Skip / Back / Next / Done), auto-scroll into view, recalculation on resize and scroll, Esc to close, arrow keys to step, and a localStorage "seen" flag per tour key.

---

## 9. Documents and exports

- The PDF must be pixel-faithful to the on-screen preview. Render the document into an isolated iframe with the same stylesheet, wait for fonts and images to resolve with a timeout and safe fallback, then rasterize and paginate manually.
- Embed brand fonts as base64 and cache the fetched payloads across exports.
- Company logo with adjustable height, max width and crop; company stamp and per-signer signature images with white key-out and draggable placement stored as percentages so it survives any page size (`stamp_x`, `stamp_y`, `stamp_scale`).
- Document options: object title, second "details" column, optional unit column, per-line and global discounts, bank account selection, FR/EN language, fit-to-one-page mode, and column widths shared between the on-screen table and the export.
- A `stamp_dirty` flag plus a bulk re-render action refreshes stamps and signatures on existing documents after branding or signature changes.
- CSV/Excel export on every table honouring current filters, sort and visible columns.
- An automated typography regression check asserts the exported HTML resolves to the same font stack and numeric features as the preview.
- A quote-email path uploads the rendered PDF to `quote-pdfs` and sends it, then stamps `sent_at` / `sent_to` on the quote.

---

## 10. Build order (ship something working at each stage)

1. **Foundation** — design tokens, global stylesheet, type scale, density and theme systems, app shell, three-level sidebar, module launcher, auth (email + Google), profiles, companies, workspace switcher. *Accept when:* a user signs in, picks a module, switches companies and sees a styled empty dashboard.
2. **Access control** — `user_roles`, `user_company_access`, security-definer helpers, `company_directory`, RLS on everything so far, Users & Access with the role matrix, diagnostics and audit log. *Accept when:* a sales user is blocked from finance screens by the database, not just the menu, and a group admin still appears in every signer picker.
3. **CRM** — clients, projects, project stages and templates, suppliers, pipeline kanban, team members, sales-team sync. *Accept when:* CRUD works per company and sales users see clients with no financial columns.
4. **Documents** — quotations then invoices: line editor, numbering, VAT rule, discounts, signer, assignees, preview, PDF export, purchase orders, PO waiver, PVR records, activity timeline. *Accept when:* a quote converts to an invoice and both export identically to their preview.
5. **Treasury and accounting** — accounts, transactions, expenses, budgets, reconciliation, payment requests and runs, cash flow, PCG with custom sub-accounts, journal, ledger, balance, bilan, compte de résultat, reports. *Accept when:* balances reconcile to opening balance + transactions and the trial balance nets to zero with custom sub-accounts correctly named.
6. **Governance** — SOP library, compliance rule engine, weekly summary, AR ladder, aging charts and drawer, the nightly secret-protected alert job, notification centre, preferences and digests. *Accept when:* an invoice past day 30 shows red on the ladder and produces exactly one logged alert.
7. **People** — team, salary register, payroll runs, schedules, time entries and audit, timesheets, leave, holidays, kiosk PINs.
8. **Tasks, support and placeholders** — tasks, my tasks, and the Files / Tickets / Service requests / Integrations placeholder screens exactly as specified.
9. **Polish** — virtualization, optimistic UI and write journal, undo/redo, filter presets, resizable columns, empty and error states, mobile stacked cards, guided tours, accessibility pass.

Seed a small generic demo dataset with literal SQL inserts (two companies, a handful of clients, projects, quotes, invoices spread across aging buckets, transactions, team members and tasks) so every screen is populated on first load. Ship the AI assistant flag off.
