/**
 * Quoted → invoiced variance.
 *
 * Explains why the invoiced total of a pipeline deal differs from what was
 * quoted, splitting the gap into three causes:
 *  - scope     — lines quoted but never invoiced, and invoiced but never quoted
 *  - priceQty  — lines present on both sides at a different rate / qty / discount
 *  - fx        — the part caused purely by exchange-rate movement between the
 *                quote's FX snapshot and today's rates
 *
 * All money is expressed in MGA. Pure module: no store writes.
 */
import { FX, toMGA, type Currency, type Quote, type Invoice, type QuoteLine } from "@/lib/mock-data";
import { lineNet, pct } from "@/lib/discounts";
import { invoicePayable } from "@/lib/invoice-money";
import { quotePayable, isLiveQuote } from "@/lib/pipeline-link";

export interface VarianceLine {
  key: string;
  description: string;
  /** MGA value on the quotation side. */
  quoted: number;
  /** MGA value on the invoice side. */
  invoiced: number;
  /** invoiced − quoted, MGA. */
  delta: number;
  quantityQuoted?: number;
  quantityInvoiced?: number;
  /** Document numbers this line came from. */
  quoteNumbers: string[];
  invoiceNumbers: string[];
}

export interface QuoteInvoiceVariance {
  /** Quoted total, MGA (live quotes only), valued at current rates. */
  quoted: number;
  /** Invoiced total, MGA (non-cancelled). */
  invoiced: number;
  /** invoiced − quoted, MGA. */
  total: number;
  /** Share of the quoted value that has been invoiced, 0…1 (0 when nothing quoted). */
  invoicedPct: number;
  /** Quoted value still not invoiced (never negative), MGA. */
  notInvoiced: number;
  /** Attribution buckets — scope + priceQty + fx ≈ total. */
  scope: number;
  priceQty: number;
  fx: number;
  /** Rounding / document-level residual not attributable to lines. */
  unexplained: number;
  /** Quoted lines with no invoice counterpart. */
  missing: VarianceLine[];
  /** Invoiced lines with no quote counterpart. */
  extra: VarianceLine[];
  /** Lines on both sides whose amount changed. */
  changed: VarianceLine[];
  /** True when at least one document on either side has no line detail. */
  partialDetail: boolean;
}

export const emptyVariance = (): QuoteInvoiceVariance => ({
  quoted: 0, invoiced: 0, total: 0, invoicedPct: 0, notInvoiced: 0,
  scope: 0, priceQty: 0, fx: 0, unexplained: 0,
  missing: [], extra: [], changed: [], partialDetail: false,
});

const normalize = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .replace(/[\s\u00a0]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

/** Matching key for a line: normalised description, else capability+level. */
export function lineKey(l: QuoteLine): string {
  const d = normalize(l.description);
  if (d) return `d:${d}`;
  const cap = normalize(l.capability);
  const lvl = normalize(l.level);
  if (cap || lvl) return `c:${cap}|${lvl}`;
  return `u:${l.id}`;
}

/**
 * MGA rate used to value a quotation.
 * Uses the quote's own FX snapshot when it is expressed against a known base,
 * so historical quotes are not re-priced by today's market.
 */
export function quoteRateMGA(q: Pick<Quote, "currency" | "fxRate" | "fxBaseCurrency">): number {
  const rate = Number(q.fxRate);
  if (Number.isFinite(rate) && rate > 0 && q.fxBaseCurrency) {
    // fxRate = value of 1 unit of `currency` expressed in `fxBaseCurrency`.
    const base = FX[q.fxBaseCurrency as Currency];
    if (Number.isFinite(base) && base > 0) return rate * base;
  }
  return FX[q.currency];
}

/** Current MGA rate for a currency. */
const currentRate = (c: Currency) => FX[c];

interface Side {
  key: string;
  description: string;
  amount: number;      // MGA at current rates
  amountAtDoc: number; // MGA at the document's own rate (quotes: FX snapshot)
  quantity: number;
  numbers: string[];
}

/** Aggregates the lines of one document set by matching key. */
function collect(
  docs: Array<{ number: string; lines?: QuoteLine[]; discountPct?: number; taxRate?: number; currency: Currency }>,
  rateNow: (c: Currency) => number,
  rateDoc: (d: { currency: Currency }) => number,
): { map: Map<string, Side>; detailed: number } {
  const map = new Map<string, Side>();
  let detailed = 0;
  for (const doc of docs) {
    const lines = doc.lines ?? [];
    if (lines.length === 0) continue;
    detailed++;
    const g = pct(doc.discountPct) / 100;
    const tax = 1 + (Number(doc.taxRate) || 0) / 100;
    const now = rateNow(doc.currency);
    const at = rateDoc(doc);
    for (const l of lines) {
      const net = lineNet(l) * (1 - g) * tax;
      const key = lineKey(l);
      const prev = map.get(key);
      if (prev) {
        prev.amount += net * now;
        prev.amountAtDoc += net * at;
        prev.quantity += Number(l.quantity) || 0;
        if (!prev.numbers.includes(doc.number)) prev.numbers.push(doc.number);
      } else {
        map.set(key, {
          key,
          description: l.description?.trim() || l.capability || "Line",
          amount: net * now,
          amountAtDoc: net * at,
          quantity: Number(l.quantity) || 0,
          numbers: [doc.number],
        });
      }
    }
  }
  return { map, detailed };
}

const r0 = (n: number) => Math.round(n);

/** Computes the quoted → invoiced variance for one deal's documents. */
export function computeVariance(quotes: Quote[], invoices: Invoice[]): QuoteInvoiceVariance {
  const liveQuotes = quotes.filter(isLiveQuote);
  const liveInvoices = invoices.filter((i) => i.status !== "cancelled");

  if (liveQuotes.length === 0 && liveInvoices.length === 0) return emptyVariance();

  // Document-level totals (authoritative), in MGA at current rates.
  const quoted = liveQuotes.reduce((s, q) => s + toMGA(quotePayable(q), q.currency), 0);
  const invoiced = liveInvoices.reduce((s, i) => s + toMGA(invoicePayable(i), i.currency), 0);

  // Quoted value at the quote's own FX snapshot — difference is the FX effect.
  const quotedAtQuoteRate = liveQuotes.reduce(
    (s, q) => s + quotePayable(q) * quoteRateMGA(q),
    0,
  );
  const fx = r0(quoted - quotedAtQuoteRate);

  const q = collect(
    liveQuotes.map((x) => ({
      number: x.number, lines: x.lines, discountPct: x.discountPct, taxRate: x.taxRate, currency: x.currency,
    })),
    currentRate,
    (d) => quoteRateMGA(d as Quote),
  );
  const i = collect(
    liveInvoices.map((x) => ({
      number: x.number, lines: x.lines, discountPct: x.discountPct, taxRate: x.taxRate, currency: x.currency,
    })),
    currentRate,
    (d) => currentRate(d.currency),
  );

  const missing: VarianceLine[] = [];
  const extra: VarianceLine[] = [];
  const changed: VarianceLine[] = [];
  let scope = 0;
  let priceQty = 0;

  for (const [key, qs] of q.map) {
    const is = i.map.get(key);
    if (!is) {
      scope -= qs.amount;
      missing.push({
        key, description: qs.description,
        quoted: r0(qs.amount), invoiced: 0, delta: r0(-qs.amount),
        quantityQuoted: qs.quantity,
        quoteNumbers: qs.numbers, invoiceNumbers: [],
      });
      continue;
    }
    const delta = is.amount - qs.amount;
    priceQty += delta;
    if (Math.abs(delta) >= 1) {
      changed.push({
        key, description: qs.description,
        quoted: r0(qs.amount), invoiced: r0(is.amount), delta: r0(delta),
        quantityQuoted: qs.quantity, quantityInvoiced: is.quantity,
        quoteNumbers: qs.numbers, invoiceNumbers: is.numbers,
      });
    }
  }

  for (const [key, is] of i.map) {
    if (q.map.has(key)) continue;
    scope += is.amount;
    extra.push({
      key, description: is.description,
      quoted: 0, invoiced: r0(is.amount), delta: r0(is.amount),
      quantityInvoiced: is.quantity,
      quoteNumbers: [], invoiceNumbers: is.numbers,
    });
  }

  const total = r0(invoiced - quoted);
  const scopeR = r0(scope);
  const priceR = r0(priceQty);

  const sortDesc = (a: VarianceLine, b: VarianceLine) => Math.abs(b.delta) - Math.abs(a.delta);
  missing.sort(sortDesc); extra.sort(sortDesc); changed.sort(sortDesc);

  return {
    quoted: r0(quoted),
    invoiced: r0(invoiced),
    total,
    invoicedPct: quoted > 0 ? Math.min(2, invoiced / quoted) : 0,
    notInvoiced: Math.max(0, r0(quoted - invoiced)),
    scope: scopeR,
    priceQty: priceR,
    fx,
    unexplained: total - scopeR - priceR - fx,
    missing, extra, changed,
    partialDetail:
      (liveQuotes.length > 0 && q.detailed < liveQuotes.length) ||
      (liveInvoices.length > 0 && i.detailed < liveInvoices.length),
  };
}

/** True when the deal has anything worth showing in a variance panel. */
export const hasVariance = (v: QuoteInvoiceVariance) =>
  Math.abs(v.total) >= 1 || v.missing.length > 0 || v.extra.length > 0 || v.changed.length > 0;

/** Variance for every rolled-up deal, keyed by opportunity id. */
export function buildVariances(
  rollups: Map<string, { quotes: Quote[]; invoices: Invoice[] }>,
): Map<string, QuoteInvoiceVariance> {
  const out = new Map<string, QuoteInvoiceVariance>();
  for (const [id, r] of rollups) out.set(id, computeVariance(r.quotes, r.invoices));
  return out;
}
