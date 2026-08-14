import type { QuoteLine } from "@/lib/mock-data";

/** Clamp a percentage to a sane 0…100 range. Invalid input becomes 0. */
export function pct(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

/** Undiscounted amount of a line. */
export function lineGross(l: Pick<QuoteLine, "quantity" | "rate">): number {
  return (Number(l.quantity) || 0) * (Number(l.rate) || 0);
}

/** Line amount after its own discount percentage. */
export function lineNet(l: Pick<QuoteLine, "quantity" | "rate" | "discountPct">): number {
  return lineGross(l) * (1 - pct(l.discountPct) / 100);
}

export interface DocTotals {
  /** Sum of lines before any discount. */
  gross: number;
  /** Money removed by per-line discounts. */
  lineDiscount: number;
  /** Gross minus line discounts. */
  afterLines: number;
  /** Money removed by the document-wide discount. */
  globalDiscount: number;
  /** Net subtotal (HT) — what gets stored as the document amount. */
  subtotal: number;
  taxAmount: number;
  total: number;
  /** True when any discount applies. */
  hasDiscount: boolean;
}

/** Single source of truth for quote / invoice money math. */
export function docTotals(
  lines: Array<Pick<QuoteLine, "quantity" | "rate" | "discountPct">> | undefined,
  discountPct?: number,
  taxRate?: number,
  fallbackAmount?: number,
): DocTotals {
  const hasLines = !!lines && lines.length > 0;
  const gross = hasLines
    ? lines!.reduce((s, l) => s + lineGross(l), 0)
    : Number(fallbackAmount) || 0;
  const afterLinesRaw = hasLines
    ? lines!.reduce((s, l) => s + lineNet(l), 0)
    : gross;
  const lineDiscount = Math.round(gross - afterLinesRaw);
  const afterLines = Math.round(afterLinesRaw);
  const g = pct(discountPct);
  const globalDiscount = Math.round((afterLines * g) / 100);
  const subtotal = afterLines - globalDiscount;
  const taxAmount = Math.round((subtotal * (Number(taxRate) || 0)) / 100);
  return {
    gross: Math.round(gross),
    lineDiscount,
    afterLines,
    globalDiscount,
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
    hasDiscount: lineDiscount > 0 || globalDiscount > 0,
  };
}
