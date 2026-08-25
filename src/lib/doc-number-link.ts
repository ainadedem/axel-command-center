/**
 * Smart links resolved by document number.
 *
 * Stored ID links (`invoice.quoteId`, `invoice.poId`, `po.quoteId`) are always
 * preferred. When they are absent — imported ledgers, documents typed by hand —
 * we look for the other document's *number* in the text the document already
 * carries (object/subject, notes, client PO reference) and infer the link.
 *
 * Pure functions: no store writes, no React.
 */
import type { Invoice, PurchaseOrder, Quote } from "@/lib/mock-data";

export type LinkSource = "stored" | "number";

export interface ResolvedLink<T> {
  doc: T;
  source: LinkSource;
}

/** Uppercase, strip everything that is not a letter or a digit. */
export const normalizeDocNumber = (n: string) => n.toUpperCase().replace(/[^A-Z0-9]+/g, "");

/** Trailing digit run of a number (`DEV/LOG/08-26/534` → `534`). */
const tailDigits = (n: string) => /(\d+)\s*$/.exec(n.trim())?.[1] ?? "";

/** Everything before the trailing digit run, normalized (`DEVLOG0826`). */
const seriesPrefix = (n: string) => {
  const tail = tailDigits(n);
  const raw = tail ? n.trim().slice(0, n.trim().length - tail.length) : n;
  return normalizeDocNumber(raw);
};

/** Free text a document carries where people write other document numbers. */
export const linkTextOf = (d: { subject?: string; notes?: string; clientReference?: string }) =>
  [d.subject, d.notes, d.clientReference].filter(Boolean).join(" \u00b7 ");

/**
 * Does `text` reference `number`?
 *
 * Full-number containment (punctuation- and case-insensitive) always counts.
 * A bare trailing sequence (`534`) counts only when `ownNumber` belongs to the
 * same series, so `DEV/LOG/08-26/540` mentioning "534" resolves but an
 * unrelated `FAC-2026-534` does not.
 */
export function textReferencesNumber(text: string, number: string, ownNumber?: string): boolean {
  if (!text || !number) return false;
  const hay = normalizeDocNumber(text);
  const needle = normalizeDocNumber(number);
  if (needle.length >= 4 && hay.includes(needle)) return true;

  const tail = tailDigits(number);
  if (!ownNumber || tail.length < 2) return false;
  if (seriesPrefix(number) !== seriesPrefix(ownNumber)) return false;
  return new RegExp(`(^|\\D)${tail}(\\D|$)`).test(text);
}

interface NumberedDoc {
  id: string;
  number: string;
  companyId: string;
  status?: string;
}

/**
 * Candidates from `docs` whose number appears in `text`, scoped to one company
 * and excluding cancelled documents. Longest number first so a more specific
 * match wins when one number is a prefix of another.
 */
export function findByNumber<T extends NumberedDoc>(
  text: string,
  docs: T[],
  companyId: string,
  ownNumber?: string,
): T[] {
  if (!text) return [];
  return docs
    .filter((d) => d.companyId === companyId && d.status !== "cancelled")
    .filter((d) => textReferencesNumber(text, d.number, ownNumber))
    .sort((a, b) => b.number.length - a.number.length);
}

/** Match unless the number is ambiguous (resolves to several documents). */
function unique<T extends NumberedDoc>(matches: T[]): { doc?: T; ambiguous: number } {
  if (matches.length === 1) return { doc: matches[0], ambiguous: 0 };
  // Same number written twice (duplicate documents) is still ambiguous.
  return { doc: undefined, ambiguous: matches.length };
}

// ---------------------------------------------------------------------------
// Per-relation resolvers
// ---------------------------------------------------------------------------

export interface RelationResult<T> {
  doc?: T;
  source?: LinkSource;
  /** How many documents the referenced number matched, when it was ambiguous. */
  ambiguous: number;
}

const stored = <T extends { id: string }>(id: string | undefined, docs: T[]): T | undefined =>
  id ? docs.find((d) => d.id === id) : undefined;

/** Source quotation of an invoice: stored link, else number found in its text. */
export function resolveInvoiceQuote(inv: Invoice, quotes: Quote[]): RelationResult<Quote> {
  const direct = stored(inv.quoteId, quotes);
  if (direct) return { doc: direct, source: "stored", ambiguous: 0 };
  const { doc, ambiguous } = unique(findByNumber(linkTextOf(inv), quotes, inv.companyId, inv.number));
  return { doc, source: doc ? "number" : undefined, ambiguous };
}

/** Purchase order of an invoice: stored link, else number found in its text. */
export function resolveInvoicePo(inv: Invoice, pos: PurchaseOrder[]): RelationResult<PurchaseOrder> {
  const direct = stored(inv.poId, pos);
  if (direct) return { doc: direct, source: "stored", ambiguous: 0 };
  const { doc, ambiguous } = unique(findByNumber(linkTextOf(inv), pos, inv.companyId, inv.number));
  return { doc, source: doc ? "number" : undefined, ambiguous };
}

/** Source quotation of a purchase order. */
export function resolvePoQuote(po: PurchaseOrder, quotes: Quote[]): RelationResult<Quote> {
  const direct = stored(po.quoteId, quotes);
  if (direct) return { doc: direct, source: "stored", ambiguous: 0 };
  const { doc, ambiguous } = unique(findByNumber(linkTextOf(po), quotes, po.companyId, po.number));
  return { doc, source: doc ? "number" : undefined, ambiguous };
}

/**
 * Invoices inferred for a quotation by number — either the invoice mentions the
 * quote number, or the quote's own text mentions the invoice number.
 */
export function invoicesByNumberForQuote(q: Quote, invoices: Invoice[]): Invoice[] {
  const fromInvoices = invoices.filter(
    (i) =>
      i.companyId === q.companyId &&
      i.status !== "cancelled" &&
      !i.quoteId &&
      textReferencesNumber(linkTextOf(i), q.number, i.number),
  );
  const fromQuote = findByNumber(linkTextOf(q), invoices, q.companyId, q.number).filter((i) => !i.quoteId);
  const seen = new Set(fromInvoices.map((i) => i.id));
  return [...fromInvoices, ...fromQuote.filter((i) => !seen.has(i.id))];
}

// ---------------------------------------------------------------------------
// Backfill: everything that can be turned into a permanent ID link
// ---------------------------------------------------------------------------

export interface BackfillCandidate {
  kind: "invoice-quote" | "invoice-po" | "po-quote";
  /** Document that will be updated. */
  targetId: string;
  targetNumber: string;
  /** Document it will point at. */
  linkId: string;
  linkNumber: string;
  label: string;
}

export function backfillCandidates(o: {
  invoices: Invoice[];
  pos: PurchaseOrder[];
  quotes: Quote[];
}): BackfillCandidate[] {
  const out: BackfillCandidate[] = [];
  for (const inv of o.invoices) {
    if (inv.status === "cancelled") continue;
    if (!inv.quoteId) {
      const r = resolveInvoiceQuote(inv, o.quotes);
      if (r.doc && r.source === "number")
        out.push({
          kind: "invoice-quote", targetId: inv.id, targetNumber: inv.number,
          linkId: r.doc.id, linkNumber: r.doc.number,
          label: `Invoice ${inv.number} → quotation ${r.doc.number}`,
        });
    }
    if (!inv.poId) {
      const r = resolveInvoicePo(inv, o.pos);
      if (r.doc && r.source === "number")
        out.push({
          kind: "invoice-po", targetId: inv.id, targetNumber: inv.number,
          linkId: r.doc.id, linkNumber: r.doc.number,
          label: `Invoice ${inv.number} → purchase order ${r.doc.number}`,
        });
    }
  }
  for (const po of o.pos) {
    if (po.quoteId || po.status === "cancelled") continue;
    const r = resolvePoQuote(po, o.quotes);
    if (r.doc && r.source === "number")
      out.push({
        kind: "po-quote", targetId: po.id, targetNumber: po.number,
        linkId: r.doc.id, linkNumber: r.doc.number,
        label: `Purchase order ${po.number} → quotation ${r.doc.number}`,
      });
  }
  return out;
}
