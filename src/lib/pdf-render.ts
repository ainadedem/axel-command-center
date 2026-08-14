/**
 * Shared PDF renderer.
 *
 * Exports are rasterized inside an isolated same-origin iframe rather than a
 * hidden div in the app document. That matters for two reasons:
 *
 *  - the app stylesheet (Tailwind v4, `oklch()` / `color-mix()` colors) can no
 *    longer leak into the snapshot — html2canvas 1.x throws on those color
 *    functions and the failure used to surface as a blank white PDF;
 *  - the iframe is on-screen (opacity 0) instead of parked off-canvas, which
 *    is the other classic cause of an empty html2canvas snapshot.
 *
 * The canvas is paginated into a multi-page jsPDF by hand, so any failure
 * throws a real error instead of silently producing an empty document.
 */

export type PageOrientation = "portrait" | "landscape";

/** A4 at 96dpi — the same unit the on-screen preview sheet uses. */
const A4_PX = { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } };
const A4_MM = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } };

export type RenderOptions = {
  orientation?: PageOrientation;
  /** Rasterization scale — 2 keeps text crisp without exploding file size. */
  scale?: number;
};

/**
 * Renders a complete HTML document string to a PDF blob.
 * `html` must be a full document (`<!doctype html><html>…`).
 */
export async function renderHtmlToPdfBlob(html: string, opts: RenderOptions = {}): Promise<Blob> {
  const orientation: PageOrientation = opts.orientation ?? "portrait";
  const scale = opts.scale ?? 2;
  const page = A4_PX[orientation];

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("tabindex", "-1");
  frame.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    `width:${page.w}px`,
    `height:${page.h}px`,
    "border:0",
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");
  document.body.appendChild(frame);

  try {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc || !win) throw new Error("Could not create the export frame");

    doc.open();
    doc.write(html);
    doc.close();

    // Let layout settle, then wait for images + fonts inside the frame.
    await nextFrame(win);
    await Promise.all([waitForImages(doc), waitForFonts(doc)]);
    await nextFrame(win);

    const body = doc.body;
    const contentHeight = Math.max(
      page.h,
      body.scrollHeight,
      doc.documentElement.scrollHeight,
    );
    // Grow the frame so html2canvas captures every page of tall content.
    frame.style.height = `${contentHeight}px`;
    await nextFrame(win);

    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width: page.w,
      height: contentHeight,
      windowWidth: page.w,
      windowHeight: contentHeight,
      scrollX: 0,
      scrollY: 0,
    });

    if (isBlankCanvas(canvas)) {
      throw new Error("The rendered page came out empty");
    }

    const mm = A4_MM[orientation];
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation, compress: true });

    // Canvas pixels that fit on one PDF page.
    const pxPerPage = Math.floor((page.h / page.w) * canvas.width);
    const pxRatio = canvas.height / contentHeight; // canvas px per CSS px
    const cuts = computeCuts(
      canvas.height,
      pxPerPage,
      opts.avoidBreakSelector ? collectBoundaries(doc, opts.avoidBreakSelector, pxRatio) : [],
    );

    for (let i = 0; i < cuts.length; i++) {
      const sliceTop = cuts[i]!;
      const sliceHeight = (cuts[i + 1] ?? canvas.height) - sliceTop;
      if (sliceHeight <= 0) continue;

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, sliceTop, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const imgHeightMm = (sliceHeight / canvas.width) * mm.w;
      if (i > 0) pdf.addPage("a4", orientation);
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.95),
        "JPEG",
        0,
        0,
        mm.w,
        Math.min(imgHeightMm, mm.h),
        undefined,
        "FAST",
      );
    }


    return pdf.output("blob");
  } finally {
    frame.remove();
  }
}

/** Renders and downloads the HTML document as `<filename>`. */
export async function downloadHtmlAsPdf(
  html: string,
  filename: string,
  opts: RenderOptions = {},
): Promise<void> {
  const blob = await renderHtmlToPdfBlob(html, opts);
  saveBlob(blob, filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Last-resort fallback: opens the browser print dialog on the same HTML.
 * Used only when rasterization fails, so the user is never left empty-handed.
 */
export function printHtmlFallback(html: string): boolean {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    return false;
  }
  doc.open();
  doc.write(html);
  doc.close();
  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
    setTimeout(() => frame.remove(), 1000);
  }, 400);
  return true;
}

function nextFrame(win: Window): Promise<void> {
  return new Promise((resolve) => {
    const raf = win.requestAnimationFrame?.bind(win);
    if (raf) raf(() => raf(() => resolve()));
    else setTimeout(resolve, 32);
  });
}

async function waitForImages(doc: Document) {
  const imgs = Array.from(doc.images ?? []);
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 5000);
          }),
    ),
  );
}

/**
 * The printable documents use the app pairing (Plus Jakarta Sans headings,
 * Inter body). Faces must resolve before the snapshot or the PDF silently
 * falls back to Helvetica.
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

async function waitForFonts(doc: Document): Promise<void> {
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 5000));
  const load = (async () => {
    await Promise.all(PDF_FONT_FACES.map((f) => fonts.load(f).catch(() => undefined)));
    await fonts.ready;
  })();
  await Promise.race([load, timeout]);
}

/** Samples a grid of pixels; all-white means the snapshot failed. */
function isBlankCanvas(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return true;
  const steps = 24;
  for (let y = 0; y < steps; y++) {
    for (let x = 0; x < steps; x++) {
      const px = Math.min(canvas.width - 1, Math.floor(((x + 0.5) / steps) * canvas.width));
      const py = Math.min(canvas.height - 1, Math.floor(((y + 0.5) / steps) * canvas.height));
      const [r, g, b, a] = ctx.getImageData(px, py, 1, 1).data;
      if (a !== 0 && (r < 245 || g < 245 || b < 245)) return false;
    }
  }
  return true;
}
