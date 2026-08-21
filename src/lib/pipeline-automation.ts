/**
 * Stage automation: document events (quote sent, invoice paid, …) suggest a
 * pipeline stage move, which the user confirms from a toast. Refusals are
 * remembered per deal + event so the same suggestion is not repeated.
 */
import { toast } from "sonner";
import { opportunitiesStore, type Opportunity, type Stage } from "@/lib/mock-data";
import { logActivity, type DocType } from "@/lib/document-activity";
import { isOpenStage } from "@/lib/pipeline-link";

export type PipelineEvent =
  | "quote_sent"
  | "quote_accepted"
  | "quote_rejected"
  | "invoice_issued"
  | "invoice_paid";

const ORDER: Stage[] = ["Lead", "Qualified", "Proposal", "Negotiation", "In progress", "Closed"];
const rank = (s: Stage) => (s === "Lost" ? -1 : ORDER.indexOf(s));

/** Stage a document event implies, or null when nothing should move. */
export function suggestedStage(
  event: PipelineEvent,
  opp: Opportunity,
  ctx: { hasInvoice?: boolean; allInvoicesPaid?: boolean; hasOtherOpenQuote?: boolean } = {},
): Stage | null {
  let target: Stage | null = null;
  switch (event) {
    case "quote_sent": target = "Proposal"; break;
    case "quote_accepted": target = ctx.hasInvoice ? "In progress" : "Negotiation"; break;
    case "invoice_issued": target = "In progress"; break;
    case "invoice_paid": target = ctx.allInvoicesPaid ? "Closed" : "In progress"; break;
    case "quote_rejected": target = ctx.hasOtherOpenQuote ? null : "Lost"; break;
  }
  if (!target || target === opp.stage) return null;
  // Never walk a deal backwards, and never touch a closed/lost deal
  // automatically (except an explicit rejection → Lost).
  if (!isOpenStage(opp.stage) && !(event === "quote_rejected" && target === "Lost")) return null;
  if (target !== "Lost" && rank(target) <= rank(opp.stage)) return null;
  return target;
}

/* ── "don't ask again" memory ─────────────────────────────────────── */

const KEY = "axel.pipeline.stage-suppress";
const readSuppressed = (): Record<string, true> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
};
const suppressKey = (oppId: string, event: PipelineEvent) => `${oppId}::${event}`;

export function isSuppressed(oppId: string, event: PipelineEvent) {
  return !!readSuppressed()[suppressKey(oppId, event)];
}
export function suppress(oppId: string, event: PipelineEvent) {
  try {
    const all = readSuppressed();
    all[suppressKey(oppId, event)] = true;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage unavailable — non-fatal */ }
}

/* ── confirmation flow ────────────────────────────────────────────── */

export function applyStage(opp: Opportunity, next: Stage, source?: { docType: DocType; docId: string; docNumber?: string }) {
  const before = opp.stage;
  opportunitiesStore.update(opp.id, { stage: next });
  if (source) {
    logActivity({
      docType: source.docType,
      docId: source.docId,
      docNumber: source.docNumber,
      companyId: opp.companyId,
      action: "status_changed",
      summary: `Pipeline stage ${before} → ${next} (${opp.name})`,
      details: { opportunityId: opp.id, opportunity: opp.name, stageBefore: before, stageAfter: next },
    });
  }
}

/**
 * Asks (via toast) whether the deal should advance. Returns true when a
 * suggestion was shown.
 */
export function proposeStageChange(
  opportunityId: string | undefined,
  event: PipelineEvent,
  ctx: { hasInvoice?: boolean; allInvoicesPaid?: boolean; hasOtherOpenQuote?: boolean } = {},
  source?: { docType: DocType; docId: string; docNumber?: string },
): boolean {
  if (!opportunityId) return false;
  const opp = opportunitiesStore.items.find((o) => o.id === opportunityId);
  if (!opp) return false;
  if (isSuppressed(opp.id, event)) return false;
  const next = suggestedStage(event, opp, ctx);
  if (!next) return false;

  toast(`Move “${opp.name}” to ${next}?`, {
    description: `Currently ${opp.stage} in the pipeline.`,
    duration: 15000,
    action: {
      label: `Move to ${next}`,
      onClick: () => {
        applyStage(opp, next, source);
        toast.success(`${opp.name} → ${next}`);
      },
    },
    cancel: {
      label: "Don't ask",
      onClick: () => suppress(opp.id, event),
    },
  });
  return true;
}
