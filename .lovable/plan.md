# Document object/title + second description column

## What you get

1. **Object / title field** on invoices and quotations — a short subject line (e.g. "Campagne digitale Q3 2026") entered in the create/edit dialog and printed on the document, just under the document number, on both the preview and the PDF export.
2. **Second description column** on line items — each line gets an extra free-text field (a sub-description / detail line) next to the main description. It is editable in the quote builder, carried over to the purchase order and invoice when lines are inherited, and shown on the printed document under the main description.

## Where it appears

- Quotations page: new "Object" input in the quote dialog, new "Details" input per line row.
- Invoices page: new "Object" input in the invoice dialog; inherited line details are kept and shown read-only in the preview.
- Document preview / PDF (invoice, quote, purchase order): object printed in the header block; line details printed as a second text block inside the Description cell, replacing the current capability/level sub-line when details are filled (capability/level still shown when there are no details).

## Technical notes

- Migration: add `subject text` to `public.quotes`, `public.invoices`, `public.purchase_orders`; add `details text` to `public.invoice_lines`. Quote and PO lines are stored as JSONB, so no schema change there.
- Types: add `subject?: string` to `Invoice`, `Quote`, `PurchaseOrder` and `details?: string` to `QuoteLine` in `src/lib/mock-data.ts`.
- Sync: map the new fields in `src/lib/db-sync.ts` (both read and write paths, including the `invoice_lines` insert/select in `invoices.tsx`).
- Preview: extend `DocumentData` in `src/components/document-preview.tsx` with `subject`, render it in the header, and render `l.details` in the line row; escape as the rest of the template does.
- No changes to totals, tax, numbering, or PO/invoice workflow logic.
