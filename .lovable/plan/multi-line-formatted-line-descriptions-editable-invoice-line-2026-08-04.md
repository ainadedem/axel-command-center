# Multi-line, formatted line descriptions + editable invoice lines

## What you get

1. **Multi-line descriptions** — the description and details fields on quote and invoice line items become resizable text areas instead of single-line inputs, so you can press Enter and write several lines.
2. **Light formatting** — line breaks, bullet lists (`- item`), numbered lists (`1. item`), **bold** (`**text**`) and *italic* (`*text*`) are rendered on the document preview and the exported PDF. Anything else is printed as plain text.
3. **Editable invoice lines** — the Invoices page gets a line-item table in the create/edit dialog (description, details, quantity, unit, unit price, line total, add/remove rows). It is prefilled from the linked purchase order or quote when one is selected, and afterwards stays editable and saved with the invoice.

## Behaviour notes

- A short hint under the description field explains the supported formatting.
- Editing an invoice line does not change the quote or PO it came from.
- Invoice amount: the dialog shows the computed line total; if lines are present the invoice amount follows them, otherwise the manually entered amount is kept as today.

## Technical notes

- New `src/lib/rich-text.tsx` (or `.ts`) with a small formatter: escape HTML first, then convert `**bold**`, `*italic*`, `- ` / `1. ` list blocks and newlines into safe HTML. No third-party markdown parser, no `dangerouslySetInnerHTML` of unescaped input.
- `src/components/document-preview.tsx`: use the formatter for `l.description` and `l.details` (and keep the capability/level fallback), with `<ul>/<ol>` styles added to the print stylesheet so lists print correctly in the A4 layout.
- `src/routes/_authenticated/quotations.tsx`: swap the two `Input`s at the line row for `Textarea` (auto-grow, small text), no logic change.
- `src/routes/_authenticated/invoices.tsx`: add a lines editor to the invoice dialog, seeded from `selectedPO?.lines ?? linkedQuote?.lines ?? editing?.lines`, stored on the invoice `lines` array.
- Persistence uses the existing `invoice_lines` table and `src/lib/db-sync.ts` mapping (`description`, `details`, `unit`, `quantity`, `rate`, `position`) — no migration needed.
