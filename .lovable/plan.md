# Bulk unlink matched payments

Today a payment can only be unlinked one at a time — hovering a single installment row in an invoice's proof chain, or the "Unlink payment" row action on a linked bank transaction. This adds a bulk path in both places, keeping every guarantee of the single unlink: explicit confirmation, an optional reason, the resulting verdict shown up front, an audit entry per payment, and one Undo that restores all of them.

## In the invoice proof chain

- Each installment row gets a checkbox, shown when the invoice has more than one matched payment.
- A "Select all" / "Clear" control appears above the payment rows once anything is selected.
- With a selection active, an "Unlink N payments" button replaces the per-row hover action.
- The confirmation dialog lists every payment being removed (date, description, amount), the total evidence being withdrawn, and the verdict the invoice falls back to once all of them are gone — e.g. "Verified → Part-paid, 4 200 000 MGA still outstanding".

## On the transactions page

- The existing bulk selection bar gains an "Unlink payments" action, enabled when at least one selected transaction is linked to an invoice.
- Selected transactions that are not linked are listed as skipped rather than silently ignored.
- The dialog groups the payments by invoice, so you can see which invoices lose evidence and what verdict each falls back to before confirming.

## Audit and undo

- One `payment_unlinked` audit entry per payment, carrying the transaction date, amount, currency, the shared reason, and `source: "manual"` — same shape as today, so existing verification history renders it unchanged.
- A single toast reports "Unlinked N payments from M invoices" with a 10-second Undo that restores every link in one step.
- Nothing else changes: the transactions, invoice figures, quotations and POs are untouched.

## Technical notes

- Generalise `src/components/payment-unlink-dialog.tsx` into a dialog that takes a list of `{ invoice, transaction }` pairs; the current single-payment call site passes a one-element list, so no behaviour changes there.
- Compute the fallback verdict per affected invoice with one `buildPaymentProof` pass that excludes all selected transaction ids at once (today it excludes a single id).
- Extract the unlink write + audit + undo into a `bulkUnlinkPayments` helper in `src/lib/payment-audit.ts` so the proof chain and transactions page share one path; writes run inside `withoutHistory` and the Undo restores the previous `invoiceId` of each transaction.
- `src/components/payment-proof-block.tsx`: local selection state over `proof.installments`, checkboxes and the bulk button; the per-row hover Unlink stays for single payments.
- `src/routes/_authenticated/transactions.tsx`: add the bulk action to the existing selection bar, reusing the same dialog.
- Extend `src/lib/payment-proof.test.ts` with verdict fallback when several installments are removed at once.
