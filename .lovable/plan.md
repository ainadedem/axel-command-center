# Sales discounts on quotations and invoices

Add percentage discounts at two levels: per line item and one overall discount on the whole document. Applied before VAT, visible in the editor, the PDF/print preview, and the stored totals.

## How it works

- Each line row gets a small **Disc %** field. Line total becomes `qty × rate × (1 − disc/100)`.
- The document form gets a **Global discount (%)** field next to the tax rate.
- Money flow on the document:
  - Gross subtotal (sum of undiscounted lines)
  - Line discounts (shown when any line has one)
  - Subtotal after line discounts
  - Global discount (shown when set)
  - Net subtotal (HT) → VAT → Total
- Anyone who can edit the document can set a discount; no cap.
- Existing documents with no discount behave exactly as today (no extra rows printed).

## Where it appears

- Quotations page: line editor + global field in the create/edit dialog; amount column reflects the net total.
- Invoices page: same, in the invoice dialog.
- Document preview / PDF: new discount rows in the totals block, in English and French (`Remise`), and an optional per-line discount indicator in the description cell.

## Technical notes

Data model (one migration, additive, nullable — no changes to existing columns):
- `quotes.discount_pct numeric` (global), and `discount_pct` inside each object of the existing `quotes.lines` jsonb.
- `invoices.discount_pct numeric`; `invoice_lines.discount_pct numeric`.
- `purchase_orders` untouched for now (its lines are copied from quotes; discounted amounts carry over as values).

Code:
- `src/lib/mock-data.ts`: add `discountPct?` to `QuoteLine`, `Quote`, `Invoice`.
- New `src/lib/discounts.ts`: single source of truth — `lineNet(line)`, `docTotals(lines, discountPct, taxRate)` returning `{ gross, lineDiscount, afterLines, globalDiscount, subtotal, taxAmount, total }`.
- `src/lib/db-sync.ts`: map the new columns both ways (including the lines jsonb and `invoice_lines`).
- `src/routes/_authenticated/quotations.tsx` and `invoices.tsx`: discount inputs, use `docTotals` for the stored `amount` / `taxAmount` / `totalAmount`, so all downstream reports, AR ladders and reconciliation keep using the net figure already stored in `amount`.
- `src/components/document-preview.tsx` + `src/lib/doc-i18n.ts`: new labels (`discount`, `lineDiscount`) and totals rows in both the on-screen preview and `buildPrintableDocument`, so exported PDFs match.
- Discount changes flow through the existing document activity log and undo/redo like any other field edit.
