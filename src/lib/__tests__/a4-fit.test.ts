import { describe, expect, it } from "vitest";
import {
  EXPORT_MIN_SCALE,
  IDENTITY_FLOOR,
  CONTENT_FLOOR,
  identityScale,
  contentScale,
  USABLE_H,
  fitScaleForContent,
  nextScaleDown,
  pagesForContentHeight,
  pagesForSheetHeight,
  PAGE_PAD_MM,
  MM,
} from "@/lib/a4-fit";

/**
 * Rough model of a printable document's unscaled content height:
 * header + client block + totals + payment details, plus one row per line item
 * and extra height for long descriptions that wrap.
 */
function contentHeight(opts: {
  lines: number;
  /** Average wrapped rows per line description. */
  wrap?: number;
  notes?: number;
  payment?: boolean;
  stamp?: boolean;
}): number {
  const rowH = 26;
  const base = 260 /* header */ + 150 /* parties */ + 130 /* totals */;
  return (
    base +
    opts.lines * rowH * (opts.wrap ?? 1) +
    (opts.notes ?? 0) * 18 +
    (opts.payment ? 120 : 0) +
    (opts.stamp ? 110 : 0)
  );
}

describe("A4 page geometry", () => {
  it("counts a short document as one page", () => {
    expect(pagesForContentHeight(USABLE_H - 40)).toBe(1);
    expect(pagesForSheetHeight(297 * MM)).toBe(1);
  });

  it("counts overflow as extra pages", () => {
    expect(pagesForContentHeight(USABLE_H * 2 - 10)).toBe(2);
    expect(pagesForSheetHeight(USABLE_H * 2 + PAGE_PAD_MM * 2 * MM)).toBe(2);
  });

  it("never steps below the floor", () => {
    expect(nextScaleDown(EXPORT_MIN_SCALE)).toBe(EXPORT_MIN_SCALE);
    expect(nextScaleDown(1)).toBeCloseTo(0.95, 5);
  });
});

describe("one-page export scenarios", () => {
  const scenarios: Array<{ name: string; height: number }> = [
    { name: "short invoice, 3 lines", height: contentHeight({ lines: 3, payment: true }) },
    { name: "typical invoice, 10 lines", height: contentHeight({ lines: 10, payment: true }) },
    { name: "long quotation, 22 lines", height: contentHeight({ lines: 22, payment: true, stamp: true }) },
    {
      name: "quotation with wrapped detail column, 18 lines",
      height: contentHeight({ lines: 18, wrap: 2.2, payment: true }),
    },
    {
      name: "invoice with long notes block",
      height: contentHeight({ lines: 12, notes: 14, payment: true, stamp: true }),
    },
    {
      name: "dense quotation, 28 lines with stamp and signature",
      height: contentHeight({ lines: 28, wrap: 1.3, payment: true, stamp: true }),
    },
  ];

  for (const s of scenarios) {
    it(`fits one A4 page: ${s.name}`, () => {
      const res = fitScaleForContent(s.height);
      expect(res.pages).toBe(1);
      expect(res.fits).toBe(true);
      expect(res.scale).toBeGreaterThanOrEqual(EXPORT_MIN_SCALE);
      expect(res.scale).toBeLessThanOrEqual(1);
    });
  }

  it("does not shrink documents that already fit", () => {
    const res = fitScaleForContent(contentHeight({ lines: 4 }));
    expect(res.scale).toBe(1);
    expect(res.compressed).toBe(false);
  });

  it("reports compression when the document had to shrink", () => {
    const res = fitScaleForContent(contentHeight({ lines: 24, payment: true, stamp: true }));
    expect(res.compressed).toBe(true);
    expect(res.scale).toBeLessThan(1);
  });

  it("flags genuinely oversized content instead of silently overflowing", () => {
    const res = fitScaleForContent(contentHeight({ lines: 120, payment: true }));
    expect(res.scale).toBe(EXPORT_MIN_SCALE);
    expect(res.fits).toBe(false);
    expect(res.compressed).toBe(true);
  });

  it("honours a manual starting density", () => {
    const h = contentHeight({ lines: 16, payment: true });
    const auto = fitScaleForContent(h, 1);
    const manual = fitScaleForContent(h, 0.8);
    expect(manual.scale).toBeLessThanOrEqual(auto.scale);
    expect(manual.pages).toBe(1);
  });
});

describe("two-tier compression", () => {
  it("keeps the company identity at or above the readable floor", () => {
    for (const s of [1, 0.9, 0.8, 0.7, EXPORT_MIN_SCALE]) {
      expect(identityScale(s)).toBeGreaterThanOrEqual(IDENTITY_FLOOR);
      expect(identityScale(s)).toBeLessThanOrEqual(1);
    }
  });

  it("shrinks line-item content more than the company identity", () => {
    for (const s of [0.9, 0.8, 0.7, 0.62, EXPORT_MIN_SCALE]) {
      expect(contentScale(s)).toBeLessThan(identityScale(s));
    }
  });

  it("never scales content below its floor", () => {
    expect(contentScale(EXPORT_MIN_SCALE)).toBeGreaterThanOrEqual(CONTENT_FLOOR);
    expect(contentScale(0.2)).toBe(CONTENT_FLOOR);
  });

  it("leaves an uncompressed document untouched", () => {
    expect(identityScale(1)).toBe(1);
    expect(contentScale(1)).toBe(1);
    expect(identityScale(1.2)).toBe(1.2);
    expect(contentScale(1.2)).toBe(1.2);
  });
});
