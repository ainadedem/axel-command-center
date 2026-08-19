# Invoice tax parity with quotations + real names on signatures

Two changes: invoices compute and store tax exactly the way quotations do, and the signature block prints a person's full name instead of their email address.

## 1. Invoice tax behaves like a quotation

Today a quotation stores its pre-tax subtotal as the document amount, with the tax amount and tax-inclusive total kept alongside, and it recomputes all three from the line items whenever the document is saved. An invoice instead stores the tax-inclusive figure in the amount field and back-derives the tax from it, and its amount only follows the line items when you press "Use lines total". That mismatch is why an invoice preview can print the same value for Subtotal and Total.

After this change, for invoices:

- The amount is the pre-tax subtotal (after line and global discounts), the tax amount is the VAT on it, and the total is subtotal + VAT — identical to quotations.
- Whenever the invoice has line items, all three values are computed from the lines on save; the manual amount box only applies to invoices with no line items (where it is read as the pre-tax figure and VAT is added on top).
- The VAT rate default follows the same rule as quotations: the company's VAT rule applied to the issue date, re-applied when you change company or issue date on a new invoice, and freely editable afterwards.
- Preview and PDF print Subtotal (HT), VAT, Total (TTC) and the balance due from the correct figures, in both languages.

### Receivables stay correct

Everything that tracks money owed — receivables, aging buckets, the AR escalation ladder, weekly compliance summaries, follow-up drafts, alert emails and the dashboards — will read the tax-inclusive payable total rather than the raw amount, so what a client owes does not change. Invoices with 0% VAT (all existing ones) are unaffected. Invoices already carrying VAT are converted by a one-off data fix so their stored subtotal, tax and total are consistent under the new rule, leaving the payable amount unchanged.

## 2. Full name on the signature

The signature block currently falls back to the email address when a user has no display name set. It will resolve, in order: the profile display name, the linked team-member's full name (first + last), and only as a last resort a name derived from the email local part (e.g. `jean.rakoto@…` → "Jean Rakoto"). A raw email address is never printed on a document. The same resolution applies to the signer picker in the preview toolbar, so the list and the printed name agree.

## Technical notes

- New helper `invoicePayable(inv) = inv.totalAmount ?? inv.amount` in `src/lib/mock-data.ts` (or a small `src/lib/invoice-money.ts`); replace `inv.amount - inv.paid` receivable math in `src/lib/sop.ts`, `src/lib/sop-summary.ts`, `src/lib/aging.ts` callers, `src/lib/ar-followup.ts`, `src/routes/api/public/hooks/ar-escalation-alerts.ts`, `src/components/weekly-summary-card.tsx`, and the invoices/clients/projects/dashboard reads that show balances or overdue totals.
- `src/routes/_authenticated/invoices.tsx` `InvoiceDialog.submit`: mirror the quotations submit — `const computed = docTotals(lines, discountNum, taxRateNum)`; when `lines.length`, store `amount: computed.subtotal`, `taxAmount: computed.taxAmount`, `totalAmount: computed.total`; otherwise `amount: manual`, `taxAmount = round(amount * rate/100)`, `totalAmount = amount + tax`. `deriveStatus` / paid comparisons use the payable total. Drop the "Use lines total" button (amount now derives automatically) and keep the manual amount input disabled/hidden while lines exist.
- `src/components/invoice-preview.tsx`: pass `amount: invoice.amount` (now HT) and the stored `taxAmount` / `totalAmount`; `document-preview.tsx` already treats `doc.amount` as HT, so no change there.
- Backfill migration: for invoices with `tax_rate > 0`, set `amount = round(amount / (1 + tax_rate/100))`, `tax_amount = old_amount - new_amount`, `total_amount = old_amount`. No schema change, no other table touched.
- `src/hooks/use-signer.ts`: extend the profile query with a `team_members` lookup by `user_id` (`first_name`, `last_name`, `name`) and add an email-humanising fallback; export the same resolver so `src/hooks/use-company-users.ts` and `src/hooks/use-owner-names.ts` stop falling back to raw email.
