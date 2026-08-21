import { toast } from "sonner";
import { quotesStore, invoicesStore, type Quote, type QuoteStatus } from "@/lib/mock-data";
import { logActivity } from "@/lib/document-activity";
import { proposeStageChange } from "@/lib/pipeline-automation";

/** Statuses a quotation can be moved to from a list, board or detail panel. */
export const QUOTE_STATUS_OPTIONS: QuoteStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];

/**
 * Single entry point for quotation status changes outside the editor.
 *
 * Writes the new status optimistically, records the audit trail entry and
 * lets the pipeline suggest a matching stage move — exactly what the edit
 * dialog does, minus the full-document re-save.
 */
export function applyQuoteStatus(
  quote: Quote,
  next: QuoteStatus,
  opts: { userId?: string; silent?: boolean } = {},
): { revert: () => void } {
  const previous = quote.status;
  const revert = () => {
    quotesStore.update(quote.id, { status: previous, updatedBy: opts.userId, updatedAt: new Date().toISOString() });
    void logActivity({
      docType: "quote", docId: quote.id, docNumber: quote.number, companyId: quote.companyId,
      action: "status_changed", summary: `Reverted from ${next} to ${previous}`,
      details: { from: next, to: previous, reverted: true },
    });
  };

  if (previous === next) return { revert: () => {} };

  quotesStore.update(quote.id, { status: next, updatedBy: opts.userId, updatedAt: new Date().toISOString() });
  void logActivity({
    docType: "quote", docId: quote.id, docNumber: quote.number, companyId: quote.companyId,
    action: "status_changed", summary: `From ${previous} to ${next}`,
    details: { from: previous, to: next },
  });

  const event =
    next === "sent" ? "quote_sent"
    : next === "accepted" ? "quote_accepted"
    : next === "rejected" ? "quote_rejected"
    : null;
  if (event && quote.opportunityId) {
    const oppId = quote.opportunityId;
    const hasInvoice = invoicesStore.items.some((i) => i.opportunityId === oppId && i.status !== "cancelled");
    const hasOtherOpenQuote = quotesStore.items.some(
      (q) => q.opportunityId === oppId && q.id !== quote.id && q.status !== "rejected" && q.status !== "expired",
    );
    proposeStageChange(oppId, event, { hasInvoice, hasOtherOpenQuote },
      { docType: "quote", docId: quote.id, docNumber: quote.number });
  }

  if (!opts.silent) {
    toast.success(`${quote.number} → ${next}`, { action: { label: "Undo", onClick: revert } });
  }
  return { revert };
}
