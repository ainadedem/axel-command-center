# Show linked quotations & invoices on every opportunity

Today the linked documents of a deal are only visible in the Pipeline "Revenue" tab, which opens a drawer listing quotations and invoices with deep links. The Kanban, List, and By-acquisition/By-closer views show nothing about linked documents, so from the main pipeline you cannot see or open a deal's quote or invoice.

## What changes

1. **Document indicators on every deal**
   - Kanban cards, List rows, and People-view rows get a small pair of chips: `2 quotes` / `1 invoice` (icon + count), plus an "outstanding" hint when money is still due.
   - Deals with no linked document show a muted "No documents" marker so gaps are obvious.

2. **One-click access to the documents**
   - Clicking a chip opens the existing deal drawer directly on the Quotations or Invoices section, where each document row already links to the quotation/invoice page focused on that record.
   - Each row in the drawer keeps its number, date, status badge and amount, and gains an explicit "Open" affordance.

3. **Drawer reachable from all views**
   - The revenue drawer (currently wired only to the Revenue tab) becomes available from Kanban, List and People views, so the drill-down is the same everywhere.
   - Card/row click still opens the edit dialog; the document chips stop propagation so they never trigger an edit by accident.

4. **Deal edit dialog**
   - The opportunity dialog gets a compact "Linked documents" section listing quotations and invoices with direct links, so the association is visible while editing.

## Technical notes

- Rollups already exist: `rollupOpportunity` in `src/lib/pipeline-link.ts` returns `quotes`, `invoices`, `invoiced`, `outstanding` per deal, and `Body()` in `src/routes/_authenticated/pipeline.tsx` already builds a `Map` of them. Pass that map into `KanbanView`, `ListView`, `PeopleView` and `OpportunityDialog`.
- Add a small shared `DocChips` component (new file `src/components/opportunity-doc-chips.tsx`) rendering the quote/invoice counts and calling an `onOpen(section)` callback.
- Extend `OpportunityRevenueDrawer` with an optional `initialSection: "quotes" | "invoices"` prop that scrolls that section into view on open.
- No schema, RLS, or data changes; `opportunity_id` already links quotes and invoices.
