/**
 * Weekly payment approval run.
 *
 * Every Thursday one batch of outgoing payments is approved and released.
 * Requests submitted before the Wednesday 17:00 cut-off (Antananarivo,
 * UTC+3) land in that week's run; later ones roll over to the next Thursday.
 * Anything that genuinely cannot wait is flagged "off-cycle" and needs a
 * written justification.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  accountsStore, expensesStore, transactionsStore,
  paymentRequestsStore, paymentRunsStore,
  type PaymentRequest, type PaymentRequestStatus, type PaymentRun,
} from "./mock-data";
import { paymentRequestFromDb } from "./db-sync";

/** Business timezone offset used for the cut-off math (Antananarivo). */
const TZ_OFFSET_HOURS = 3;
/** Wednesday 17:00 local time. */
const CUTOFF_DAY = 3; // 0 = Sunday
const CUTOFF_HOUR = 17;

const DAY_MS = 86_400_000;

/** Current wall-clock time in the business timezone, as a UTC-shifted Date. */
function localNow(at: Date = new Date()): Date {
  return new Date(at.getTime() + TZ_OFFSET_HOURS * 3_600_000);
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** The Thursday (ISO date) that a request submitted at `at` belongs to. */
export function runDateFor(at: Date = new Date()): string {
  const local = localNow(at);
  const dow = local.getUTCDay();
  const hour = local.getUTCHours();
  // Days until the coming Thursday (4).
  let delta = (4 - dow + 7) % 7;
  if (dow === 4) delta = 7;                                  // today's run already pays out
  else if (dow === CUTOFF_DAY && hour >= CUTOFF_HOUR) delta += 7; // past Wednesday 17:00
  const target = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + delta * DAY_MS,
  );
  return isoDate(target);
}

/** The Wednesday 17:00 cut-off (UTC instant) preceding a run date. */
export function cutoffFor(runDate: string): Date {
  const [y, m, d] = runDate.split("-").map(Number);
  const thursdayLocalMidnight = Date.UTC(y, m - 1, d);
  return new Date(thursdayLocalMidnight - DAY_MS + CUTOFF_HOUR * 3_600_000 - TZ_OFFSET_HOURS * 3_600_000);
}

export function isPastCutoff(runDate: string, at: Date = new Date()): boolean {
  return at.getTime() >= cutoffFor(runDate).getTime();
}

/** Human label for a run date, e.g. "Thursday 4 Sep 2026". */
export function runLabel(runDate: string): string {
  const [y, m, d] = runDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export const STATUS_LABEL: Record<PaymentRequestStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting review",
  reviewed: "Finance reviewed",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<PaymentRequestStatus, string> = {
  draft: "bg-surface text-muted-foreground",
  submitted: "bg-warning/12 text-warning",
  reviewed: "bg-primary/12 text-primary",
  approved: "bg-success/12 text-success",
  rejected: "bg-destructive/12 text-destructive",
  paid: "bg-success/12 text-success",
  cancelled: "bg-surface text-muted-foreground/70",
};

/** Statuses still waiting on somebody. */
export const OPEN_STATUSES: PaymentRequestStatus[] = ["draft", "submitted", "reviewed", "approved"];

export const isOpen = (r: PaymentRequest) => OPEN_STATUSES.includes(r.status);

/** Plain-language description of who has the ball. */
export function nextStepFor(r: PaymentRequest): string {
  switch (r.status) {
    case "draft": return "Submit it so finance can review.";
    case "submitted": return "Waiting for the finance team to review.";
    case "reviewed": return "Waiting for final approval from an administrator.";
    case "approved": return "Approved — release the money on the run day and mark it paid.";
    case "rejected": return r.rejectionReason ? `Rejected: ${r.rejectionReason}` : "Rejected.";
    case "paid": return "Paid and closed.";
    default: return "No action needed.";
  }
}

/** Groups requests by their scheduled run date, newest run first. */
export function groupByRun(requests: PaymentRequest[]): { runDate: string; requests: PaymentRequest[] }[] {
  const map = new Map<string, PaymentRequest[]>();
  for (const r of requests) {
    const key = r.runId ?? runDateFor(new Date(r.submittedAt ?? Date.now()));
    const list = map.get(key) ?? [];
    list.push(r);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([runDate, list]) => ({ runDate, requests: list }));
}

export interface ApprovalTotals {
  open: number;
  awaitingReview: number;
  awaitingApproval: number;
  approvedAmount: number;
  offCycle: number;
}

export function approvalTotals(requests: PaymentRequest[]): ApprovalTotals {
  let open = 0, awaitingReview = 0, awaitingApproval = 0, approvedAmount = 0, offCycle = 0;
  for (const r of requests) {
    if (isOpen(r)) open++;
    if (r.status === "submitted") awaitingReview++;
    if (r.status === "reviewed") awaitingApproval++;
    if (r.status === "approved") approvedAmount += r.amount;
    if (r.offCycle && isOpen(r)) offCycle++;
  }
  return { open, awaitingReview, awaitingApproval, approvedAmount, offCycle };
}

export type Decision = "review" | "approve" | "reject" | "pay";

/**
 * Runs a decision through the database function so the rules (who may
 * approve, which transitions are legal, the audit trail) are enforced
 * server-side, then refreshes the local record.
 */
export async function decidePaymentRequest(
  requestId: string,
  decision: Decision,
  note?: string,
): Promise<{ ok: true; request: PaymentRequest } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc("decide_payment_request", {
    _request_id: requestId,
    _decision: decision,
    _note: note ?? undefined,
  });
  if (error) return { ok: false, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) return { ok: false, error: "No response from the approval service." };
  const request = paymentRequestFromDb(row);
  const known = paymentRequestsStore.items.some((r) => r.id === request.id);
  if (known) paymentRequestsStore.update(request.id, request, { silent: true });
  else paymentRequestsStore.add(request, { silent: true });
  if (decision === "pay") settlePaidRequest(request);
  return { ok: true, request };
}

/** Ensures the weekly run row exists locally for a company + date. */
export function ensureRun(companyId: string, runDate: string): PaymentRun {
  const existing = paymentRunsStore.items.find((r) => r.companyId === companyId && r.runDate === runDate);
  if (existing) return existing;
  const run: PaymentRun = { id: crypto.randomUUID(), companyId, runDate, status: "open" };
  paymentRunsStore.add(run);
  return run;
}

// ---------------------------------------------------------------------------
// Releasing the money
// ---------------------------------------------------------------------------

/**
 * Records the actual money movement for a paid request: settles the source
 * expense and writes a bank transaction on the run day, so the Cash flow page
 * and the account balance reflect it. Safe to call twice — an existing
 * matching transaction short-circuits it.
 */
export function settlePaidRequest(request: PaymentRequest): void {
  if (request.status !== "paid") return;

  const date = (request.paidAt ?? request.runId ?? new Date().toISOString()).slice(0, 10);
  const expense = request.expenseId
    ? expensesStore.items.find((e) => e.id === request.expenseId)
    : undefined;

  if (expense && expense.status !== "paid") {
    expensesStore.update(expense.id, {
      paid: expense.amount,
      status: "paid",
    });
  }

  const accountId = request.accountId ?? expense?.accountId
    ?? accountsStore.items.find((a) => a.companyId === request.companyId)?.id;
  if (!accountId) return;

  const marker = `pay-req:${request.id}`;
  const already = transactionsStore.items.some((t) => t.description?.includes(marker));
  if (already) return;

  transactionsStore.add({
    id: crypto.randomUUID(),
    companyId: request.companyId,
    accountId,
    date,
    type: "expense",
    category: expense?.category ?? "Payments",
    description: `${request.title} [${marker}]`,
    amount: -Math.abs(request.amount),
    currency: request.currency,
    supplierId: request.supplierId,
    projectId: request.projectId,
    source: "manual",
  });
}
