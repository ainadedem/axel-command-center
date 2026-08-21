# Payment unlink permissions, safer undo, and smarter client matching

Three changes to the payment verification chain.

## 1. Only finance and admins can unlink payments

- Allowed: super admin, group admin, company admin, and finance — evaluated in the company the payment belongs to, not globally.
- Everyone else (sales, viewer, project roles) no longer sees the unlink affordances: the row hover "Unlink" button on the proof chain, the checkbox column, the "Unlink N payments" button, and the Transactions page row action / bulk action are hidden.
- If a blocked user still reaches the action (deep link, stale UI, mixed-company selection), the dialog opens read-only with a clear message: "You do not have permission to unlink payments in {company}. Finance or an administrator must do this." — with the roles that can, and no confirm button.
- The unlink function itself refuses any target whose company the current user is not finance/admin in, so a mixed-company bulk selection unlinks nothing rather than partially applying, and the dialog explains which invoices were blocked.

## 2. Undo preview showing exactly what will be reverted

The current 10-second toast just says "Unlinked N payments". It becomes an explicit preview:

- Before confirming, the dialog already lists each invoice's verdict change; that same list is carried into the result so the toast shows a compact "3 payments · 2 invoices · INV-0142 Verified → Part-paid, INV-0150 Verified → Unverified".
- The toast gains a "Details" affordance opening a small panel listing, per invoice: invoice number and ID, the transactions removed (date, amount), verdict before → after, and what Undo will restore (the exact verdict each invoice returns to).
- The panel links to the audit entries created by the unlink: each row deep-links to that invoice's verification history, scrolled to the new entry.
- Undo restores every link in the batch at once and writes a reversal entry per invoice (source `undo`), then confirms with the restored verdicts.
- After the 10 seconds lapse, the batch stays reachable from each invoice's history — nothing silent.

## 3. Correct matching for clients that pay late with identical monthly amounts

Today the matcher scores mainly on amount, client and closeness to the issue/paid date. For a client like Airtel — same amount every month, paid ~30 days later — several invoices tie and the greedy pass can attach a receipt to the wrong month.

- Add a payment-terms field per client (days). When set, the expected payment date becomes invoice due/issue date + terms, and date scoring is measured against that instead of the issue date.
- When no term is set, learn the client's typical lag from its previously verified matches (median invoice→payment gap) and score around it. A receipt landing near the learned lag scores like "on time" rather than "far apart".
- Ambiguity guard: before proposing, detect competing invoices for the same client with the same amount (within tolerance) that are all unmatched. When two or more tie, the match is downgraded to "needs review" — never auto-high-confidence — and the candidate row is labelled "Same amount as N other invoices for this client".
- Tie-break by month sequence: among equal-amount siblings, the oldest unmatched invoice whose expected payment date is closest to the receipt wins, so a monthly stream matches in order instead of arbitrarily.
- Narrative wins over everything: if the receipt narrative carries the invoice number or a period reference (e.g. "JUIN 2026"), that invoice is chosen regardless of the sequence heuristic.
- The match dialog shows the reasoning explicitly: expected payment date, actual lag vs. the client's normal lag, and an ambiguity warning where relevant, so the reviewer confirms rather than trusts.

## Technical notes

- New `src/lib/payment-permissions.ts` — single `canUnlinkPayments(companyId)` helper built on `useEffectiveRole`/company access; used by `payment-proof-block.tsx`, `payment-unlink-dialog.tsx`, `transactions.tsx`, and enforced again inside `bulkUnlinkPayments` in `payment-audit.ts`.
- `bulkUnlinkPayments` returns the per-invoice before/after verdicts and the created activity entry ids so the toast and details panel can render them and link into `document-activity-panel`.
- `payment-proof.ts`: `scoreCandidate` gains an expected-date input and an `ambiguous` flag; `proposeMatches` computes per-client equal-amount clusters and applies the sequence tie-break. Pure functions, covered by new cases in `payment-proof.test.ts` (Airtel-style: 6 identical monthly invoices, 6 receipts 30 days late, all matched to the correct month).
- Migration: add `payment_terms_days` to `clients` only; a client edit field surfaces it. No other schema change.
