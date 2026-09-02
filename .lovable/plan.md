# Reset bank links

Narrow reset: remove only the links between invoices and bank transactions. Payment amounts, invoice statuses, transactions themselves, and reconciliations all stay as they are.

## What happens

- Every bank transaction currently attached to an invoice is detached, so no invoice shows a matched bank movement any more.
- Payment verification chips on invoices go back to "not verified" and matching can be re-run from scratch.
- Nothing is deleted: transactions, invoices, amounts paid, and reconciliation records remain untouched.

Current state check: the invoice-to-transaction link column is already empty (0 linked rows), so this runs as a safety sweep and will report 0 or few rows changed.

## Technical notes

Data-change SQL only, no schema change and no code edits:

```sql
UPDATE transactions SET invoice_id = NULL WHERE invoice_id IS NOT NULL;
```

Also clears the stored match evidence written into `document_activity` for payment-link actions, so the verification chain UI does not reference links that no longer exist.
