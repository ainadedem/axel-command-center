/**
 * Audit trail for payment verification.
 *
 * Every review decision — accepted match, rejected proposal, removed link —
 * is appended to the shared document history, so an invoice can always answer
 * "who confirmed this payment, when, and on what evidence?".
 */
import { useMemo } from "react";
import {
  logActivity,
  useDocumentActivity,
  type ActivityEntry,
} from "@/lib/document-activity";

export type MatchSource = "manual" | "auto" | "transaction";

export interface MatchedFields {
  transactionId: string;
  transactionDate: string;
  transactionAmount: number;
  transactionCurrency: string;
  transactionDescription: string;
  /** Human-readable reasons produced by the scoring engine. */
  reasons: string[];
  confidence: string;
  score: number;
  amountDelta: number;
  dayGap: number;
  targetAmount: number;
  quoteLinked?: string | null;
  poLinked?: string | null;
}

interface DocRef {
  invoiceId: string;
  invoiceNumber?: string;
  companyId: string;
}

/** Records an accepted match with the full evidence payload. */
export function logPaymentVerified(doc: DocRef, fields: MatchedFields, source: MatchSource) {
  void logActivity({
    docType: "invoice",
    docId: doc.invoiceId,
    docNumber: doc.invoiceNumber,
    companyId: doc.companyId,
    action: "payment_verified",
    summary: `Payment matched to bank transaction ${fields.transactionDate} · ${Math.round(
      fields.transactionAmount,
    ).toLocaleString()} ${fields.transactionCurrency}`,
    details: { ...fields, source },
  });
}

/** Records that a proposal was reviewed but not accepted. */
export function logPaymentReviewed(
  doc: DocRef,
  info: { candidates: number; bestConfidence?: string; bestTransactionId?: string },
) {
  void logActivity({
    docType: "invoice",
    docId: doc.invoiceId,
    docNumber: doc.invoiceNumber,
    companyId: doc.companyId,
    action: "payment_reviewed",
    summary:
      info.candidates > 0
        ? `Reviewed ${info.candidates} candidate${info.candidates > 1 ? "s" : ""} — no match accepted`
        : "Reviewed — no candidate bank transaction found",
    details: { ...info, outcome: "rejected" },
  });
}

/** Records an undo / manual removal of a payment link (reversal entry). */
export function logPaymentUnlinked(
  doc: DocRef,
  info: {
    transactionId: string;
    transactionDate?: string;
    transactionAmount?: number;
    transactionCurrency?: string;
    reason: string;
    source?: "manual" | "undo";
  },
) {
  const what =
    info.transactionDate && info.transactionAmount != null
      ? ` (${info.transactionDate} · ${Math.round(info.transactionAmount).toLocaleString()} ${
          info.transactionCurrency ?? ""
        })`.trimEnd()
      : "";
  void logActivity({
    docType: "invoice",
    docId: doc.invoiceId,
    docNumber: doc.invoiceNumber,
    companyId: doc.companyId,
    action: "payment_unlinked",
    summary: `Payment link removed${what} — ${info.reason}`,
    details: { ...info, source: info.source ?? "manual" },
  });
}

const VERIFICATION_ACTIONS = new Set(["payment_verified", "payment_reviewed", "payment_unlinked"]);

/** History of verification decisions for one invoice, newest first. */
export function usePaymentAudit(invoiceId?: string): {
  entries: ActivityEntry[];
  loading: boolean;
} {
  const { entries, loading } = useDocumentActivity("invoice", invoiceId);
  const filtered = useMemo(
    () => entries.filter((e) => VERIFICATION_ACTIONS.has(e.action)),
    [entries],
  );
  return { entries: filtered, loading };
}

/** Compact one-line description of what the matcher compared. */
export function describeMatchedFields(details: Record<string, unknown>): string {
  const parts: string[] = [];
  const reasons = details.reasons;
  if (Array.isArray(reasons) && reasons.length) parts.push(reasons.join(" · "));
  if (typeof details.confidence === "string") parts.push(`${details.confidence} confidence`);
  if (typeof details.score === "number") parts.push(`score ${Math.round(details.score)}`);
  if (typeof details.dayGap === "number" && details.dayGap < 900) parts.push(`${details.dayGap}d gap`);
  if (typeof details.source === "string") parts.push(String(details.source));
  return parts.join(" · ");
}
