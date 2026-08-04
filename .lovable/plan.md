# App audit: what works today, what doesn't

Based on a read of every page, the data layer (`db-sync.ts`, `mock-data.ts`, `pcg.ts`), the backend function and the storage/secret configuration.

## Works and is usable today

- Companies, Clients, Suppliers, Projects, Team, Sales team, Users & access.
- Accounts (computed balances, opening balance, reconciliation wizard, history + CSV/PDF export).
- Transactions, Expenses, Categories, Budgets.
- Invoices (numbering series, PO waiver, aging, preview + PDF export), Quotes (tax, FX snapshot, numbering), Purchase orders, Pipeline, Recurring billing (manual "generate now"), Payroll (validate → posts transactions), Dashboard, Reports.
- All of the above read and write to the backend database, scoped per company.

## Broken or not production-ready

### 1. Sending a quote by email fails every time
The "Send to Client" button calls the `send-quote-email` function, which requires a Resend API key. No email key is configured, so the function returns `missing_resend_key` (500) and the quote is never marked as sent. Nothing else in the app sends email either.

### 2. Uploaded files are stored inside the database as base64 text
Client PO documents, expense attachments and avatars are converted to data URLs and saved directly in table columns. There is no upload to file storage anywhere in the app. Consequences: a 2–3 MB PDF becomes a several-MB text value, page loads get slower with every upload, and large files can fail outright. A private `quote-pdfs` bucket exists but the app never writes to it.

### 3. The accounting module is not connected to the backend
Journal, Grand livre, Balance, Bilan and Compte de résultat all read `journal-entries`, which lives only in the browser's local storage. There is no journal table in the database. So entries are per-browser, per-device, lost on cache clear, and invisible to other users.

### 4. Accounting entries are not generated from business activity
Creating an invoice, expense, transaction or payroll run does not create any journal entry. The financial statements only reflect what is typed manually in Journal (plus a seeded demo set for one company), so Bilan and Compte de résultat do not match Invoices/Expenses. The statement pages are also limited to companies flagged as using the PCG plan.

### 5. Invoices cannot be sent to a client
Invoices only have preview and local PDF export. There is no send action, no delivery record, no `sent`/`viewed` state — unlike quotes.

### 6. Recurring billing never runs on its own
Schedules show "due" badges but an invoice is only created when someone clicks the lightning button. There is no scheduled job, so an unattended day produces no invoice.

### 7. Settings is a navigation page only
It shows account info and shortcuts. No workspace preferences, no currency/FX rate management, no numbering-format settings, no email/branding configuration.

### 8. Smaller gaps
- Payment status on invoices is manual; no payment recording flow links a bank transaction to an invoice automatically.
- Global search in the top bar: confirm it actually searches; it is presented as searching transactions, invoices and clients.
- Reports are transaction-based only (no P&L/Balance export, no period comparison).

## Suggested fix order

1. Storage for uploads (PO docs, expense attachments, avatars, quote PDFs) — biggest stability risk.
2. Email delivery (add the email key, then quote send + invoice send).
3. Move journal entries to the database, then auto-post invoices/expenses/payroll into the journal.
4. Scheduled run for recurring billing.
5. Settings: FX rates, numbering, branding, email defaults.

## Technical notes

- No `supabase.storage.from(...)` call exists in `src/`; `FileReader.readAsDataURL` is used in `purchase-orders.tsx`, `expenses.tsx` and `avatar-upload.tsx`.
- `journalEntriesStore` (`src/lib/pcg.ts`) is a local collection with no counterpart in `db-sync.ts` and no table in the database.
- `supabase/functions/send-quote-email/index.ts` hard-fails on a missing `RESEND_API_KEY`; the project secret list has no email provider key.
- Recurring generation lives in `generateNow()` in `billing.tsx`; there is no cron or public API route for it.

Tell me which of these you want tackled first and I'll turn it into an implementation plan.
