/**
 * Turning an inferred (number-matched) link into a permanent stored link.
 * Writes the real id on the document, logs the activity on both sides and
 * offers an undo through the shared toast.
 */
import { toast } from "sonner";
import { withoutHistory } from "@/lib/history";
import { logActivity } from "@/lib/document-activity";
import { invoicesStore, purchaseOrdersStore, type Invoice, type PurchaseOrder } from "@/lib/mock-data";
import type { BackfillCandidate } from "@/lib/doc-number-link";

const docTypeOf = (kind: BackfillCandidate["kind"]) => (kind === "po-quote" ? "po" : "invoice") as "po" | "invoice";

function apply(c: BackfillCandidate, value: string | undefined) {
  void withoutHistory(() => {
    if (c.kind === "invoice-quote") invoicesStore.update(c.targetId, { quoteId: value } as Partial<Invoice>);
    else if (c.kind === "invoice-po") invoicesStore.update(c.targetId, { poId: value } as Partial<Invoice>);
    else purchaseOrdersStore.update(c.targetId, { quoteId: value } as Partial<PurchaseOrder>);
  });
}

/** Confirms one inferred link. `companyId` is the local company of the target. */
export function confirmLink(c: BackfillCandidate, companyId: string, opts?: { silent?: boolean }) {
  apply(c, c.linkId);
  void logActivity({
    docType: docTypeOf(c.kind),
    docId: c.targetId,
    docNumber: c.targetNumber,
    companyId,
    action: "updated",
    summary: `Linked to ${c.linkNumber} (matched by document number)`,
    details: { link: c.kind, linkNumber: c.linkNumber, linkId: c.linkId, matchedBy: "number" },
  });
  if (opts?.silent) return;
  toast.success(`${c.targetNumber} linked to ${c.linkNumber}`, {
    duration: 8000,
    action: { label: "Undo", onClick: () => apply(c, undefined) },
  });
}

/** Confirms a whole batch (backfill review). One toast, one undo for all. */
export function confirmLinks(list: { candidate: BackfillCandidate; companyId: string }[]) {
  if (!list.length) return;
  list.forEach(({ candidate, companyId }) => confirmLink(candidate, companyId, { silent: true }));
  toast.success(`${list.length} document${list.length > 1 ? "s" : ""} linked by number`, {
    duration: 10000,
    action: {
      label: "Undo",
      onClick: () => list.forEach(({ candidate }) => apply(candidate, undefined)),
    },
  });
}
