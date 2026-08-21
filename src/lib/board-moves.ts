import { logActivity, type DocType } from "@/lib/document-activity";

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
}
