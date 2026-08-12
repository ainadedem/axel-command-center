# Bigger, adjustable logo on invoices & quotations

Today the logo is force-fitted into a small box (max 52px tall / 180px wide) with no way to change it. This adds per-company logo sizing and cropping, used everywhere the document renders (preview, print, PDF export).

## What you'll get

1. **Logo settings on the company** (Companies page, next to the logo upload):
   - **Height slider** (24–140 px) and **max width slider** (80–360 px) with a live mini-preview of the document header.
   - **Crop editor**: click "Adjust logo", drag the image and zoom with a slider inside a frame to remove white margins or focus on the mark. Saved as a cropped image so the PDF stays crisp.
   - "Reset to original" restores the uploaded file and default size.

2. **Documents use the saved settings** — invoice and quotation preview, print window, and PDF export all render the logo at the chosen size/crop instead of the fixed 52px box.

3. **Per-document override** in the preview toolbar: a small logo-size control (Small / Medium / Large) so one document can differ without changing the company default. Defaults to the company setting.

## Technical notes

- Migration on `companies`: add `logo_height` (int, default 52), `logo_max_width` (int, default 180), `logo_crop` (jsonb, nullable — zoom + offsets kept for re-editing). No other table or column touched.
- Cropping is done client-side on a canvas, uploaded as a new file to the existing `documents`/logo storage path; the original URL is kept in `logo_crop.sourceUrl` so "reset" works.
- `src/components/document-preview.tsx`: `DocumentHtmlArgs` gains `logoHeight` / `logoMaxWidth`; the inline `<img>` style uses them. Same values flow into `buildPrintableDocument` and the PDF path.
- New `src/components/logo-crop-dialog.tsx` (drag + zoom on a canvas frame) and logo size controls added to the company dialog in `src/routes/_authenticated/companies.tsx`.
- Types in the company model and `src/lib/db-sync.ts` mapping extended for the three new fields.
