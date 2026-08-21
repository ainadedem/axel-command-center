import { toast } from "sonner";
import { quotesStore, invoicesStore, type Quote, type QuoteStatus } from "@/lib/mock-data";
import { logActivity } from "@/lib/document-activity";
import { proposeStageChange } from "@/lib/pipeline-automation";
import { docDeepLink } from "@/hooks/use-focus-row";
import { notify } from "@/lib/notifications";
import { withoutHistory } from "@/lib/history";
import { confirmStatusChanges, conflictMessage, statusLabel } from "@/lib/status-guard";

/** Statuses a quotation can be moved to from a list, board or detail panel. */
export const QUOTE_STATUS_OPTIONS: QuoteStatus[] = [
  "draft", "sent", "accepted", "rejected", "expired", "cancelled",
];

/** Cancelling always needs a written reason — the audit trail keeps it. */
export const quoteNeedsReason = (next: QuoteStatus) => next === "cancelled";

/**
 * Single entry point for quotation status changes outside the editor.
 *
 * The store is written optimistically so the UI reacts instantly, then the
 * change is confirmed server-side: if somebody else moved the quotation first
 * the write is refused and the row snaps back to the value that won.
 */
export function applyQuoteStatus(
  quote: Quote,
  next: QuoteStatus,
  opts: { userId?: string; silent?: boolean; reason?: string; onConflict?: (currentStatus: string) => void } = {},
): { revert: () => void } {
  const previous = quote.status;
  const previousUpdatedAt = quote.updatedAt;
  const now = new Date().toISOString();

  const revert = () => {
    withoutHistory(() => {
      quotesStore.update(quote.id, {
        status: previous,
        updatedBy: opts.userId,
        updatedAt: now,
        cancelledAt: quote.cancelledAt,
        cancellationReason: quote.cancellationReason,
      });
    });
    void confirmStatusChanges("quote", [
      { id: quote.id, expectedStatus: next, next: previous, reason: quote.cancellationReason ?? null },
    ]);
    void logActivity({
      docType: "quote", docId: quote.id, docNumber: quote.number, companyId: quote.companyId,
      action: "status_changed", summary: `Reverted from ${next} to ${previous}`,
      details: { from: next, to: previous, reverted: true },
    });
  };

  if (previous === next) return { revert: () => {} };
  if (quoteNeedsReason(next) && !opts.reason?.trim()) {
    toast.error(`${quote.number} needs a cancellation reason.`);
    return { revert: () => {} };
  }

  const reason = opts.reason?.trim();
  quotesStore.update(quote.id, {
    status: next,
    updatedBy: opts.userId,
    updatedAt: now,
    ...(next === "cancelled"
      ? { cancelledAt: now, cancellationReason: reason }
      : { cancelledAt: undefined, cancellationReason: undefined }),
  });

  void logActivity({
    docType: "quote", docId: quote.id, docNumber: quote.number, companyId: quote.companyId,
    action: "status_changed", summary: `From ${previous} to ${next}${reason ? ` — ${reason}` : ""}`,
    details: { from: previous, to: next, reason: reason ?? null },
  });
  notify({
    kind: "status_change", companyId: quote.companyId, docType: "quote", docId: quote.id, docNumber: quote.number,
    title: `${quote.number} is now ${next}`, body: `Status changed from ${previous} to ${next}.`,
    href: docDeepLink("/quotations", quote.id), recipients: quote.assignedTo ?? [], amount: quote.amount,
  });

  // Confirm against the database; roll back whatever the server refuses.
  void confirmStatusChanges("quote", [
    { id: quote.id, expectedStatus: previous, expectedUpdatedAt: previousUpdatedAt ?? null, next, reason: reason ?? null },
  ]).then(([res]) => {
    if (!res || res.state === "ok" || res.state === "skipped") return;
    const winning = res.current?.status ?? previous;
    withoutHistory(() => {
      quotesStore.update(quote.id, {
        status: winning as QuoteStatus,
        updatedAt: res.current?.updatedAt ?? previousUpdatedAt,
        cancelledAt: quote.cancelledAt,
        cancellationReason: quote.cancellationReason,
      });
    });
    if (res.state === "conflict") {
      toast.error(conflictMessage(quote.number, res), {
        description: `Your change to ${statusLabel(next)} was not applied.`,
        action: { label: "Retry", onClick: () => {
          const fresh = quotesStore.items.find((q) => q.id === quote.id);
          if (fresh) applyQuoteStatus(fresh, next, opts);
        } },
      });
    } else if (res.state === "denied" || res.state === "missing") {
      toast.error(`You do not have permission to change ${quote.number}.`);
    } else {
      toast.error(`Could not save ${quote.number}`, { description: res.message });
    }
    opts.onConflict?.(winning);
  });

  const event =
    next === "sent" ? "quote_sent"
    : next === "accepted" ? "quote_accepted"
    : next === "rejected" || next === "cancelled" ? "quote_rejected"
    : null;
  if (event && quote.opportunityId) {
    const oppId = quote.opportunityId;
    const hasInvoice = invoicesStore.items.some((i) => i.opportunityId === oppId && i.status !== "cancelled");
    const hasOtherOpenQuote = quotesStore.items.some(
      (q) => q.opportunityId === oppId && q.id !== quote.id
        && q.status !== "rejected" && q.status !== "expired" && q.status !== "cancelled",
    );
    proposeStageChange(oppId, event, { hasInvoice, hasOtherOpenQuote },
      { docType: "quote", docId: quote.id, docNumber: quote.number });
  }

  if (!opts.silent) {
    toast.success(`${quote.number} → ${statusLabel(next)}`, { action: { label: "Undo", onClick: revert } });
  }
  return { revert };
}
