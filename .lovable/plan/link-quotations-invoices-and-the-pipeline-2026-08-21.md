# Link quotations, invoices and the pipeline

Today opportunities live entirely on their own: the `Opportunity` record holds only a client, stage, value and expected close date, and neither quotations nor invoices carry any reference to an opportunity. Pipeline numbers are therefore forecasts that never meet the real quoted, invoiced and collected amounts.

This connects the three so a deal can be followed from lead to cash.

## What you get

**1. Every quotation and invoice belongs to a deal**
- New "Opportunity" selector on the quotation and invoice forms, and in bulk edit.
- When a quotation is created, it is linked automatically:
  - if the client/project already has an open opportunity, it is attached silently;
  - if there are several candidates, the best match is pre-selected as a suggestion;
  - if there is none, a new opportunity (stage "Proposal") is created from the quotation — client, value, currency and expected close taken from the quote — so nothing falls outside the pipeline.
- An invoice inherits the opportunity of its source quotation or purchase order; otherwise it uses the same suggestion logic.
- The link stays editable — you can re-point a document to another deal or detach it.

**2. Stage auto-advance with confirmation**
When a document event implies a stage move, a toast/dialog asks before changing it (with "Don't ask again for this deal"):
- quotation sent → Proposal
- quotation accepted → Negotiation (or Closed if an invoice already exists)
- first invoice issued → In progress
- all invoices paid → Closed
- quotation rejected / expired with no other open quote → Lost (suggested only)
Every accepted change is written to the activity trail, and refused suggestions are not repeated for the same event.

**3. Revenue tracking on the pipeline**
- **Per-opportunity roll-up**: each kanban card and list row shows Quoted / Invoiced / Collected / Remaining in MGA, plus a thin progress bar from forecast to cash.
- **Drill-down drawer**: click an opportunity to see its quotations and invoices with status chips, amounts and jump links to the record.
- **Forecast vs actual**: a chart comparing weighted pipeline against invoiced and collected revenue by month.
- **Conversion funnel**: opportunities → quoted → invoiced → collected, with conversion rates and drop-off.
- Header KPIs gain "Invoiced" and "Collected" next to the existing Pipeline/Weighted/Closed figures.
- Amounts respect the current company scope and are converted to MGA like the rest of the app.

**4. Reverse links**
The quotation, invoice and client detail panels show the deal they belong to, with a link back to the pipeline.

## Technical notes

- Migration: add nullable `opportunity_id uuid` to `public.quotes` and `public.invoices` (references `public.opportunities(id) on delete set null`), plus indexes. No other columns or tables touched; existing RLS and grants stay as they are.
- Types: `opportunityId?: string` on `Quote` and `Invoice`; mapping added to the invoice/quote row mappers in `src/lib/db-sync.ts`.
- New `src/lib/pipeline-link.ts`: `suggestOpportunity(doc, opportunities)`, `createOpportunityFromQuote(quote)`, and `rollupOpportunity(opp, quotes, invoices)` returning quoted / invoiced / collected / remaining. Invoiced and collected reuse `invoicePayable` / `invoiceBalance` from `src/lib/invoice-money.ts` and exclude cancelled invoices, so pipeline actuals match the invoices page exactly.
- New `src/lib/pipeline-automation.ts`: maps document events to suggested stages and exposes the confirmation flow; suppression choices persist per opportunity in local prefs.
- Pipeline UI: roll-up figures on the kanban card and list row, a new `OpportunityDrawer`, and two new tabs ("Revenue", "Funnel") alongside the existing kanban/list/acquisition/closer/forecast views, using the existing `ChartFrame` chart defaults.
- Backfill: a one-off data pass links historical quotations and invoices to opportunities where client (and project) match unambiguously; ambiguous ones are left unlinked rather than guessed.
