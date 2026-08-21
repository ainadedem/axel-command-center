# Payment verification: audit trail, transaction-side links, installment proof

Three additions on top of the payment-proof chain shipped last turn. No database schema change is needed — the existing document activity log accepts new action types, and payment links already live on the transaction record.

## 1. Verification audit log

Every accept/reject in the matching flow is recorded, not just the write.

- New activity actions `payment_verified` and `payment_unlinked`, written through the existing document history so they appear in the invoice timeline with the confirming user and timestamp.
- Each entry stores what was matched: bank transaction id, date, amount and narrative, plus the fields that drove the decision (client, amount delta, day gap, invoice number hit), the confidence score, and any quotation/PO auto-linked at the same time. Manual accepts are marked `source: manual`, auto-accepted high-confidence rows `source: auto`.
- Rejecting a proposal is recorded too (`reviewed, no match accepted`), so an invoice that stays unverified shows it was looked at rather than ignored.
- New "Verification history" list inside the Payment proof block: who confirmed, when, and the matched fields, expandable per entry. Undo within the 10s window writes a reversal entry rather than deleting the original.

## 2. Bank transaction → document deep links

- Transactions list gains a "Linked to" column: the invoice number when the transaction is matched, with the same Verified / Partly matched / Unverified badge vocabulary used on invoices, plus the quotation number inherited through that invoice.
- Clicking the link focuses the invoice (and the quotation) on its page, mirroring the existing focus-row deep links.
- Row action "Link to invoice" opens the same matching dialog, seeded from the transaction side: it proposes the invoices this receipt could settle instead of the transactions an invoice could be settled by.
- A "Unlinked receipts" filter chip on the transactions page for income rows with no invoice attached.

## 3. Installment-aware payment proof

- The proof block lists every contributing bank transaction as an installment row: date, narrative, amount, running coverage and the remaining balance after it.
- Verdict logic keeps the current tolerance but distinguishes the two partial cases: money recorded as paid with no bank trail (shortfall) versus a genuine part-payment where the invoice balance is still open (installments, remaining balance shown).
- Remaining balance line offers "Find the next payment", scoped to the outstanding amount rather than the full invoice total, so the matcher scores candidates against what is still owed.
- Each installment carries its own evidence chain link (transaction, account, and the quotation/PO shared by the invoice).

## Technical notes

- `src/lib/payment-proof.ts`: add `installments` to `PaymentProof` (per-transaction coverage/remaining), split the partial verdict into `partial` vs `installment`, and add `proposeMatchesForTransaction` reusing `scoreCandidate` with the outstanding balance as target.
- `src/lib/payment-audit.ts` (new): typed writers/readers over `document_activity` for the verification actions and matched-field payloads.
- `src/components/payment-proof-block.tsx`: installment table, remaining-balance CTA, verification history section.
- `src/components/payment-match-dialog.tsx`: log accepts, rejects and undos; support transaction-seeded mode.
- `src/routes/_authenticated/transactions.tsx`: "Linked to" column with verdict badge, unlinked-receipts filter, "Link to invoice" row action.
- Extend `src/lib/payment-proof.test.ts` with installment coverage and transaction-side proposal cases.
