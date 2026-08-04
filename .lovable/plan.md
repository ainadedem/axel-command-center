# Accurate opening balances + bank statement reconciliation

Today an account has a single editable number (labelled "Opening balance" in the dialog, but it is actually the running balance). Importing a statement simply adds the sum of the rows to it, with no check against the bank's own closing balance and no protection against importing the same statement twice. That is why the balance can drift.

## What changes

### 1. A real opening balance
- Each account gets an **opening balance** and an **opening balance date** (the day you took the account into Axel).
- The balance shown everywhere becomes **computed**: opening balance + every transaction on that account dated on/after the opening date.
- The Accounts page shows: Opening balance, Computed balance, and (after a reconciliation) Bank closing balance + Difference.
- The Accounts dialog no longer lets you type a "current" balance — only the opening balance and its date, so the number is auditable.

### 2. Statement upload and reconciliation
- Upload **CSV or Excel (.xlsx)** statements. Same auto-detection of date / description / amount or debit / credit columns as today, plus Excel parsing.
- Before importing you enter (or the parser detects) the **statement period** and the **bank closing balance**.
- The dialog shows a reconciliation summary:
  - Opening (Axel) + statement movements = expected closing
  - vs the bank's stated closing balance
  - **Difference** — green when zero, red when not, so an inaccurate opening balance is visible immediately.
- **Duplicate detection**: rows already present in Axel (same account, date, amount, similar description) are flagged and skipped by default, so re-importing an overlapping statement can't double-count.
- Unmatched rows can be individually excluded before importing.
- Invoice auto-matching and FX gain/loss entries keep working as they do now.

### 3. Reconciliation history
- Each import is saved as a reconciliation record: period, closing balance, difference, row count, file name, who ran it.
- An account detail panel lists past reconciliations so you can see when the account was last proven correct.

### 4. Fixing an inaccurate opening balance
- If the difference is non-zero you can either adjust the opening balance, or post a one-click **balancing adjustment** transaction ("Écart de rapprochement") for the difference so the ledger and the bank agree from that date on.

## Technical notes

- Migration on `accounts`: add `opening_balance numeric not null default 0`, `opening_balance_date date`. Keep the existing `balance` column, backfilled as the opening balance, then stop writing to it from the importer.
- New table `bank_reconciliations` (company_id, account_id, period_start, period_end, statement_closing_balance, computed_closing_balance, difference, row_count, statement_name, created_by) with GRANTs, RLS scoped by company access, and `created_at`/`updated_at`.
- Computed balance derived client-side from `transactionsStore` per account; a shared `useAccountBalance` helper in `src/lib/` so Accounts, Dashboard and Expenses all read the same number.
- Excel parsing via `xlsx` (SheetJS) added to the existing CSV parser in `src/components/statement-import-dialog.tsx`; the dialog is split into a parse step and a reconcile/confirm step.
- Duplicate detection: match on account + date (±1 day) + exact amount + normalised description prefix.
- `src/lib/db-sync.ts` gains mapping for the new account columns and the reconciliation table.
