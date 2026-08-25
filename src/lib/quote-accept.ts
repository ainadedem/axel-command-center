/**
 * Accepting a quotation → purchase order + invoice.
 *
 * Pure builders (no store writes) so the confirmation dialog can preview
 * exactly what will be created, plus the small "was this quote invoiced?"
 * resolver used by the smart link chips on both documents.
 */
import { addDays } from "date-fns";
import { newId } from "@/lib/data-store";
import { effectiveTermsDays } from "@/lib/payment-proof";
import { invoicePayable } from "@/lib/invoice-money";
import { quotePayable } from "@/lib/pipeline-link";
import { invoicesStore, purchaseOrdersStore } from "@/lib/mock-data";
import { nextNumber } from "@/lib/numbering";
import { logActivity } from "@/lib/document-activity";
import type { Client, Invoice, PurchaseOrder, Quote, QuoteLine } from "@/lib/mock-data";

const today = () => new Date().toISOString().slice(0, 10);
const copyLines = (lines?: QuoteLine[]) => (lines ? lines.map((l) => ({ ...l, id: newId("ql") })) : undefined);

export interface AcceptDraftOptions {
  quote: Quote;
  client?: Client;
  poNumber: string;
  invoiceNumber: string;
  userId?: string;
}

/** Draft PO mirroring the accepted quotation. */
export function buildPoFromQuote(o: Omit<AcceptDraftOptions, "invoiceNumber">): PurchaseOrder {
  const { quote: q } = o;
  return {
    id: newId("po"),
    number: o.poNumber,
    companyId: q.companyId,
    clientId: q.clientId,
    projectId: q.projectId,
    quoteId: q.id,
    issueDate: today(),
    amount: q.amount,
    currency: q.currency,
    status: "draft",
    lines: copyLines(q.lines),
    subject: q.subject,
    bankAccountId: q.bankAccountId,
  };
}

/** Draft invoice mirroring the accepted quotation (and its new PO, if any). */
export function buildInvoiceFromQuote(
  o: Omit<AcceptDraftOptions, "poNumber"> & { poId?: string },
): Invoice {
  const { quote: q } = o;
  const terms = effectiveTermsDays(o.client, q.currency) ?? 30;
  const issueDate = today();
  return {
    id: newId("inv"),
    number: o.invoiceNumber,
    companyId: q.companyId,
    clientId: q.clientId,
    projectId: q.projectId,
    poId: o.poId,
    quoteId: q.id,
    opportunityId: q.opportunityId,
    issueDate,
    dueDate: addDays(new Date(issueDate), terms).toISOString().slice(0, 10),
    amount: q.amount,
    paid: 0,
    currency: q.currency,
    status: "draft",
    lines: copyLines(q.lines),
    discountPct: q.discountPct,
    taxRate: q.taxRate,
    taxAmount: q.taxAmount,
    totalAmount: q.totalAmount,
    subject: q.subject,
    assignedTo: q.assignedTo,
    bankAccountId: q.bankAccountId,
    createdBy: o.userId,
    signerId: q.signerId,
  };
}

/** Payment terms (days) that will be used for the generated invoice. */
export const acceptTermsDays = (client: Client | undefined, currency?: string) =>
  effectiveTermsDays(client, currency) ?? 30;

// ---------------------------------------------------------------------------
// Smart links: quotation ↔ invoice
// ---------------------------------------------------------------------------

export type QuoteInvoiceState = "not-invoiced" | "partial" | "invoiced";

export interface QuoteInvoiceLink {
  state: QuoteInvoiceState;
  /** Non-cancelled invoices raised against the quote. */
  invoices: Invoice[];
  /** Invoiced amount (incl. tax), quote currency. */
  invoiced: number;
  /** Quote payable total, quote currency. */
  quoted: number;
}

/** Invoices that descend from a quote: direct link first, opportunity as fallback. */
export function invoicesForQuote(q: Quote, invoices: Invoice[]): Invoice[] {
  const direct = invoices.filter((i) => i.quoteId === q.id && i.status !== "cancelled");
  if (direct.length) return direct;
  if (!q.opportunityId) return [];
  return invoices.filter((i) => i.opportunityId === q.opportunityId && i.status !== "cancelled");
}

/** Whether an accepted quote has actually been invoiced, and by how much. */
export function quoteInvoiceLink(q: Quote, invoices: Invoice[]): QuoteInvoiceLink {
  const rows = invoicesForQuote(q, invoices);
  const invoiced = rows.reduce((s, i) => s + invoicePayable(i), 0);
  const quoted = quotePayable(q);
  const state: QuoteInvoiceState =
    rows.length === 0 ? "not-invoiced"
    : invoiced + 1 >= quoted ? "invoiced"
    : "partial";
  return { state, invoices: rows, invoiced, quoted };
}

/** Accepted quotations with nothing invoiced against them yet. */
export const acceptedNotInvoiced = (quotes: Quote[], invoices: Invoice[]) =>
  quotes.filter((q) => q.status === "accepted" && quoteInvoiceLink(q, invoices).state === "not-invoiced");

// ---------------------------------------------------------------------------
// Store writes
// ---------------------------------------------------------------------------

/** What one acceptance produced — everything the audit trail and Undo need. */
export interface AcceptanceResult {
  poId?: string;
  invoiceId?: string;
  /** Human labels, e.g. ["PO PO-2026-004", "Invoice INV-2026-011"]. */
  created: string[];
  poNumber?: string;
  invoiceNumber?: string;
  /** True when an existing PO was reused instead of creating a new one. */
  reusedPo: boolean;
  /** Payment terms (days) used for the generated invoice. */
  termsDays: number;
}

/**
 * Creates the requested documents from an accepted quotation and links them
 * back to it. Returns the ids so callers can offer an Undo.
 */
export function createFromAcceptedQuote(o: {
  quote: Quote;
  client?: Client;
  makePo: boolean;
  makeInvoice: boolean;
  poNumber?: string;
  invoiceNumber?: string;
  existingPoId?: string;
  userId?: string;
}): AcceptanceResult {
  const created: string[] = [];
  let poId = o.existingPoId;
  let invoiceId: string | undefined;
  let poNumber: string | undefined;
  let invoiceNumber: string | undefined;
  const termsDays = acceptTermsDays(o.client, o.quote.currency);

  if (o.makePo) {
    const po = buildPoFromQuote({
      quote: o.quote, client: o.client, userId: o.userId,
      poNumber: o.poNumber || nextNumber("po", o.quote.companyId),
    });
    purchaseOrdersStore.add(po);
    poId = po.id;
    poNumber = po.number;
    created.push(`PO ${po.number}`);
    void logActivity({
      docType: "po", docId: po.id, docNumber: po.number, companyId: po.companyId,
      action: "created", summary: `Created automatically from accepted quotation ${o.quote.number}`,
      details: { source: "quote_acceptance", quoteId: o.quote.id, quoteNumber: o.quote.number, amount: po.amount, currency: po.currency },
    });
  }

  if (o.makeInvoice) {
    const inv = buildInvoiceFromQuote({
      quote: o.quote, client: o.client, poId, userId: o.userId,
      invoiceNumber: o.invoiceNumber || nextNumber("invoice", o.quote.companyId),
    });
    invoicesStore.add(inv);
    invoiceId = inv.id;
    invoiceNumber = inv.number;
    created.push(`Invoice ${inv.number}`);
    void logActivity({
      docType: "invoice", docId: inv.id, docNumber: inv.number, companyId: inv.companyId,
      action: "created", summary: `Created automatically from accepted quotation ${o.quote.number}`,
      details: {
        source: "quote_acceptance", quoteId: o.quote.id, quoteNumber: o.quote.number,
        poId, poNumber, termsDays, dueDate: inv.dueDate, amount: inv.amount, currency: inv.currency,
      },
    });
  }

  return { poId: o.makePo ? poId : undefined, invoiceId, created };
}
