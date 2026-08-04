# Bank reconciliation: wizard, exports, history filters

Four upgrades to the Accounts page reconciliation feature.

## 1. Guided reconciliation wizard

Replace the single-screen import dialog with a 4-step wizard (same dialog, stepper header):

1. **Upload** — drop a CSV or Excel file. The parser auto-detects the statement period (min/max date of parsed rows) and shows it.
2. **Opening balance** — shows the account's stated opening balance and date. If the detected period starts before the opening date, or no opening balance is set, the step prompts to confirm or correct it inline.
3. **Review rows** — the existing table: duplicate rows flagged "already in ledger" and unchecked, any row toggleable, running import total.
4. **Confirm closing balance** — enter the bank's closing balance, see expected vs. statement, the difference, and the option to post a balancing "Écart de rapprochement" adjustment. Finish saves the transactions and the reconciliation record.

Back/Next navigation, each step blocked until valid. No change to parsing, duplicate detection, or balance math — only the flow around them.

## 2. Export a reconciliation summary (PDF + CSV)

An **Export** action available at the end of the wizard and on every row in the history dialog:

- **CSV** — one file with a header block (account, period, opening balance, imported rows, expected closing, statement closing, difference, adjustment posted) followed by the imported/reconciled line items.
- **PDF** — branded one-page summary using the same rendering approach as the quote PDF, with the vendor/company header, the reconciliation summary table, difference highlighted, and the adjustment line if one was posted.

To make history exports complete, the reconciliation record needs to also store the adjustment posted and the account's opening balance at the time — a small migration adds those columns.

## 3. Tooltip on the Accounts page

Wrap the reconcile (upload) and history icons in tooltips: "Reconcile bank statement — import a CSV/Excel statement and check it against the ledger" and "Reconciliation history". Add a short helper line under the Accounts page heading pointing at the icons so it is discoverable without hovering.

## 4. Filters and search on reconciliation history

The history dialog gets a toolbar:

- Free-text search on file name.
- Date range filter on the reconciliation date (and statement period).
- Status filter: Balanced (difference = 0), Difference, Adjusted.
- Result count, sorted newest-first, empty state when nothing matches.

## Technical notes

- Migration on `bank_reconciliations`: add `adjustment_amount numeric`, `adjustment_transaction_id uuid`, `opening_balance numeric` (all nullable); mapping added in `db-sync.ts`.
- Wizard state stays inside `src/components/statement-import-dialog.tsx`, split into step components in the same folder to keep the file manageable.
- Export helpers in a new `src/lib/reconciliation-export.ts`, reusing `exportCsvRows` and `html2pdf.js` (both already in the project).
- History filtering is client-side over the rows already fetched by `fetchReconciliations`.
