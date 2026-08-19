/**
 * Client-side document (invoice / quotation) PDF export.
 *
 * The printable HTML the preview builds is rendered in an isolated iframe by
 * the shared renderer, so the file always matches the preview and app CSS can
 * never corrupt the snapshot. See `@/lib/pdf-render`.
 */
import { renderHtmlToPdfBlob, saveBlob, printHtmlFallback } from "@/lib/pdf-render";

export type ExportStage = "preparing" | "rendering" | "saving" | "done";

export type ExportOptions = { /** Force the whole document onto a single A4 sheet. */ onePage?: boolean };

export async function renderDocumentPdfBlob(html: string, opts: ExportOptions = {}): Promise<Blob> {
  return renderHtmlToPdfBlob(html, {
    orientation: "portrait",
    scale: 2,
    ...(opts.onePage ? { maxPages: 1 } : {}),
  });
}

/** Renders and downloads the document as `<name>.pdf`. */
export async function exportDocumentPdf(
  html: string,
  filename: string,
  onStage?: (stage: ExportStage) => void,
  opts: ExportOptions = {},
): Promise<void> {
  onStage?.("preparing");
  onStage?.("rendering");
  try {
    const blob = await renderDocumentPdfBlob(html, opts);
    onStage?.("saving");
    saveBlob(blob, filename);
    onStage?.("done");
  } catch (err) {
    onStage?.("done");
    // Never leave the user without a way out: fall back to the print dialog.
    printHtmlFallback(html);
    throw err instanceof Error ? err : new Error("PDF export failed");
  }
}


/** Filesystem-safe PDF filename for a document number. */
export function pdfFilename(docNumber: string): string {
  const safe = docNumber.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
  return `${safe}.pdf`;
}
