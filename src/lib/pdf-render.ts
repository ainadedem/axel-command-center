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

import { EXPORT_FONT_FACES, getInlineFontCss } from "@/lib/export-fonts";

export type PageOrientation = "portrait" | "landscape";

/** A4 at 96dpi — the same unit the on-screen preview sheet uses. */
const A4_PX = { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } };
const A4_MM = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } };

export type RenderOptions = {
  orientation?: PageOrientation;
  /** Rasterization scale — 2 keeps text crisp without exploding file size. */
  scale?: number;
  /**
   * Elements that must never be cut across a page boundary (e.g. `"tr"`).
   * Page breaks snap to the nearest boundary above the natural cut.
   */
  avoidBreakSelector?: string;
  /**
   * Hard ceiling on the number of emitted pages. With `1`, the whole capture
   * is placed on a single sheet, scaled down proportionally when needed, so a
   * "fit one page" export can never spill onto a second page.
   */
  maxPages?: number;
  /**

   * Hard ceiling for web-font fetching / loading. When it elapses the export
   * continues with the system fallback stack instead of hanging.
   */
  fontTimeoutMs?: number;
};

/** Bottom edges (in canvas px) of elements that must not be split. */
function collectBoundaries(doc: Document, selector: string, pxRatio: number): number[] {
  const els = Array.from(doc.querySelectorAll<HTMLElement>(selector));
  const edges = els
    .map((el) => {
      const r = el.getBoundingClientRect();
      return (r.bottom + (doc.documentElement.scrollTop || 0)) * pxRatio;
    })
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  return edges;
}

/** Page cut offsets (canvas px), snapped to element boundaries when possible. */
function computeCuts(total: number, pxPerPage: number, boundaries: number[]): number[] {
  const cuts = [0];
  let top = 0;
  let guard = 0;
  while (top + pxPerPage < total && guard++ < 500) {
    const natural = top + pxPerPage;
    // Nearest boundary at or above the natural cut, but still on this page.
    let snapped = natural;
    for (const b of boundaries) {
      if (b > top + pxPerPage * 0.3 && b <= natural) snapped = b;
      if (b > natural) break;
    }
    top = Math.floor(snapped);
    cuts.push(top);
  }
  return cuts;
}


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

    // Inline the cached web fonts so repeated exports skip the network and
    // always rasterize with the exact same faces.
    await injectCachedFonts(doc, opts.fontTimeoutMs ?? 4000);

    // Let layout settle, then wait for images + fonts inside the frame.
    await nextFrame(win);
    await Promise.all([waitForImages(doc), waitForFonts(doc, opts.fontTimeoutMs ?? 4000)]);
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
    // Trailing whitespace would otherwise produce an extra empty page.
    const usableHeight = trimTrailingWhitespace(canvas, pxPerPage);

    // Single-page mode: place the whole capture on one sheet, scaled to fit.
    if (opts.maxPages === 1) {
      const inkHeight = Math.max(1, Math.min(canvas.height, lastInkRow(canvas) || usableHeight));
      const naturalH = (inkHeight / canvas.width) * mm.w;
      const k = naturalH > mm.h ? mm.h / naturalH : 1;
      const drawW = mm.w * k;
      const drawH = naturalH * k;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = inkHeight;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, 0, canvas.width, inkHeight, 0, 0, canvas.width, inkHeight);
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.95),
        "JPEG",
        (mm.w - drawW) / 2,
        0,
        drawW,
        drawH,
        undefined,
        "FAST",
      );
      return pdf.output("blob");
    }


    const cuts = computeCuts(
      usableHeight,
      pxPerPage,
      opts.avoidBreakSelector ? collectBoundaries(doc, opts.avoidBreakSelector, pxRatio) : [],
    );


    let pageIndex = 0;
    for (let i = 0; i < cuts.length; i++) {
      const sliceTop = cuts[i]!;
      const sliceHeight = (cuts[i + 1] ?? usableHeight) - sliceTop;
      if (sliceHeight <= 0) continue;

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error("Canvas is unavailable in this browser");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, sliceTop, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      // A slice with no ink is padding at the end of the document — skip it
      // rather than emitting an empty trailing page.
      if (pageIndex > 0 && !hasInk(slice)) continue;

      const imgHeightMm = (sliceHeight / canvas.width) * mm.w;
      if (pageIndex > 0) pdf.addPage("a4", orientation);
      pageIndex++;
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
 * The printable documents use the app pairing (Figtree headings,
 * Inter body). Faces must resolve before the snapshot or the PDF silently
 * falls back to Helvetica.
 */
const PDF_FONT_FACES = EXPORT_FONT_FACES;

/** Injects the session-cached `@font-face` payloads into the export frame. */
async function injectCachedFonts(doc: Document, timeoutMs: number): Promise<void> {
  try {
    const css = await getInlineFontCss(timeoutMs);
    if (!css) return;
    const style = doc.createElement("style");
    style.setAttribute("data-export-fonts", "inline");
    style.textContent = css;
    doc.head?.appendChild(style);
  } catch {
    /* fall back to the <link> tag already present in the document */
  }
}

async function waitForFonts(doc: Document, timeoutMs = 4000): Promise<void> {
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  const load = (async () => {
    await Promise.all(PDF_FONT_FACES.map((f) => fonts.load(f).catch(() => undefined)));
    await fonts.ready;
  })();
  await Promise.race([load, timeout]);
}

/** Last canvas row (px) that contains ink; 0 when the canvas is blank. */
function lastInkRow(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas.height;
  const step = Math.max(2, Math.floor(canvas.height / 2000));
  for (let y = canvas.height - 1; y >= 0; y -= step) {
    const row = ctx.getImageData(0, y, canvas.width, 1).data;
    for (let x = 0; x < row.length; x += 4 * 4) {
      if (row[x + 3] !== 0 && (row[x]! < 245 || row[x + 1]! < 245 || row[x + 2]! < 245)) {
        return Math.min(canvas.height, y + step);
      }
    }
  }
  return 0;
}

/**
 * Height (canvas px) of the content once trailing blank space is dropped,
 * rounded up to at least one full page.
 */
function trimTrailingWhitespace(canvas: HTMLCanvasElement, pxPerPage: number): number {
  const lastInk = lastInkRow(canvas);
  if (!lastInk) return Math.min(canvas.height, pxPerPage);

  // Keep whole pages: never cut below the page the last ink sits on.
  const pages = Math.max(1, Math.ceil(lastInk / pxPerPage));
  return Math.min(canvas.height, pages * pxPerPage);
}

/** Dense scan: true when the canvas contains any non-white pixel. */
function hasInk(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !canvas.width || !canvas.height) return false;
  const step = Math.max(1, Math.floor(canvas.height / 600));
  for (let y = 0; y < canvas.height; y += step) {
    const row = ctx.getImageData(0, y, canvas.width, 1).data;
    for (let x = 0; x < row.length; x += 4 * 3) {
      if (row[x + 3] !== 0 && (row[x]! < 245 || row[x + 1]! < 245 || row[x + 2]! < 245)) return true;
    }
  }
  return false;
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
