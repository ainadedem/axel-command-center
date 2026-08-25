import { useState } from "react";
import { toast } from "sonner";
import { CancelReasonDialog } from "@/components/cancel-reason-dialog";
import { applyQuoteStatus, quoteNeedsReason } from "@/lib/quote-status";
import { useAuth } from "@/lib/auth-context";
import type { Quote, QuoteStatus } from "@/lib/mock-data";

/**
 * One-click quotation status changes with the cancellation reason gate.
 *
 * Both the list and the board use this so a status move never opens the full
 * editor, while cancelling still collects (and stores) a reason.
 */
export function useQuoteStatusRequest(
  canWrite: (q: Quote) => boolean,
  opts: { onAccept?: (q: Quote) => void } = {},
) {
  const { user } = useAuth();
  const [cancelling, setCancelling] = useState<Quote | null>(null);

  const request = (quote: Quote, next: QuoteStatus, after?: (q: Quote, next: QuoteStatus) => void) => {
    if (!canWrite(quote)) { toast.error(`You do not have permission to change ${quote.number}.`); return; }
    if (quoteNeedsReason(next)) { setCancelling(quote); return; }
    // Accepting a quotation also creates the PO and the invoice — confirm first.
    if (next === "accepted" && opts.onAccept) {
      opts.onAccept(quote);
      after?.(quote, next);
      return;
    }
    applyQuoteStatus(quote, next, { userId: user?.id });
    after?.(quote, next);
  };


  const dialog = (
    <CancelReasonDialog
      open={!!cancelling}
      onOpenChange={(v) => { if (!v) setCancelling(null); }}
      title={`Cancel ${cancelling?.number ?? "quotation"}`}
      description="The reason is stored on the quotation and in its audit trail."
      confirmLabel="Cancel quotation"
      onConfirm={(reason) => {
        if (cancelling) applyQuoteStatus(cancelling, "cancelled", { userId: user?.id, reason });
        setCancelling(null);
      }}
    />
  );

  return { request, dialog };
}
