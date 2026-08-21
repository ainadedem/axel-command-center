# Filters everywhere, smarter payment terms, and RBAC test coverage

Four changes, in the order they build on each other.

## 1. Same filtering experience on Quotations and Purchase orders

Today only Invoices has the full toolbar (count chip, saved views, status chips with counts and overflow, saved filter presets, clear-all, export/column/layout cluster). Quotations and Purchase orders only have the basic `DataToolbar`.

- Give both pages the same sticky toolbar row: "X/Y" count chip, `DataToolbar`, `FilterPresetBar`, `StatusFilterBar` with per-status counts and overflow, and a clear-all button.
- Quotation status chips: Draft, Sent, Accepted, Rejected, Expired (plus Cancelled if present). Purchase-order chips: the PO statuses already used on that page.
- Purchase orders also get a document chip pair (has file / missing file), which is the PO equivalent of the invoice PO chips.
- Filter presets are stored per user and per route, so quotations and POs get their own saved presets with sensible starters ("Sent, awaiting reply" for quotes, "Missing document" for POs).
- Chip state stays in the URL like Invoices, so a filtered view can be shared and deep links still land on the target row.

## 2. Suggested payment terms per client, overridable per currency

- On each client, show a "Suggested terms" hint next to the existing Payment terms (days) field: the median invoice-to-payment lag learned from that client's confirmed matches, with the sample size ("~32 days from 7 matched payments"). One click applies it.
- Add per-currency overrides: a small table under the field (currency + days) so a client billed in both MGA and EUR can pay on different terms. Blank falls back to the client-level value, then to the learned lag.
- Storage: a new `payment_terms_by_currency` JSON column on `clients` (no existing column touched), plus the mapping in the sync layer.
- The matching engine's expected-payment-date step reads currency-specific terms first, then client terms, then learned lag.

## 3. Re-run matching when terms or ambiguity rules change

- When a client's terms (or per-currency overrides) are saved, recompute proposals and verdicts for that client's pending/unmatched receipts and unpaid invoices.
- The result is shown as a review summary, not a silent write: "12 receipts re-scored — 3 new high-confidence matches, 2 downgraded to ambiguous". Confirmed/manually verified links are never overwritten; only proposals and confidence badges change.
- A "Re-run matching" action is also available on demand from the client record and from the payment matching screen, scoped to the current company.
- Each re-run writes one activity entry (who triggered it, scope, counts) so the change in verdicts is traceable.

## 4. Cross-company RBAC tests for unlink

- Extract the permission decision out of the `useUnlinkPermission` hook into a pure function so it can be tested directly, and keep the hook as a thin wrapper.
- New test cases: a user who is finance in company A and sales in company B may unlink in A and is denied in B; a viewer is denied everywhere; group/super admin is allowed across companies; a target with no company is denied.
- `bulkUnlinkPayments` tests: a mixed-company selection where one row is out of scope rejects the whole batch (no partial unlink), the thrown error names the blocked invoices, and nothing was written to the store.
- Server-side boundary: add tests asserting the unlink write path goes through the company-scoped write list (not the read list), so an out-of-scope company id can never reach the database, and confirm the corresponding row-level policy on transactions is company-scoped.

## Technical notes

- Migration: one additive column, `clients.payment_terms_by_currency jsonb` (nullable, default null). No other table or column is modified.
- Reused components: `StatusFilterBar`, `FilterPresetBar`, `DataToolbar`, `useDataView`, `useTablePrefs` — no new filter framework.
- Matching changes live in `src/lib/payment-proof.ts` (`expectedPaymentDate`, `learnClientLags`, `proposeMatches`), keeping the existing ambiguity guard and oldest-first tie-break.
- Tests extend `src/lib/payment-proof.test.ts` and add a `payment-permissions` test file; run with vitest.
