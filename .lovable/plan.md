# Hide client email on invoice

Add a preview-level option to omit the client's email address from the document.

## Behaviour

- New checkbox "Show client email" in the document preview toolbar, next to "Show status" and "Show payment details".
- Checked by default.
- When unchecked, the email line disappears from the "Bill to" block in the on-screen preview, the printed page, and the exported PDF.
- Not persisted: it resets to checked each time the preview opens.

## Technical

- `src/components/document-preview.tsx` only:
  - Add `showClientEmail` state (default `true`) and a `Checkbox` in the toolbar.
  - Thread it into `buildHTML` / `buildPrintableDocument` args alongside `showStatus` and `showPayment`.
  - In the "Bill to" block, filter out `client.email` when the flag is false.
- No database, schema, or company-settings changes.
