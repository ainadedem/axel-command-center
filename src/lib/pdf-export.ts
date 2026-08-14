/**
 * Client-side PDF export.
 *
 * Renders the exact same printable HTML the preview shows into an off-screen
 * A4 container and produces a real downloadable file — no pop-up window and no
 * browser print dialog, so pop-up blockers can never break the export.
 */

export type ExportStage = "preparing" | "rendering" | "saving" | "done";

type Html2PdfWorker = {
  set: (o: unknown) => Html2PdfWorker;
  from: (el: HTMLElement) => Html2PdfWorker;
  outputPdf: (t: string) => Promise<Blob>;
};

/** A4 at 96dpi, matching the on-screen preview sheet. */
const A4_WIDTH = "210mm";

export async function renderDocumentPdfBlob(html: string, filename: string): Promise<Blob> {
  const mod = await import("html2pdf.js");
  const html2pdf = (mod as unknown as { default: () => Html2PdfWorker }).default;

  const container = document.createElement("div");
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH};background:#ffffff;`;
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    // Give embedded images (logo, stamp, signature) and the document fonts a
    // chance to load so the canvas snapshot matches the preview exactly.
    await Promise.all([waitForImages(container), waitForFonts()]);

    return await html2pdf()
      .set({
        margin: 0,
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: ["tr", ".signblock", ".totals", ".paycard"] },
      })
      .from(container)
      .outputPdf("blob");
  } finally {
    container.remove();
  }
}

/** Renders and downloads the document as `<name>.pdf`. */
export async function exportDocumentPdf(
  html: string,
  filename: string,
  onStage?: (stage: ExportStage) => void,
): Promise<void> {
  onStage?.("preparing");
  onStage?.("rendering");
  const blob = await renderDocumentPdfBlob(html, filename);
  onStage?.("saving");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  onStage?.("done");
}

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 4000);
          }),
    ),
  );
}

/** Filesystem-safe PDF filename for a document number. */
export function pdfFilename(docNumber: string): string {
  const safe = docNumber.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "document";
  return `${safe}.pdf`;
}

/**
 * The printable document uses the same pairing as the app UI (Plus Jakarta
 * Sans for headings, Inter for body). html2canvas snapshots whatever is
 * painted, so the faces must be resolved before rendering or the PDF falls
 * back to Helvetica while the preview shows the real fonts.
 */
const PDF_FONT_FACES = [
  '400 12px "Inter"',
  '500 12px "Inter"',
  '600 12px "Inter"',
  '700 12px "Inter"',
  '600 12px "Plus Jakarta Sans"',
  '700 12px "Plus Jakarta Sans"',
  '800 28px "Plus Jakarta Sans"',
];

async function waitForFonts(): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 4000));
  const load = (async () => {
    await Promise.all(PDF_FONT_FACES.map((f) => fonts.load(f).catch(() => undefined)));
    await fonts.ready;
  })();
  await Promise.race([load, timeout]);
}
