# Fix blank PDF export on invoices

## What's happening

Both export paths (a single invoice/quotation PDF, and the table "Export → PDF" on the Invoices page) go through the same helper stack: build an HTML string, drop it into a hidden `<div>` on the app page, and let `html2pdf.js` / `html2canvas` rasterize it. Two known failure modes in that setup produce exactly a blank page:

1. The hidden container is parked at `position:fixed; left:-10000px`. html2canvas clones and re-lays-out the node; off-canvas fixed elements frequently snapshot as an empty white page.
2. The container lives inside the app document, so it inherits the app's Tailwind v4 stylesheet. html2canvas 1.x throws on modern color syntax (`oklch(...)`, `color-mix(...)`) found in computed styles, and html2pdf swallows the failure into an empty PDF.

Additionally, the single-document export assigns a **full HTML document string** (`<!doctype html><html><head>…`) into a `div.innerHTML`, where the parser discards the head wrapper — an unreliable way to carry the document's own `<style>` and font `<link>`.

## The fix

Render exports in an isolated iframe instead of a hidden div, so app CSS can never leak in and nothing is off-canvas.

1. **New shared renderer** (`src/lib/pdf-render.ts`)
   - Creates a same-origin iframe sized to the target page (A4 portrait or landscape), positioned on-screen at `opacity:0; pointer-events:none; z-index:-1` (not off-canvas).
   - Writes the complete HTML document into it with `doc.write()`, so `<head>`, `<style>` and the Google Fonts link are honoured verbatim.
   - Waits for images and `document.fonts.ready` **inside the iframe**.
   - Rasterizes the iframe body with html2canvas, then paginates the canvas into a multi-page jsPDF at the right page size — replacing html2pdf's opaque pipeline so errors surface instead of yielding a white page.
   - Blank-canvas guard: sample the canvas; if it is uniformly white, throw a real error so the UI reports the failure (and, as a fallback, offer the iframe's native print dialog).

2. **`src/lib/pdf-export.ts`** — `renderDocumentPdfBlob` delegates to the new renderer (A4 portrait). Stamp/signature percent coordinates stay unchanged because the iframe is exactly one A4 sheet wide.

3. **`src/lib/table-export.ts`** — `exportTablePdf` wraps its markup in a full HTML document and delegates to the same renderer (A4 landscape). Column widths, order, filters and full amounts stay as they are today.

4. **Error surfacing** — `TableExportMenu` and the document preview's export button show the actual error message on failure rather than a generic toast, so a future regression is visible immediately.

5. **Verification** — drive the running app in a headless browser, trigger both the invoice document export and the Invoices table export, save the produced PDFs, and inspect the rendered pages as images to confirm content, fonts, stamps and pagination are present.

## Technical notes

- `jspdf` and `html2canvas` are already installed transitively via `html2pdf.js`; they will be imported directly and lazily, so no new dependency and no change to the initial bundle.
- No changes to invoice data, numbering, permissions, or table preferences.
