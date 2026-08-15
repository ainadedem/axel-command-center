# Make Axel feel instant — without faking financial writes

## What's true today

- All data flows through a client-side store (`src/lib/data-store.ts`). Every mutation — including
  transactions, invoices and amounts — updates the UI immediately and fires the database write in the
  background; a failed write is only logged to the console (`console.warn`). So today the app is
  *fully* optimistic, including for money. That is the main integrity gap to close.
- Long lists render every row (e.g. Transactions maps all rows in grouped tables). No virtualization
  library is installed.
- `tabular-nums`, the `cubic-bezier(0.2, 0, 0, 1)` easing tokens and 150ms hover reveals already exist
  in `src/styles.css`, but a few transitions still animate layout properties (`padding`,
  `grid-template-columns`).

## The work

### 1. Risk-scoped writes (first)

Add a write-status layer to the store so each record can be `idle | saving | error`:

- **UI-state actions** (filters, sort, expand/collapse, company/currency switch, date range, column
  and panel state, reordering): stay fully instant — no change in behaviour, just no spinners.
- **Financial writes** (transactions, invoice/quotation amounts and lines, payments, approvals,
  payroll, expenses): the row updates but is marked *pending* until the database acknowledges.
  - Subtle inline pending affordance on the row (dimmed amount + small saving dot), row stays
    interactive, no full-screen spinner.
  - On acknowledgement: brief opacity/colour highlight on the value, no resize.
  - On failure: the value reverts to the last confirmed one, the row shows a clear "Not saved" flag
    with a retry action, plus a toast. Nothing stays on screen as if it were saved.
- Errors stop being swallowed: the store surfaces them to the row and to the caller.

### 2. Virtualized data tables

- Add row virtualization to the long list views (Transactions, Journal, Grand livre, Invoices,
  Quotations, Expenses) so only visible rows render, keeping scroll smooth at any row count.
- Keep the current column layout, resizing, sticky header, hover action pills and keyboard support.
- Grouped views keep their group headers as virtual items.

### 3. Cached-first reads

- Filters, sorts and company/currency switches read from the already-cached client state and
  re-render instantly; background refresh reconciles quietly.
- Skeletons only on the first load of a view; revisits show cached data immediately.

### 4. Stable numbers, disciplined motion

- Audit every amount cell for `tabular-nums` and fixed-width numeric columns so digits never jitter.
- Value changes animate opacity/colour only.
- Company/currency switch cross-fades content instead of reflowing.
- Replace the remaining layout-property transitions (`padding`, `grid-template-columns`) with
  transform/opacity equivalents; standardise on 180ms + `cubic-bezier(0.2, 0, 0, 1)` (hover reveals
  stay at 150ms as specified); apply `will-change: transform` only while animating.

### 5. Debounced inline text edits

Inline text/number fields update local state per keystroke and write to the database ~500ms after
typing stops. Financial amounts still follow the pending/confirm rule above.

## Technical notes

- New dependency: `@tanstack/react-virtual` for row virtualization.
- Touched: `src/lib/data-store.ts` (status + error propagation), `src/lib/db-sync.ts`,
  `src/components/list-table.tsx` (virtualized body, pending/error row states), `src/styles.css`
  (motion + numeric tokens), and the list routes above.
- No database, schema or RLS changes.
- Verification: post a transaction with the network blocked and confirm the amount reverts and is
  flagged; scroll a multi-thousand-row ledger and confirm smooth scrolling; switch company and
  confirm no layout reflow.
