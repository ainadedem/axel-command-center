# Reset invoice payments and bank links

Full clean slate for payment data across all three companies, so a fresh CSV can be uploaded afterwards. Invoices, quotations, clients, projects and expenses themselves are kept — only the payment side is wiped.

## What gets reset

- All 63 invoices with recorded payments (Logia 58, Axiom 5): amount paid back to 0, payment date cleared, payment status recalculated from the due date (Sent if not yet due, Overdue if past due). Cancelled and draft invoices keep their current status.
- Any invoice-to-bank-transaction links removed (currently already empty, so this is a safety sweep).
- All bank transactions that represent invoice collections deleted: income transactions imported from bank statements or entered manually as payments.
- Bank reconciliation records deleted, since they were computed from those transactions.
- Payment verification entries in the document activity log removed, so the audit trail does not point at deleted payments.

## What is deliberately not touched

- Invoices, quotations, purchase orders, clients, projects.
- Expense records and expense payments.
- Ledger-imported expense/transfer transactions (the accounting history that is not invoice collection).
- Account opening balances — current balances recompute automatically once the payment transactions are gone.

## Technical notes

Executed as data-change SQL (no schema change):

1. `UPDATE invoices SET paid = 0, paid_date = NULL, status = CASE WHEN due_date < current_date THEN 'overdue' ELSE 'sent' END` for every invoice whose status is not `draft` or `cancelled`; drafts keep `draft`.
2. `UPDATE transactions SET invoice_id = NULL` where linked.
3. `DELETE FROM transactions WHERE type = 'income' AND source IN ('statement','manual')` (19 rows today).
4. `DELETE FROM bank_reconciliations`.
5. `DELETE FROM document_activity WHERE action` matches the payment/verification actions.

After the reset the AR aging, cash flow, and invoice KPIs recompute from the remaining data on the next page load — no code changes are required.

If "delete all" was meant to include the invoices themselves (a full re-import from CSV), say so and the plan adds a delete of invoices and their line items instead of the status reset.
