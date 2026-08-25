# Smart links resolved by document number

Today the quotation / PO / invoice chips only light up when a stored link exists (`invoice.quoteId`, `invoice.poId`, `po.quoteId`). Documents created before the automation — including the imported Logia ledger — carry the reference only as text (in the object/subject, notes or the client PO reference), so their chips read "Not invoiced" even when a matching invoice exists. This adds number-based resolution plus a number search box for linking by hand.

## 1. Match by number when the ID link is missing

- A shared resolver first uses the stored ID link. If there is none, it looks for the other document's **number** in the text the document already carries: invoice object/subject and notes for a quotation number, PO client reference and subject for a PO number, quotation notes/object for an invoice number.
- Matching is company-scoped and tolerant of how people actually type numbers: case-insensitive, ignores spaces and surrounding punctuation, accepts the bare sequence (`534`) only when the rest of the series matches, and never matches across companies or cancelled documents.
- Only unambiguous matches are used. If a number resolves to more than one document, nothing is auto-linked and the chip says "2 possible matches" so a person decides.
- Chips distinguish the two link sources: a solid chip for a stored link, and the same chip with a dashed outline plus "matched by number" in the tooltip for an inferred one. Numbers displayed on chips stay the real document numbers, and clicking still deep-links to that record.
- Inferred links feed the same places as stored ones — quotation "Invoiced / Partially invoiced / Not invoiced" state, invoice source chips, the linked-documents block in both detail panels, and the "Accepted, not invoiced" filter — so counts agree everywhere.
- A one-click **Confirm link** action on an inferred chip writes the real ID link (`quote_id` / `po_id`) so the match becomes permanent, with an activity entry on both documents and a 10s undo.

## 2. Link by typing a number

- The invoice editor's PO and quotation pickers become searchable comboboxes: type any part of a number (or the client name / amount) and pick the match. They show number, date, client, status and amount, so the right document is obvious when numbers look alike.
- Same picker on the purchase-order editor for its source quotation.
- Pasting a full number selects it directly. An unknown number shows "No document with this number in <company>" instead of silently clearing.
- The existing rules are untouched: choosing a PO clears the "PO waived" flag, the quotation behind the PO is still adopted automatically, and totals / VAT / numbering are unaffected.

## 3. Backfill review

- A small "N documents can be linked by number" banner on Invoices and Quotations opens a review list of every unambiguous inferred match (quote → invoice, quote → PO, PO → invoice) with a per-row and a "Link all" action, so historical data can be corrected in one pass.

## Technical notes

- New `src/lib/doc-number-link.ts`: `normalizeDocNumber()`, `findByNumber(number, docs, companyId)` and `resolveDocLinks(doc, { quotes, pos, invoices })` returning `{ id, number, source: "stored" | "number" }` per relation. Pure functions, unit-tested against the real Logia number format (`DEV/LOG/08-26/534`).
- `src/lib/quote-accept.ts`: `invoicesForQuote` gains a third fallback tier after the opportunity fallback — number match — and `QuoteInvoiceLink` carries `source` plus an `ambiguous` count. `quoteInvoiceLink`, `acceptedNotInvoiced` and the conversion-gap consumers inherit it unchanged.
- `src/components/doc-link-chips.tsx`: add a `source` prop (dashed tone for inferred), an `onConfirm` callback for the confirm action, and an ambiguous variant.
- Pickers: reuse the existing Command/Popover combobox pattern in `invoices.tsx` and `purchase-orders.tsx`, replacing the plain `Select` for `poId` / `quoteId`.
- Confirm/Link-all writes go through the existing stores (`invoicesStore`, `purchaseOrdersStore`) inside `withoutHistory` + `logActivity`, and reuse `src/lib/history.ts` for undo. No schema change — `invoices.quote_id`, `invoices.po_id` and `purchase_orders.quote_id` already exist.

## Out of scope

No changes to numbering, VAT, PDF output, payment matching or RLS.
