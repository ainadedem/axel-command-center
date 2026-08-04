# Update Logia Madagascar from the new Grand Livre export

The uploaded file is the final Logia Madagascar general ledger to 30 June 2026: 3,999 movement lines across Banque, Caisse, Factures fournisseurs, Factures clients, Report à nouveau and Opérations diverses. The app currently ships an older Logia ledger snapshot with 871 entries, and every Logia page (Accounts, Transactions, Clients, Suppliers, Invoices, Journal, Balance, Bilan, Compte de résultat) is derived from that snapshot. Replacing the snapshot updates all of them consistently.

## What will change

1. Convert the uploaded CSV into a new Logia ledger snapshot
   - Group lines into balanced double-entry documents by voucher (Journal + Numéro de pièce), keeping date, account code, third party (Tiers), operation label, debit and credit.
   - Parse the French/US number and date formats (`"2,000,000.00"`, `1/1/2026`) into clean numbers and ISO dates.
   - Map the source journal names to the app's journal codes (Banque → BNQ, Caisse → CSS, Factures fournisseurs → ACH, Factures clients → VTE, Opérations diverses → OD, Report à nouveau → AN).
   - Carry any account labels not yet known into the Logia account label list.

2. Re-derive Logia operational data from the new ledger
   - Bank/cash accounts (BNI 512100, Caisse 530000) with balances recomputed from the ledger.
   - Clients (411), suppliers (401/404), sales and purchase invoices, and one transaction per bank/cash movement.
   - Force the re-derivation once by bumping the internal derived-data version so existing browsers pick it up instead of keeping stale local data.

3. Keep the database in step
   - Remove the previous Logia-scoped transactions, invoices, accounts, categories, clients and suppliers rows that came from the old snapshot, then let the existing sync push the newly derived set so the backend matches what the pages show.
   - Accounting entries themselves stay where they are today (browser storage); moving the journal into the database is a separate piece of work.

## Verification

- Balance générale for Logia over the period is balanced (total débit = total crédit) and totals match the file.
- Transactions page for Logia shows the bank and cash movements from the file with correct running balances on Accounts.
- Row/entry counts reported after conversion match the source file (no dropped lines).

## Technical notes

- New snapshot written to `src/lib/logia-grand-livre-seed.json` (same `JournalEntry[]` shape), labels merged into `src/lib/logia-account-labels.json`.
- `seedLogiaGrandLivre` / `seedLogiaDerivedData` in `src/lib/pcg.ts` already handle a clean Logia-scoped replace; only `DERIVED_VERSION` needs bumping.
- Old Logia rows in the backend are deleted with a data operation scoped to `company_id = 'log'` before the re-derived data syncs, so nothing from other companies is touched.
