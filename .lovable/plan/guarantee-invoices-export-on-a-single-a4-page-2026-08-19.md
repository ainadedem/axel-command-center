# Guarantee invoices export on a single A4 page

## Current state

The preview already has an auto-fit: when density is "auto" and the on-screen sheet measures taller than one A4 page, the shared scale (font sizes + paddings) steps down by 0.05 until it fits, with a floor of 0.62. The exported PDF reuses that same scale, so preview and PDF agree.

Two gaps remain:

1. Nothing re-checks the fit at export time. The PDF is rasterized from the printable HTML in an isolated frame, whose layout can differ slightly from the on-screen sheet (fonts, images, rich-text line details). If it comes out a few millimetres taller, the renderer happily emits a second, nearly empty page.
2. When the preview auto-fit hits its 0.62 floor, or the user picked a manual density, the export still spills to 2+ pages with no warning and no way to force one page.

## What changes

1. **One-page mode on export.** A "Fit to 1 page" toggle in the preview toolbar (on by default for invoices and quotations, remembered per document type alongside the existing zoom/density memory).
2. **Export-time verification.** Before rasterizing, the printable HTML is measured in the same offscreen frame. If the content exceeds one A4 sheet, the density scale is stepped down (0.05 per step, floor 0.55) and re-measured until it fits.
3. **Final safety clamp.** If it still overflows after the floor, the renderer fits the captured canvas onto a single page (proportional down-scale) instead of emitting a page 2 — so a one-page export is always a one-page PDF.
4. **Honest feedback.** The toolbar keeps showing the live page count; when one-page mode had to shrink beyond the comfortable floor, the export toast says the document was compressed to fit. With the toggle off, the current multi-page behaviour is unchanged.
5. Print (browser dialog) uses the same resolved scale, so print output matches the PDF.

## Technical notes

- `src/components/document-preview.tsx`: add `fitOnePage: boolean` to the saved-view record and toolbar; `printableHtml(scaleOverride?)` so the export can rebuild the HTML at a corrected scale.
- New helper in `src/lib/pdf-render.ts` (or a small sibling module): `measureHtmlPageCount(html)` — writes the HTML into the existing hidden iframe, waits for fonts/images, returns content height in A4 pages. Reused by the export loop.
- `renderHtmlToPdfBlob` gains `maxPages?: number`; when set to 1, the single captured canvas is placed on one page scaled to fit rather than sliced by `computeCuts`.
- No data model, schema, totals, VAT, or document-wording changes — presentation and export only.
