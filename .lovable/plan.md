# Fix roles & access, add French documents

## What's wrong today (verified)

- Roles are actually stored **per company** in `user_company_access` (tiavina and nancya = `sales`, accounting and next = `company_admin`), but the app's auth context only reads the global `user_roles` table — which contains a single row (`ainadedem@gmail.com` = super_admin).
- Result: every sales user loads with an **empty role list**, so `isSalesOnly` is false and the sidebar, route guard, and financial columns all behave as if they were admins.
- The database read policies are also permissive: `View invoices`, `View transactions`, `View expenses` only check "has access to this company", so a sales user can read finance data through the API even once the UI is hidden.
- Quotes have no owner restriction on read — sales can see everyone's quotes.
- Invoices/quotations are rendered in English only (the single French string is the "Arrêté à la somme de" line).

## Plan

### 1. Make roles resolve correctly
- Load roles from **both** sources: global `user_roles` plus the `user_company_access` role for the currently active company.
- Effective role = highest of the two. `super_admin` / `group_admin` stay global.
- Treat a user with **no role at all** as `viewer` (read-only, no finance) instead of full access — this is the main cause of "roles not working".
- Recompute when the active company changes, so a user who is sales in one company and admin in another gets the right scope per company.

### 2. Enforce the sales scope
- Sales-only users: navigation and routes limited to Quotations, Clients, Projects, Settings (already listed, will now actually trigger).
- Hide from sales everywhere: amounts on clients/projects, the Finance and Admin sections, Companies, Users & access, Team, Payroll, Reports, Accounts, Transactions, Expenses, Invoices, POs, Budgets, Billing, Journal.
- Quotations page for sales shows **only quotes they created** (`created_by`), and hides admin-only actions.

### 3. Tighten the database (migration)
- Restrict read access on `invoices`, `transactions`, `expenses`, `accounts`, `budgets`, `payroll_runs`, `salary_register`, `bank_reconciliations`, `recurring_billings` to company_admin / manager / finance roles (no sales, no viewer).
- Restrict `quotes` read for sales to rows where `created_by` is the user; admins/finance keep full company visibility.
- Keep clients and projects readable by sales (no financial columns are exposed there once the UI change lands).

### 4. French / English documents
- Add a `language` field (`en` | `fr`) to quotes and invoices, plus a default language on the company.
- Language selector in the quote and invoice builder, and a quick FR/EN switch in the preview toolbar.
- Translate the document template: title (Invoice/Facture, Quotation/Devis), Bill To/Facturé à, Date/Date, Due date/Échéance, Description/Désignation, Details/Détails, Qty/Qté, Unit/Unité, Rate/P.U., Amount/Montant, Subtotal/Sous-total, VAT/TVA, Total/Total TTC, Payment details/Coordonnées bancaires, Notes/Observations, plus number and date formatting (`fr-FR`, non-breaking space thousands separator).
- The "Arrêté à la somme de" line stays on French documents and is replaced by its English equivalent on English ones.

## Technical notes

- `src/lib/auth-context.tsx`: merge `user_roles` + `user_company_access`, expose `effectiveRole`, `isSalesOnly`, `canSeeFinance`.
- `src/components/app-shell.tsx`: gate sections by `canSeeFinance` / admin instead of only the sales route list.
- `src/routes/_authenticated.tsx`: keep the redirect guard, now driven by the corrected roles.
- `src/components/document-preview.tsx`: introduce a `t()` label map keyed by language; all hardcoded strings routed through it.
- Migration adds `language text not null default 'en'` to `quotes` and `invoices`, `default_document_language` to `companies`, and replaces the SELECT policies listed above.
