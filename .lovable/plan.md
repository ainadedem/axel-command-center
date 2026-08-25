# Accept-to-invoice automation, denser document forms, smart links, user↔team linking

Four connected changes across quotations, invoices, purchase orders and the team page.

## 1. Accepting a quotation creates the PO and the invoice

Today "To PO" copies a quote into a purchase order and flips the quote to Accepted; nothing creates the invoice.

New behaviour: whenever a quotation becomes **Accepted** — from the row action, the status menu, the Kanban drag, the bulk status dialog or the preview — a confirmation step appears first:

- A dialog lists exactly what will be created: the next PO number, the next invoice number, client, currency, subtotal / VAT / payable total, and the number of lines copied.
- Checkboxes let you skip either document (e.g. a PO already exists, so only create the invoice).
- Invoice issue date = today; due date = today + the client's payment terms for that currency; both documents keep the quote's client, project, opportunity, lines (description, details, qty, rate, discounts), currency, discount, VAT rate and object/subject.
- Both are created as **drafts** (PO status `draft`, invoice status `draft`) and linked back: `po.quoteId`, `invoice.quoteId`, `invoice.poId`.
- Confirming shows one toast with links to the new PO and invoice, plus Undo (removes both documents and reverts the quote status).
- If a non-cancelled invoice already references the quote, that box is pre-unchecked and marked "already invoiced".
- Activity log entries are written for the quote, the PO and the invoice.

## 2. More readable quotation / invoice editors

The New/Edit dialogs for quotations and invoices are cramped: the line table is forced wider than the dialog, so Price / Discount / Amount get cut off, and the header and Cancel/Save scroll away.

- Wider dialog frame on desktop, full-height sheet on mobile.
- Fixed frame: sticky title, sticky footer actions, only the middle scrolls — Save is always reachable.
- Line table uses the available width (description flexes, numeric columns keep fixed compact widths) instead of a hard minimum width; nothing is clipped horizontally.
- A compact form scale for these dialogs: smaller labels, tighter inputs, consistent helper-text size, clear section blocks (Document, Links, Lines, Totals) so the whole form is visible with less scrolling.
- No change to totals, VAT, numbering, PO rules or PDF output.

## 3. Smart links between quotations and invoices

Make "was this approved quote actually invoiced?" answerable at a glance.

- **Quotations list / Kanban card**: a link chip showing the invoice state of the quote — `Invoiced` (with invoice number), `Partially invoiced` (invoiced amount vs quote total), or an amber `Not invoiced` for accepted quotes. Clicking opens the invoice focused on that record, or offers to create it.
- **Invoices list / card**: a chip back to the source quotation and to the PO, clicking deep-links to that document.
- **Detail panels** for both get a "Linked documents" block listing quote → PO → invoice → payment with number, date, status and amount.
- A saved filter on Quotations: "Accepted, not invoiced", and the same on Invoices: "No source quotation".
- The existing conversion-gap logic already computes accepted-but-not-invoiced amounts; the chips reuse it so the numbers agree everywhere.

## 4. Link existing app users to team members

- **Auto-link by email**: on the Team page, a team member whose email matches an app user's email is linked automatically, shown with the existing "App user" badge. Auto-linking never overwrites a manual link and never links one user to two members.
- **From the team member form**: a "App user" picker listing existing users of the accessible companies (name, email, role) with Link / Unlink, plus a warning when the emails differ.
- **From Users & access**: a "Link to team" action on each user row — links to a matching team member or creates one prefilled from the user's profile (name, email, avatar).
- Suggested matches are surfaced as a small "N users can be linked" banner on Team with a one-click "Review and link" list.

## Technical notes

- New `src/lib/quote-accept.ts`: pure builder returning the PO and invoice payloads from a quote (numbering primed via `primeNumbering`/`nextNumber`), plus `quoteInvoiceLink(quote, invoices)` returning `not-invoiced | partial | invoiced` for the chips. New `AcceptQuoteDialog` component owns the confirmation UI; `quotations.tsx` routes every accept path (row action, `StatusMenu`, Kanban `onMove`, `BulkStatusDialog`, `QuotePreview`) through it, replacing the current `convertToPO`.
- Undo uses the existing `src/lib/history.ts` pattern; activity entries via `logActivity`.
- Dialog layout: `DialogContent` gets `flex flex-col` with a `flex-1 overflow-y-auto` body in `invoices.tsx` and `quotations.tsx`; line table drops `min-w-[720px]` for `table-fixed` widths inside `stacked-table`. Compact form scale added as a scoped utility class in `src/styles.css`.
- Chips: new `src/components/doc-link-chips.tsx`, fed by `buildConversionGap`/`quoteInvoiceLink`; deep links reuse the existing `?focus=` row-focus mechanism.
- Team linking: uses `team_members.user_id` (already present) and `user_company_access` + `profiles` through the existing `useCompanySalesUsers`-style hook, generalised to all company users. Auto-link runs client-side on the Team page against loaded profiles and writes only when a member has no `user_id` and exactly one email match — no schema change and no new server function.
- Verification: Playwright pass at 1573px and a narrow width — accept a quote, confirm the PO and invoice appear linked, confirm no horizontal clipping in either editor, and no console errors.

## Out of scope

No schema changes, no changes to VAT rules, numbering, payment matching or the exported PDF layout.
