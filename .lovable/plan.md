# Plain descriptions, rich details

Line item **Description** becomes a simple single-line plain text input (no toolbar, no markdown). Only the **Details** field keeps the markdown toolbar and preview.

## Changes

- Quote builder and invoice builder: replace the description `RichTextField` with a plain `Input`; keep `RichTextField` for details only.
- Update the formatting hint text so it says markdown applies to the Details field only.
- Document/invoice preview: render description as escaped plain text (line breaks preserved), keep markdown rendering for details.

## Technical notes

- `src/routes/_authenticated/quotations.tsx` (~line 579) and `src/routes/_authenticated/invoices.tsx` (~line 745): swap description field.
- `src/components/document-preview.tsx` (~line 196): stop calling `renderRichText` on `l.description`; escape it instead.
- `RICH_TEXT_HINT` in `src/lib/rich-text.ts` reworded for the Details field.
- Existing stored descriptions containing markdown will now show as literal text; no data migration.
