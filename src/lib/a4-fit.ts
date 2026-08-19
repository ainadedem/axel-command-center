/**
 * Shared A4 "fit on one page" geometry.
 *
 * Both the on-screen preview and the export pipeline reduce a document's
 * content scale until it fits a single A4 sheet. Keeping the maths here means
 * the preview and the exported PDF always agree, and the rules are testable
 * without a browser.
 */

/** CSS pixels per millimetre at 96 dpi. */
export const MM = 96 / 25.4;

/** Page padding used by the printable sheet, in millimetres. */
export const PAGE_PAD_MM = 22;

/** Full A4 height in CSS pixels. */
export const A4_H = 297 * MM;

/** Printable height of one A4 page (inside the padding), in CSS pixels. */
export const USABLE_H = (297 - PAGE_PAD_MM * 2) * MM;

/** Comfortable floor for the automatic preview shrink. */
export const MIN_AUTO_SCALE = 0.62;

/** Export-time floor — a little tighter than the preview's comfortable floor. */
export const EXPORT_MIN_SCALE = 0.55;

/** Ceiling for the manual density slider. */
export const MAX_MANUAL_SCALE = 1.2;

/** Step used when searching for a fitting scale. */
export const SCALE_STEP = 0.05;

export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Number of A4 pages a sheet of `sheetHeight` CSS px (padding included) needs. */
export function pagesForSheetHeight(sheetHeight: number): number {
  const contentH = Math.max(0, sheetHeight - PAGE_PAD_MM * 2 * MM);
  return Math.max(1, Math.ceil((contentH - 2) / USABLE_H));
}

/** Number of A4 pages for a raw content height (padding already excluded). */
export function pagesForContentHeight(contentHeight: number): number {
  return Math.max(1, Math.ceil((Math.max(0, contentHeight) - 2) / USABLE_H));
}

/** The next scale step down, never below `floor`. */
export function nextScaleDown(scale: number, floor = EXPORT_MIN_SCALE): number {
  return Math.max(floor, round3(scale - SCALE_STEP));
}

export interface FitResult {
  /** Scale to render at. */
  scale: number;
  /** Whether the document fits one page at that scale. */
  fits: boolean;
  /** True when the scale had to be reduced below the requested one. */
  compressed: boolean;
  /** Pages the document needs at the returned scale. */
  pages: number;
}

/**
 * Resolves the largest scale (stepping down from `startScale`) at which a
 * document whose unscaled content height is `contentHeightAt1` fits one A4
 * page. Content height is assumed to scale linearly with the scale factor,
 * which matches how the printable sheet uses a font-size multiplier.
 */
export function fitScaleForContent(
  contentHeightAt1: number,
  startScale = 1,
  floor = EXPORT_MIN_SCALE,
): FitResult {
  let scale = round3(startScale);
  let pages = pagesForContentHeight(contentHeightAt1 * scale);
  let compressed = false;
  while (pages > 1 && scale > floor) {
    scale = nextScaleDown(scale, floor);
    pages = pagesForContentHeight(contentHeightAt1 * scale);
    compressed = true;
  }
  return { scale, fits: pages <= 1, compressed: compressed || pages > 1, pages };
}
