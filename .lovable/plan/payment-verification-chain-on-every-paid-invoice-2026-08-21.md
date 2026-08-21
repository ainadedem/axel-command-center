# Payment verification chain on every paid invoice

Goal: for any invoice marked paid, see the full evidence trail in one place — the bank transaction that brought the money in, the quotation it came from, and the client PO that authorised it — so you can confirm it was really paid.

## What you get

**1. "Payment proof" block in the invoice detail panel**

For the selected invoice, a compact evidence chain:

```text
Quotation  DEV-LOG/06-26/012   2 100 000 MGA   accepted     -> open
PO         PO-2026-118         2 100 000 MGA   document.pdf -> open
Payment    2026-06-29  BNI MGA 2 100 000 MGA   income tx    -> open
                                               Verified
```

Each line is either a link to the source record (quotation, PO with its uploaded file, bank transaction on the account/transactions page) or an explicit gap: "No quotation linked", "PO waived — <reason>", "No bank transaction linked".

Verification verdict per invoice:
- **Verified** — paid amount is fully covered by linked bank transactions (within a 1 MGA rounding tolerance), FX gain/loss entries accounted for separately.
- **Partly matched** — linked transactions cover less than the paid amount (shows the shortfall).
- **Unverified** — status says paid but no bank transaction is linked.

**2. Badge + filter on the invoices list**

A small verification badge next to the existing status/PO badges (paid invoices only), plus a "Payment unverified" filter chip so you can work through the backlog.

**3. Auto-match with confirmation (for the imported history)**

Today only 2 of your 60 paid invoices have a bank transaction attached — the rest came in through the ledger import, where bank narratives like "VIREMENT RAIRTEL MADAGASCAR" never mention the invoice number. A "Match payments" action (invoice bulk toolbar, and a single-invoice "Find payment" button in the proof block) proposes links:

- Candidates: income transactions of the same company, not already linked to another invoice.
- Score: same client (or client name found in the narrative), amount equality in MGA, and date proximity to the payment/issue date; invoice number found in the narrative is an instant high score.
- Review dialog lists each proposal — invoice, candidate transaction, amount delta, day gap, confidence — with per-row Accept / Reject, plus "Accept all high confidence".
- Exact match on client + amount + date within 45 days is pre-ticked; everything else must be ticked manually. Nothing is written until you confirm.
- Accepting links the transaction to the invoice, stamps the payment date from the transaction, and writes an activity-log entry ("Payment matched"), so the History dialog shows who verified it and when. Undo available for 10s, same as Mark paid.

**4. Quotation and PO backfill**

Where an invoice has no quotation link but its PO does (or it shares a pipeline deal with exactly one quotation), the same review dialog proposes that link too — again confirm-before-write. Missing PO stays visible as "PO missing" rather than being invented.

**5. Forward path stays consistent**

The existing Mark paid dialog already writes a linked transaction, so newly paid invoices land as Verified with no extra work.

## Technical notes

- No schema change needed: `transactions.invoice_id`, `invoices.quote_id`, `invoices.po_id`, `purchase_orders.quote_id` already exist and are synced.
- New `src/lib/payment-proof.ts` (pure): `buildPaymentProof(invoice, transactions, quotes, pos)` returning the chain plus `verification: "verified" | "partial" | "unverified"`, and `proposeMatches(invoices, transactions, clients)` returning scored candidates. Unit tests with Vitest for the scoring and coverage maths.
- New `src/components/payment-proof-block.tsx` (detail-panel block), `src/components/payment-match-dialog.tsx` (review/confirm), and a `VerifiedBadge` added to `src/components/status-badge.tsx`.
- Writes go through the existing stores (`transactionsStore.update`, `invoicesStore.update`) inside `withoutHistory` + `logActivity`, reusing the commit/undo pattern in `src/lib/invoice-status.ts` so optimistic UI, audit trail and the write trail keep working.
- Invoice list changes are confined to `src/routes/_authenticated/invoices.tsx`: badge in the row/detail header, one new filter definition, one toolbar action.
