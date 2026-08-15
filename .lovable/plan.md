# Instant-feeling Axel, with an honest save trail

Builds on the write-status layer already in place (`data-store.ts`, `save-state.tsx`,
`virtual-rows.tsx`, `use-debounced-write.ts`), extending it across the command center.

## 1. Audit / rollback trail for failed financial writes

- Record every critical write attempt in a small in-memory write journal: record id, field(s),
  previous confirmed value, attempted value, server result (confirmed / rejected + message),
  timestamp, actor.
- Row-level: a failed row keeps the existing "Not saved" flag; clicking it opens a small popover
  showing "Previous: X → Attempted: Y — rejected by server: <reason>" with Retry and Discard.
- Page-level: a "Recent write issues" drawer listing the latest failures and confirmations, with
  jump-to-row deep links (reuses `use-focus-row`).
- The displayed value always stays the last server-confirmed one; a pending value is visibly
  pending and never rendered as saved.

## 2. Debounced inline edits everywhere (except money)

- Apply `useDebouncedWrite` (500ms) to inline text/number fields: names, descriptions, references,
  notes, subjects, addresses, contact fields, quantities of non-financial metadata.
- Excluded (immediate write + confirm/rollback): amounts, rates, discounts, paid values, payments,
  payroll figures, approvals/status transitions.
- Fields flush on blur, Enter, and unmount so nothing is lost on navigation.

## 3. Cached filter / sort / company & currency switching

- Filters, sorts, and company/currency switches render immediately from cached client state, then a
  background refetch reconciles quietly.
- Skeletons only on the very first load of a view; revisits show cached data at once.
- A discreet "Updating…" marker in the toolbar while the background refresh runs; no full-page
  spinner, no content replacement flash.
- Content cross-fades on company/currency switch instead of reflowing.

## 4. Stable money figures across the app

- Audit every monetary cell/KPI in routes and shared components; wrap in the shared amount helper so
  all use `font-tnum` and fixed-width numeric columns.
- Value changes flash briefly via opacity/colour only (`live-amount` tokens) — never size or layout.

## 5. Invoices page at scale

- Virtualize the invoices table body with the same `useRowWindow` used by Transactions, keeping
  sticky headers, resizable/reorderable columns, filters, aging panel and bulk selection intact.
- Hover-reveal bottom-left action pills, identical timing to the rest of the app.
- Per-row save-status indicator plus `LiveAmount` for amount/paid columns, wired to the invoices
  collection.

## Technical notes

- Touched: `src/lib/data-store.ts` (journal + status), a new `src/lib/write-journal.ts`, new
  `src/components/write-trail.tsx`, `src/components/save-state.tsx`, `src/components/list-table.tsx`,
  `src/lib/company-context.tsx` / `src/lib/db-sync.ts` (cached-first + background refresh), plus the
  list routes (invoices first, then quotations, expenses, ledgers) and `src/styles.css`.
- No database, schema or RLS changes; the journal is client-side and session-scoped.
- Verification: block the network, edit an invoice amount → value reverts, row flags "Not saved",
  trail shows previous vs attempted; scroll a few thousand invoices smoothly; switch company and
  confirm instant render with no reflow.
