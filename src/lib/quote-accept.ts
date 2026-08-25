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
import { invoicesStore, purchaseOrdersStore, teamMembersStore } from "@/lib/mock-data";
import { nextNumber } from "@/lib/numbering";
import { logActivity } from "@/lib/document-activity";
import { notify } from "@/lib/notifications";
import { docDeepLink } from "@/hooks/use-focus-row";
import { invoicesByNumberForQuote, type LinkSource } from "@/lib/doc-number-link";
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
  /** How the invoices were found: a stored link or a document-number match. */
  source: LinkSource;
}

/**
 * Invoices that descend from a quote: direct link first, then the opportunity,
 * then a document-number match found in the documents' own text.
 */
export function invoicesForQuote(q: Quote, invoices: Invoice[]): Invoice[] {
  return invoicesForQuoteWithSource(q, invoices).invoices;
}

/** Same as {@link invoicesForQuote} but says which tier resolved the link. */
export function invoicesForQuoteWithSource(q: Quote, invoices: Invoice[]): { invoices: Invoice[]; source: LinkSource } {
  const direct = invoices.filter((i) => i.quoteId === q.id && i.status !== "cancelled");
  if (direct.length) return { invoices: direct, source: "stored" };
  if (q.opportunityId) {
    const byOpp = invoices.filter((i) => i.opportunityId === q.opportunityId && i.status !== "cancelled");
    if (byOpp.length) return { invoices: byOpp, source: "stored" };
  }
  const byNumber = invoicesByNumberForQuote(q, invoices);
  return { invoices: byNumber, source: byNumber.length ? "number" : "stored" };
}

/** Whether an accepted quote has actually been invoiced, and by how much. */
export function quoteInvoiceLink(q: Quote, invoices: Invoice[]): QuoteInvoiceLink {
  const { invoices: rows, source } = invoicesForQuoteWithSource(q, invoices);
  const invoiced = rows.reduce((s, i) => s + invoicePayable(i), 0);
  const quoted = quotePayable(q);
  const state: QuoteInvoiceState =
    rows.length === 0 ? "not-invoiced"
    : invoiced + 1 >= quoted ? "invoiced"
    : "partial";
  return { state, invoices: rows, invoiced, quoted, source };
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

  return {
    poId: o.makePo ? poId : undefined,
    invoiceId, created, poNumber, invoiceNumber,
    reusedPo: !o.makePo && !!o.existingPoId,
    termsDays,
  };
}

// ---------------------------------------------------------------------------
// Audit trail + notifications for the acceptance automation
// ---------------------------------------------------------------------------

/** Auth users who should hear about an acceptance: assignees + the author. */
export function acceptanceRecipients(quote: Quote): string[] {
  const ids = new Set<string>();
  for (const a of quote.assignedTo ?? []) if (a) ids.add(a);
  if (quote.createdBy) ids.add(quote.createdBy);
  // Team members linked to an app user and assigned to the quotation.
  for (const m of teamMembersStore.items) {
    if (!m.userId) continue;
    if ((quote.assignedTo ?? []).includes(m.id) || (quote.assignedTo ?? []).includes(m.userId)) ids.add(m.userId);
  }
  return [...ids];
}

const docList = (r: AcceptanceResult) => r.created.join(" and ");

/**
 * Records the acceptance itself on the quotation and tells the people involved
 * which documents the automation produced, with links straight to each one.
 */
export function recordAcceptance(o: {
  quote: Quote;
  client?: Client;
  result: AcceptanceResult;
}) {
  const { quote: q, result } = o;
  const clientName = o.client?.displayName || o.client?.name;
  const total = q.totalAmount ?? q.amount + (q.taxAmount ?? 0);

  void logActivity({
    docType: "quote", docId: q.id, docNumber: q.number, companyId: q.companyId,
    action: "accepted",
    summary: result.created.length
      ? `Accepted — ${docList(result)} created as drafts`
      : "Accepted — no documents created",
    details: {
      source: "quote_acceptance",
      poId: result.poId, poNumber: result.poNumber,
      invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber,
      reusedExistingPo: result.reusedPo,
      termsDays: result.termsDays,
      amount: q.amount, total, currency: q.currency,
      client: clientName,
    },
  });

  if (result.created.length === 0) return;

  const links: string[] = [
    `Quotation: ${docDeepLink("/quotations", q.id)}`,
    result.poId ? `Purchase order: ${docDeepLink("/purchase-orders", result.poId)}` : "",
    result.invoiceId ? `Invoice: ${docDeepLink("/invoices", result.invoiceId)}` : "",
  ].filter(Boolean);

  notify({
    kind: "quote_auto_documents",
    companyId: q.companyId,
    docType: "invoice",
    docId: result.invoiceId ?? result.poId ?? q.id,
    docNumber: result.invoiceNumber ?? result.poNumber ?? q.number,
    title: `${q.number} accepted — ${docList(result)} created as drafts`,
    body: [
      clientName ? `Client ${clientName}` : null,
      `Payable total ${total.toLocaleString()} ${q.currency}`,
      result.invoiceNumber ? `Invoice due in ${result.termsDays} days — review and send it.` : null,
      links.join(" · "),
    ].filter(Boolean).join(" · "),
    href: docDeepLink("/invoices", result.invoiceId) ,
    recipients: acceptanceRecipients(q),
    amount: total,
  });
}

/** Audit + notification for rolling the acceptance back inside the undo window. */
export function recordAcceptanceUndone(o: { quote: Quote; result: AcceptanceResult }) {
  const { quote: q, result } = o;
  const removed = result.created.length ? docList(result) : "no documents";
  void logActivity({
    docType: "quote", docId: q.id, docNumber: q.number, companyId: q.companyId,
    action: "acceptance_undone",
    summary: `Acceptance undone — ${removed} removed, quotation back to ${q.status}`,
    details: {
      source: "quote_acceptance",
      removedPoId: result.poId, removedPoNumber: result.poNumber,
      removedInvoiceId: result.invoiceId, removedInvoiceNumber: result.invoiceNumber,
    },
  });
  if (result.poId) {
    void logActivity({
      docType: "po", docId: result.poId, docNumber: result.poNumber, companyId: q.companyId,
      action: "acceptance_undone", summary: `Removed — acceptance of ${q.number} was undone`,
      details: { source: "quote_acceptance", quoteId: q.id, quoteNumber: q.number },
    });
  }
  if (result.invoiceId) {
    void logActivity({
      docType: "invoice", docId: result.invoiceId, docNumber: result.invoiceNumber, companyId: q.companyId,
      action: "acceptance_undone", summary: `Removed — acceptance of ${q.number} was undone`,
      details: { source: "quote_acceptance", quoteId: q.id, quoteNumber: q.number },
    });
  }
  if (result.created.length === 0) return;
  notify({
    kind: "quote_auto_documents",
    companyId: q.companyId,
    docType: "quote",
    docId: q.id,
    docNumber: q.number,
    title: `Acceptance of ${q.number} was undone — ${removed} removed`,
    body: `Those drafts no longer exist. Quotation: ${docDeepLink("/quotations", q.id)}`,
    href: docDeepLink("/quotations", q.id),
    recipients: acceptanceRecipients(q),
  });
}

/** Audit + notification when an undone acceptance is applied again. */
export function recordAcceptanceRedone(o: { quote: Quote; result: AcceptanceResult }) {
  const { quote: q, result } = o;
  void logActivity({
    docType: "quote", docId: q.id, docNumber: q.number, companyId: q.companyId,
    action: "acceptance_redone",
    summary: result.created.length ? `Acceptance re-applied — ${docList(result)} re-created` : "Acceptance re-applied",
    details: {
      source: "quote_acceptance",
      poId: result.poId, poNumber: result.poNumber,
      invoiceId: result.invoiceId, invoiceNumber: result.invoiceNumber,
    },
  });
  if (result.created.length === 0) return;
  notify({
    kind: "quote_auto_documents",
    companyId: q.companyId,
    docType: "invoice",
    docId: result.invoiceId ?? q.id,
    docNumber: result.invoiceNumber ?? q.number,
    title: `${q.number} accepted again — ${docList(result)} re-created`,
    body: `Invoice: ${docDeepLink("/invoices", result.invoiceId)} · Quotation: ${docDeepLink("/quotations", q.id)}`,
    href: docDeepLink("/invoices", result.invoiceId),
    recipients: acceptanceRecipients(q),
  });
}
