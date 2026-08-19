# Invoice taxes + "Send to Invoice" from a PO

Two changes: invoices get the same tax handling quotations already have, and the purchase-order detail card gets a button that starts an invoice from that PO.

## 1. Taxes on invoices

Today only quotations carry tax: they store a tax rate, tax amount and total, default the rate from the VAT rule (Logia only, from 1 April 2026), and show a Subtotal / Tax % / Total footer in the line-items table. Invoices have no tax fields at all — the invoice table only stores a single amount.

What will change:

- New fields on invoices (tax rate, tax amount, total) added by migration, leaving every existing column untouched. Existing invoices default to 0% tax, so nothing they show today changes.
- The invoice form gets the same Subtotal / Discount / Tax % / Total footer as the quotation form, with the tax rate pre-filled by the existing VAT rule based on the issuing company and the issue date (editable).
- The amount that drives receivables, aging, payments and the paid/overdue logic stays the payable total (tax included), so AR figures remain correct and no existing balance shifts when tax is 0%.
- Invoice PDF/preview already knows how to print a VAT line — it will now receive the stored tax values instead of showing none.
- When an invoice is created from a quotation or PO, the tax rate carries over with the lines.

## 2. "Send to Invoice" on the purchase-order card

The PO detail card currently offers Edit, Open file and History. A primary "Send to Invoice" action will be added next to them. It navigates to the Invoices page and immediately opens the new-invoice dialog pre-linked to that PO — client, project, company, currency, lines and amount inherited (the invoice dialog already inherits these once a PO is selected), with the PO recorded as the linked PO so the compliance strip shows PO ✓.

If the PO already has an invoice linked to it, the button instead jumps to that invoice and highlights it, so a PO cannot be double-invoiced by accident.

## Technical notes

- Migration: `ALTER TABLE public.invoices ADD COLUMN tax_rate numeric NOT NULL DEFAULT 0, tax_amount numeric NOT NULL DEFAULT 0, total_amount numeric` — no other table or column touched, no grant/RLS change needed.
- `src/lib/mock-data.ts`: add `taxRate` / `taxAmount` / `totalAmount` to the `Invoice` type.
- `src/lib/db-sync.ts`: map the three new columns in both directions for invoices (same shape as quotes).
- `src/routes/_authenticated/invoices.tsx`: add tax state to `InvoiceDialog`, default via `defaultTaxRate(company, issueDate)` from `src/lib/vat.ts`, compute with `docTotals(lines, discountPct, taxRate)`, add the tax row to the line-items `tfoot`, and persist the new fields in `submit`.
- Preview: pass `taxRate` / `taxAmount` / `totalAmount` where the invoice document object is built for `DocumentPreview`.
- `src/routes/_authenticated/purchase-orders.tsx`: add the action button to `DetailPanel`, navigating to `/invoices` with a new `fromPo` search param (or `focus` when an invoice already exists).
- `src/routes/_authenticated/invoices.tsx`: extend `validateSearch` to accept `fromPo`, and open the create dialog with that PO pre-selected on mount.
