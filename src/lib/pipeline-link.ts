/**
 * Bridge between the pipeline (opportunities) and the billing documents
 * (quotations + invoices).
 *
 * Everything here is pure except `createOpportunityFromQuote`, which writes to
 * the opportunities store. Money is always rolled up in MGA so pipeline
 * figures line up with the rest of the app.
 */
import {
  opportunitiesStore, toMGA, stageProbability,
  type Opportunity, type Quote, type Invoice, type Stage,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { invoicePayable, invoiceBalance } from "@/lib/invoice-money";

/** Quote value incl. tax, in its own currency. */
export const quotePayable = (q: Quote) =>
  Number(q.totalAmount) > 0 ? Number(q.totalAmount) : (Number(q.amount) || 0) + (Number(q.taxAmount) || 0);

/** Quotes that still represent potential revenue (rejected/expired do not). */
export const isLiveQuote = (q: Quote) => q.status !== "rejected" && q.status !== "expired";

export const OPEN_STAGES: Stage[] = ["Lead", "Qualified", "Proposal", "Negotiation", "In progress"];
export const isOpenStage = (s: Stage) => s !== "Closed" && s !== "Lost";

export interface OpportunityRollup {
  /** Sum of live quotations, MGA. */
  quoted: number;
  /** Sum of non-cancelled invoices (incl. tax), MGA. */
  invoiced: number;
  /** Cash actually received, MGA. */
  collected: number;
  /** Invoiced but not yet paid, MGA. */
  outstanding: number;
  /** Forecast value of the deal (weighted by probability), MGA. */
  forecast: number;
  /** Forecast still to be invoiced, MGA (never negative). */
  remaining: number;
  quotes: Quote[];
  invoices: Invoice[];
}

export const emptyRollup = (): OpportunityRollup => ({
  quoted: 0, invoiced: 0, collected: 0, outstanding: 0, forecast: 0, remaining: 0, quotes: [], invoices: [],
});

export function opportunityForecast(o: Opportunity): number {
  const p = o.probability !== undefined ? o.probability / 100 : stageProbability[o.stage];
  return toMGA(o.value, o.currency) * p;
}

/** Documents attached to one opportunity, summed in MGA. */
export function rollupOpportunity(o: Opportunity, quotes: Quote[], invoices: Invoice[]): OpportunityRollup {
  const qs = quotes.filter((q) => q.opportunityId === o.id);
  const invs = invoices.filter((i) => i.opportunityId === o.id && i.status !== "cancelled");
  const quoted = qs.filter(isLiveQuote).reduce((s, q) => s + toMGA(quotePayable(q), q.currency), 0);
  const invoiced = invs.reduce((s, i) => s + toMGA(invoicePayable(i), i.currency), 0);
  const outstanding = invs.reduce((s, i) => s + toMGA(invoiceBalance(i), i.currency), 0);
  const collected = Math.max(0, invoiced - outstanding);
  const forecast = opportunityForecast(o);
  return {
    quoted, invoiced, collected, outstanding, forecast,
    remaining: Math.max(0, toMGA(o.value, o.currency) - invoiced),
    quotes: qs, invoices: invs,
  };
}

/** Roll-ups for a whole list, computed in one pass. */
export function buildRollups(opportunities: Opportunity[], quotes: Quote[], invoices: Invoice[]) {
  const byOppQuotes = new Map<string, Quote[]>();
  const byOppInvoices = new Map<string, Invoice[]>();
  for (const q of quotes) {
    if (!q.opportunityId) continue;
    (byOppQuotes.get(q.opportunityId) ?? byOppQuotes.set(q.opportunityId, []).get(q.opportunityId)!).push(q);
  }
  for (const i of invoices) {
    if (!i.opportunityId) continue;
    (byOppInvoices.get(i.opportunityId) ?? byOppInvoices.set(i.opportunityId, []).get(i.opportunityId)!).push(i);
  }
  const map = new Map<string, OpportunityRollup>();
  for (const o of opportunities) {
    map.set(o.id, rollupOpportunity(o, byOppQuotes.get(o.id) ?? [], byOppInvoices.get(o.id) ?? []));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

export interface LinkableDoc {
  companyId: string;
  clientId?: string;
  subject?: string;
  issueDate?: string;
  /** Opportunity already known from a source document (quote / PO). */
  opportunityId?: string;
}

const norm = (s?: string) => (s ?? "").toLowerCase().trim();

function score(doc: LinkableDoc, o: Opportunity): number {
  let s = 0;
  if (o.clientId && doc.clientId && o.clientId === doc.clientId) s += 5;
  if (isOpenStage(o.stage)) s += 3;
  if (o.stage === "Proposal" || o.stage === "Negotiation") s += 1;
  const subj = norm(doc.subject);
  const name = norm(o.name);
  if (subj && name && (subj.includes(name) || name.includes(subj))) s += 2;
  if (doc.issueDate && o.expectedClose) {
    const days = Math.abs(
      (new Date(o.expectedClose).getTime() - new Date(doc.issueDate).getTime()) / 86_400_000,
    );
    if (days <= 90) s += 1;
  }
  return s;
}

/**
 * Ranks the opportunities that could own this document.
 * `auto` is set when a single open deal for the same client stands out — the
 * caller may then link it without asking.
 */
export function suggestOpportunity(doc: LinkableDoc, opportunities: Opportunity[]) {
  const sameClient = opportunities.filter(
    (o) => o.companyId === doc.companyId && !!doc.clientId && o.clientId === doc.clientId,
  );
  const ranked = [...sameClient].sort((a, b) => score(doc, b) - score(doc, a));
  const open = ranked.filter((o) => isOpenStage(o.stage));
  return {
    candidates: ranked,
    best: ranked[0],
    /** Unambiguous: exactly one open deal for this client. */
    auto: open.length === 1 ? open[0] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/** Creates (and stores) a pipeline deal derived from a quotation. */
export function createOpportunityFromQuote(
  quote: Pick<Quote, "companyId" | "clientId" | "subject" | "number" | "currency" | "issueDate" | "validUntil"> & {
    amount?: number; totalAmount?: number; taxAmount?: number;
  },
  clientName: string,
): Opportunity {
  const value = quotePayable(quote as Quote);
  const opp: Opportunity = {
    id: newId("opp"),
    companyId: quote.companyId,
    name: quote.subject?.trim() || `${clientName || "New deal"} · ${quote.number}`,
    client: clientName,
    clientId: quote.clientId || undefined,
    stage: "Proposal",
    value,
    currency: quote.currency,
    expectedClose: quote.validUntil || quote.issueDate || new Date().toISOString().slice(0, 10),
  };
  opportunitiesStore.add(opp);
  return opp;
}

/**
 * Called when a quotation is saved: returns the opportunity id the quote
 * should carry. Links the obvious match, otherwise creates a new deal so no
 * quotation lives outside the pipeline.
 */
export function ensureOpportunityForQuote(
  quote: Quote,
  opportunities: Opportunity[],
  clientName: string,
): { opportunityId: string; created: boolean; opportunity: Opportunity } {
  if (quote.opportunityId) {
    const existing = opportunities.find((o) => o.id === quote.opportunityId);
    if (existing) return { opportunityId: existing.id, created: false, opportunity: existing };
  }
  const { auto } = suggestOpportunity(quote, opportunities);
  if (auto) return { opportunityId: auto.id, created: false, opportunity: auto };
  const created = createOpportunityFromQuote(quote, clientName);
  return { opportunityId: created.id, created: true, opportunity: created };
}
