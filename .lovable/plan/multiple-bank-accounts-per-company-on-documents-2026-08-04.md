# Multiple bank accounts per company on documents

Today each company has a single Payment Details & Bank Info block, and it is the only bank block that can print on an invoice, quote or purchase order. This adds a list of bank accounts per company and a picker on each document.

## What changes for you

1. **Company settings — Bank accounts list**
   - The single "Payment Details & Bank Info" section becomes a list. You can add several bank blocks (e.g. BNI MGA, BOA EUR, MVola).
   - Each entry keeps the same fields already in use: label, account holder, bank/domiciliation, code banque, code guichet, N° de compte, clé RIB, optional SWIFT/IBAN, optional mobile money.
   - One entry can be marked **Default** — it is preselected on new documents.
   - The existing company bank fields are carried over automatically as the first entry, so nothing is lost.

2. **Invoices, quotations and purchase orders**
   - Each create/edit dialog gets a **Bank account** selector listing that company's bank accounts (default preselected, "None" available).
   - The choice is saved on the document, so reopening or reprinting shows the same bank.

3. **Document preview / PDF**
   - The Payment Details block prints the bank account chosen on that document instead of the company-wide one.
   - The existing "Show payment details" checkbox keeps working; if no bank is selected the block falls back to the company default entry.

## Technical outline

- Migration:
  - New table `public.company_bank_accounts` (company_id, label, bank_name, bank_holder, bank_code, branch_code, account_number, rib_key, swift, iban, intl_enabled, mobile_enabled/provider/number/name, is_default, position, timestamps) with GRANTs, RLS mirroring the `companies` access policies, and an updated_at trigger.
  - Backfill one row per company from the current `companies.bank_*` columns, marked default. Existing `companies` columns stay untouched as a fallback.
  - Add nullable `bank_account_id uuid` referencing the new table on `invoices`, `quotes`, `purchase_orders`.
- `src/lib/mock-data.ts`: `CompanyBankAccount` type + `bankAccounts` on `Company`; `bankAccountId` on `Invoice`, `Quote`, `PurchaseOrder`; store + sync wiring in `src/lib/db-sync.ts`.
- `src/components/payment-details-fields.tsx`: reused for one entry; a small list wrapper (add/remove/set default) used in `src/routes/_authenticated/companies.tsx`.
- Document dialogs in `invoices.tsx`, `quotations.tsx`, `purchase-orders.tsx`: add the Bank account `Select`, defaulting to the company's default entry.
- `src/components/document-preview.tsx`: resolve the bank block from `doc.bankAccount ?? company default ?? legacy company fields` and render as today (RIB via `formatRib`, SWIFT/IBAN and mobile money when enabled).
