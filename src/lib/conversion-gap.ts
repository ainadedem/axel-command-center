/**
 * Conversion gap: where revenue is stuck between quotation and invoice.
 *
 * Two gaps are tracked, both in MGA:
 *  - "Not sent"          → quotations created but still in draft.
 *  - "Awaiting invoicing" → quotations sent/accepted with no invoice raised yet.
 *  - "Draft invoices"     → invoices created but not issued to the client.
 *
 * Everything here is pure so it can be reused by the dashboard and the pipeline.
 */
import { toMGA, type Quote, type Invoice, type Client, type Project } from "@/lib/mock-data";
import { quotePayable } from "@/lib/pipeline-link";
import { invoicePayable } from "@/lib/invoice-money";

export interface GapBucket {
  count: number;
  amount: number;
}

export interface ConversionGap {
  /** Draft quotations — created but never sent. */
  notSent: GapBucket;
  /** Sent or accepted quotations with no invoice raised against them. */
  awaitingInvoicing: GapBucket;
  /** Invoices created but still in draft (not issued). */
  draftInvoices: GapBucket;
  quotesNotSent: Quote[];
  quotesAwaiting: Quote[];
  invoicesDraft: Invoice[];
}

export interface GapRow extends ConversionGap {
  key: string;
  label: string;
  /** Total money at risk across all three buckets. */
  total: number;
}

const emptyBucket = (): GapBucket => ({ count: 0, amount: 0 });

export const emptyGap = (): ConversionGap => ({
  notSent: emptyBucket(),
  awaitingInvoicing: emptyBucket(),
  draftInvoices: emptyBucket(),
  quotesNotSent: [],
  quotesAwaiting: [],
  invoicesDraft: [],
});

const add = (b: GapBucket, amount: number) => { b.count += 1; b.amount += amount; };

/** True when the quotation still deserves to be invoiced. */
const awaitsInvoice = (q: Quote) => q.status === "sent" || q.status === "accepted";

/**
 * Build the conversion gap for a set of quotations and invoices.
 * A quotation counts as invoiced when any non-cancelled invoice references it
 * through `quoteId`, or when both hang off the same opportunity.
 */
export function buildConversionGap(quotes: Quote[], invoices: Invoice[]): ConversionGap {
  const live = invoices.filter((i) => i.status !== "cancelled");
  const byQuote = new Set(live.map((i) => i.quoteId).filter(Boolean) as string[]);
  const byOpp = new Set(live.map((i) => i.opportunityId).filter(Boolean) as string[]);

  const gap = emptyGap();
  for (const q of quotes) {
    const value = toMGA(quotePayable(q), q.currency);
    if (q.status === "draft") {
      add(gap.notSent, value);
      gap.quotesNotSent.push(q);
      continue;
    }
    if (!awaitsInvoice(q)) continue;
    const invoiced = byQuote.has(q.id) || (q.opportunityId ? byOpp.has(q.opportunityId) : false);
    if (invoiced) continue;
    add(gap.awaitingInvoicing, value);
    gap.quotesAwaiting.push(q);
  }
  for (const i of live) {
    if (i.status !== "draft") continue;
    add(gap.draftInvoices, toMGA(invoicePayable(i), i.currency));
    gap.invoicesDraft.push(i);
  }
  return gap;
}

export const gapTotal = (g: ConversionGap) =>
  g.notSent.amount + g.awaitingInvoicing.amount + g.draftInvoices.amount;

type Grouper = (doc: { clientId?: string; projectId?: string }) => string | undefined;

function groupRows(
  quotes: Quote[],
  invoices: Invoice[],
  by: Grouper,
  label: (key: string) => string,
): GapRow[] {
  const keys = new Set<string>();
  const qByKey = new Map<string, Quote[]>();
  const iByKey = new Map<string, Invoice[]>();
  for (const q of quotes) {
    const k = by(q) ?? "—";
    keys.add(k);
    (qByKey.get(k) ?? qByKey.set(k, []).get(k)!).push(q);
  }
  for (const i of invoices) {
    const k = by(i) ?? "—";
    keys.add(k);
    (iByKey.get(k) ?? iByKey.set(k, []).get(k)!).push(i);
  }
  const rows: GapRow[] = [];
  for (const k of keys) {
    const gap = buildConversionGap(qByKey.get(k) ?? [], iByKey.get(k) ?? []);
    const total = gapTotal(gap);
    if (!total) continue;
    rows.push({ ...gap, key: k, label: label(k), total });
  }
  return rows.sort((a, b) => b.total - a.total);
}

/** Per-client conversion gap, biggest exposure first. */
export function gapByClient(quotes: Quote[], invoices: Invoice[], clients: Client[]): GapRow[] {
  const names = new Map(clients.map((c) => [c.id, c.name]));
  return groupRows(quotes, invoices, (d) => d.clientId, (k) => names.get(k) ?? "Unassigned client");
}

/** Per-project conversion gap, biggest exposure first. */
export function gapByProject(quotes: Quote[], invoices: Invoice[], projects: Project[]): GapRow[] {
  const names = new Map(projects.map((p) => [p.id, p.name]));
  return groupRows(quotes, invoices, (d) => d.projectId, (k) => names.get(k) ?? "No project");
}
