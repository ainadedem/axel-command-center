# Hide the "Unité" column on invoices and quotations

Add a preview-level toggle to remove the unit/quantity-unit column from the printed document.

## Behaviour

- New checkbox "Show unit column" in the document preview toolbar, next to "Show client email" and "Show payment details".
- Checked by default.
- When unchecked, the "Unité" / "Unit" header and every line's unit cell disappear from the on-screen preview, the print view, and the exported PDF; the remaining columns take the freed width.
- Applies to invoices, quotations and purchase orders (same preview component). Not persisted — resets to checked each time the preview opens.

## Technical

- `src/components/document-preview.tsx` only:
  - Add `showUnit` state (default `true`) plus a `Checkbox` in the toolbar.
  - Thread `showUnit` through `buildHTML` / `buildPrintableDocument` args and the `DocumentHtmlArgs` type, alongside `showStatus`, `showPayment`, `showClientEmail`.
  - Conditionally omit the unit `<th>` (line ~374) and the unit `<td>` (line ~262); adjust the description column width so the table still fills the page.
- No database, schema, or company-settings changes.
