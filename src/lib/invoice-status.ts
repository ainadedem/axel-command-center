/**
 * Controlled invoice status transitions.
 *
 * Every status change (preview dropdown, bulk action, reconcile fix) should go
 * through here so that the money fields (`paid`, `paidDate`) and the
 * cancellation fields (`cancelledAt`, `cancellationReason`) always move
 * together with the status, are written to the audit trail, and can be undone.
 */
import { useSyncExternalStore } from "react";
import { invoicesStore, transactionsStore, type Invoice } from "@/lib/mock-data";
import { invoiceBalance, invoicePayable } from "@/lib/invoice-money";
import { logActivity } from "@/lib/document-activity";
import { withoutHistory } from "@/lib/history";

export type InvoiceStatus = Invoice["status"];

/** Subset of an invoice the transition logic needs (keeps helpers testable). */
export type StatusInvoice = Pick<
  Invoice,
  "status" | "amount" | "paid" | "paidDate" | "taxAmount" | "totalAmount" | "cancelledAt" | "cancellationReason"
>;

export interface StatusChangeCtx {
  /** Reason typed by the user — required when cancelling. */
  reason?: string;
  /** Payment date to stamp when moving to paid. */
  paymentDate?: string;
  /** Set once a payment has actually been recorded (mark-paid dialog). */
  paymentConfirmed?: boolean;
  /** Injectable clock (tests). */
  now?: Date;
}

export interface StatusChangePlan {
  patch: Partial<Invoice>;
  /** Values the patched fields had before — used for undo. */
  previous: Partial<Invoice>;
  /** True when the invoice still has an outstanding balance and needs a payment. */
  requiresPayment: boolean;
  /** True when a cancellation reason is still missing. */
  requiresReason: boolean;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Pure planner: what should change on the invoice for `next`, and what is
 * still missing before the change may be committed.
 */
export function planStatusChange(
  inv: StatusInvoice,
  next: InvoiceStatus,
  ctx: StatusChangeCtx = {},
): StatusChangePlan {
  const now = ctx.now ?? new Date();
  const payable = invoicePayable(inv);
  const balance = invoiceBalance(inv);
  const patch: Partial<Invoice> = { status: next };
  let requiresPayment = false;
  let requiresReason = false;

  if (next === "paid") {
    requiresPayment = payable > 0 && balance > 0 && !ctx.paymentConfirmed;
    patch.paid = Math.max(inv.paid ?? 0, payable);
    patch.paidDate = ctx.paymentDate ?? inv.paidDate ?? day(now);
  }

  if (next === "cancelled") {
    const reason = ctx.reason?.trim();
    requiresReason = !reason;
    patch.cancellationReason = reason;
    patch.cancelledAt = inv.cancelledAt ?? now.toISOString();
  } else if (inv.cancelledAt || inv.cancellationReason) {
    // Leaving the cancelled state clears the cancellation metadata.
    patch.cancelledAt = undefined;
    patch.cancellationReason = undefined;
  }

  const previous: Partial<Invoice> = {};
  (Object.keys(patch) as Array<keyof Invoice>).forEach((k) => {
    (previous as Record<string, unknown>)[k] = (inv as Record<string, unknown>)[k];
  });

  return { patch, previous, requiresPayment, requiresReason };
}

/** Human-readable diff of the fields a status change moved. */
export function describeStatusChange(
  before: StatusInvoice,
  patch: Partial<Invoice>,
  currency: string,
): string {
  const parts: string[] = [];
  if (patch.status && patch.status !== before.status) parts.push(`${before.status} → ${patch.status}`);
  if (patch.paid != null && patch.paid !== (before.paid ?? 0)) {
    parts.push(`paid ${(before.paid ?? 0).toLocaleString()} → ${patch.paid.toLocaleString()} ${currency}`);
  }
  if (patch.cancellationReason && patch.cancellationReason !== before.cancellationReason) {
    parts.push(`reason “${patch.cancellationReason}”`);
  }
  if (patch.cancelledAt === undefined && before.cancelledAt) parts.push("cancellation cleared");
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// Transient per-row diff badges
// ---------------------------------------------------------------------------

const diffs = new Map<string, string>();
const diffListeners = new Set<() => void>();
const emitDiffs = () => diffListeners.forEach((l) => l());
const DIFF_TTL = 8000;

export function pushStatusDiff(invoiceId: string, text: string) {
  if (!text) return;
  diffs.set(invoiceId, text);
  emitDiffs();
  setTimeout(() => {
    if (diffs.get(invoiceId) === text) {
      diffs.delete(invoiceId);
      emitDiffs();
    }
  }, DIFF_TTL);
}

export function clearStatusDiff(invoiceId: string) {
  if (diffs.delete(invoiceId)) emitDiffs();
}

export function useStatusDiff(invoiceId: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      diffListeners.add(cb);
      return () => diffListeners.delete(cb);
    },
    () => diffs.get(invoiceId) ?? null,
    () => null,
  );
}

// ---------------------------------------------------------------------------
// Commit + undo
// ---------------------------------------------------------------------------

export interface CommittedStatusChange {
  summary: string;
  diff: string;
  revert: () => Promise<void>;
}

/**
 * Applies the patch to the store, writes the audit entry and returns a
 * `revert()` closure restoring every touched field (and deleting any payment
 * transactions the change created).
 */
export function commitStatusChange(
  invoice: Invoice,
  plan: StatusChangePlan,
  opts: { createdTransactionIds?: string[] } = {},
): CommittedStatusChange {
  const before: StatusInvoice = { ...invoice };
  const next = plan.patch.status ?? invoice.status;
  const diff = describeStatusChange(before, plan.patch, invoice.currency);
  const summary = `Status changed from ${invoice.status} to ${next}`;

  invoicesStore.update(invoice.id, plan.patch);
  pushStatusDiff(invoice.id, diff);

  logActivity({
    docType: "invoice",
    docId: invoice.id,
    docNumber: invoice.number,
    companyId: invoice.companyId,
    action: "status_changed",
    summary,
    details: {
      before: invoice.status,
      after: next,
      paidBefore: invoice.paid ?? 0,
      paidAfter: plan.patch.paid ?? invoice.paid ?? 0,
      paidDate: plan.patch.paidDate ?? invoice.paidDate ?? null,
      cancelledAt: plan.patch.cancelledAt ?? null,
      cancellationReason: plan.patch.cancellationReason ?? null,
      transactionIds: opts.createdTransactionIds ?? [],
    },
  });

  const revert = async () => {
    await withoutHistory(() => {
      invoicesStore.update(invoice.id, plan.previous);
      (opts.createdTransactionIds ?? []).forEach((txId) => transactionsStore.remove(txId));
    });
    clearStatusDiff(invoice.id);
    logActivity({
      docType: "invoice",
      docId: invoice.id,
      docNumber: invoice.number,
      companyId: invoice.companyId,
      action: "status_changed",
      summary: `Status change undone (${next} → ${invoice.status})`,
      details: { before: next, after: invoice.status, undo: true },
    });
  };

  // A paid invoice can move its deal forward in the pipeline (user confirms).
  if (next === "paid" && invoice.opportunityId) {
    try {
      const siblings = invoicesStore.items.filter(
        (i) => i.opportunityId === invoice.opportunityId && i.status !== "cancelled",
      );
      const allPaid = siblings.every((i) => (i.id === invoice.id ? true : i.status === "paid"));
      proposeStageChange(invoice.opportunityId, "invoice_paid", { allInvoicesPaid: allPaid }, {
        docType: "invoice", docId: invoice.id, docNumber: invoice.number,
      });
    } catch { /* pipeline suggestion is best-effort */ }
  }

  return { summary, diff, revert };
}

// ---------------------------------------------------------------------------
// KPI helpers (shared by the invoices page and the consistency tests)
// ---------------------------------------------------------------------------

export interface InvoiceKpis {
  open: number;
  paidTotal: number;
  overdue: number;
}

/** Receivable KPIs computed from the money fields, never from status alone. */
export function invoiceKpis(list: StatusInvoice[], today = new Date()): InvoiceKpis {
  const active = list.filter((i) => i.status !== "cancelled");
  const open = active.filter((i) => i.status !== "paid").reduce((s, i) => s + invoiceBalance(i), 0);
  const paidTotal = active.filter((i) => i.status === "paid").reduce((s, i) => s + (i.paid ?? 0), 0);
  const overdue = active
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + invoiceBalance(i), 0);
  void today;
  return { open, paidTotal, overdue };
}
