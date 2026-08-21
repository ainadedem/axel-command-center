# Unlink a payment from an invoice

Today a payment link can only be removed within the 10-second "Undo" window right after matching. After that, a wrongly matched bank transaction stays attached forever. This adds a permanent, auditable unlink action.

## What you get

- **Unlink button on each payment row** in the invoice's payment verification chain (one per installment, shown on hover).
- **Confirmation dialog** showing the invoice, the bank transaction and the effect ("this invoice will fall back to Unverified / Part-paid"), with an optional short reason.
- **Unlink from the Transactions page** too: a row action on any receipt currently linked to an invoice.
- **Audit entry** recorded in the invoice's verification history — who unlinked, when, which transaction, and the reason — reusing the existing `payment_unlinked` action so it appears in the timeline alongside verifications.
- **10-second Undo** toast that restores the link exactly as it was.

## Behaviour rules

- Unlinking clears the transaction's `invoiceId` only. It does not delete the transaction, does not change the invoice's amount/paid figures, and does not touch the linked quotation or PO.
- If unlinking removes the last matched receipt, the invoice's verification badge returns to Unverified (or Partly matched if other installments remain), automatically through the existing proof calculation.
- The invoice's paid status is left as recorded; the badge is the signal that the money is no longer evidenced. A note in the dialog states this so no one assumes the invoice was un-paid.

## Technical notes

- `src/lib/payment-audit.ts`: widen `logPaymentUnlinked` info to `{ transactionId, transactionDate?, transactionAmount?, reason, source: "manual" | "undo" }` so manual removals are distinguishable from undos in the history.
- New `src/components/payment-unlink-dialog.tsx`: confirm UI + write. Write path mirrors the matcher — `withoutHistory(() => transactionsStore.update(tx.id, { invoiceId: undefined }))`, then the audit log, then a `toast` with an Undo action that re-applies the previous `invoiceId`.
- `src/components/payment-proof-block.tsx`: add a trailing unlink control to each installment row.
- `src/routes/_authenticated/transactions.tsx`: add "Unlink payment" to the row actions, enabled when `linkOf(t)` resolves an invoice.
- `src/components/document-activity-panel.tsx` already renders `payment_unlinked`; only the summary text changes to include the reason.
- Add cases to `src/lib/payment-proof.test.ts` asserting the verdict falls back correctly when an installment is removed.
