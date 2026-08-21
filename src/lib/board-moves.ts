import { logActivity, type DocType } from "@/lib/document-activity";
import { notify } from "@/lib/notifications";
import { docDeepLink } from "@/hooks/use-focus-row";

/** Notified whenever a board move is recorded, so open history panels refresh. */
export const boardMoveListeners = new Set<() => void>();

/**
 * Records a Kanban column move — successful or blocked — on the document's
 * audit trail. Blocked attempts are kept so the history explains the gaps.
 */
export function logBoardMove(input: {
  docType: DocType;
  docId: string;
  docNumber?: string;
  companyId: string;
  from: string;
  to: string;
  blocked?: boolean;
  reason?: string;
}) {
  const summary = input.blocked
    ? `Board move ${input.from} → ${input.to} blocked${input.reason ? `: ${input.reason}` : ""}`
    : `Moved on the board from ${input.from} to ${input.to}`;
  void logActivity({
    docType: input.docType,
    docId: input.docId,
    docNumber: input.docNumber,
    companyId: input.companyId,
    action: "status_changed",
    summary,
    details: { from: input.from, to: input.to, blocked: !!input.blocked, reason: input.reason, source: "kanban" },
  }).then(() => boardMoveListeners.forEach((l) => l()));

  if (!input.blocked) {
    notify({
      kind: "board_move",
      companyId: input.companyId,
      docType: input.docType === "quote" ? "quote" : input.docType === "invoice" ? "invoice" : "po",
      docId: input.docId,
      docNumber: input.docNumber,
      title: `${input.docNumber ?? "Document"} moved to ${input.to}`,
      body: `Moved from ${input.from} to ${input.to} on the board.`,
      href: docDeepLink(
        input.docType === "quote" ? "/quotations" : input.docType === "invoice" ? "/invoices" : "/purchase-orders",
        input.docId,
        "board",
      ),

    });
  }
}
