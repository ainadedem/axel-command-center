/**
 * Bulk status changes for quotations and invoices.
 *
 * The planner is pure so the dialog can show exactly what will happen before
 * anything is written, and so the rules (permissions, already-in-status,
 * cancellation reason) can be unit-tested. The applier writes optimistically,
 * confirms every row server-side, rolls back whatever the server refused, and
 * hands back a single undo for the whole batch.
 */
import type { Collection } from "@/lib/data-store";
import { withoutHistory } from "@/lib/history";
import { logActivity, type DocType } from "@/lib/document-activity";
import {
  confirmStatusChanges,
  summarizeStatusWrites,
  statusBatchMessage,
  statusLabel,
  type StatusDocType,
  type StatusBatchSummary,
} from "@/lib/status-guard";

export interface BulkStatusRow {
  id: string;
  number: string;
  companyId: string;
  status: string;
  updatedAt?: string;
  paid?: number;
  paidDate?: string;
}

export interface BulkStatusPlan<T extends BulkStatusRow> {
  /** Rows that will actually move. */
  change: T[];
  /** Rows already in the target status. */
  same: T[];
  /** Rows that cannot move, with the reason shown to the user. */
  blocked: Array<{ row: T; reason: string }>;
  /** True when the target status needs a written reason. */
  needsReason: boolean;
}

/** Decide, without writing anything, what a bulk status change would do. */
export function planBulkStatus<T extends BulkStatusRow>(
  rows: T[],
  next: string,
  opts: {
    canWrite: (row: T) => boolean;
    /** Extra per-document rule; return a reason string to block the row. */
    validate?: (row: T, next: string) => string | null;
  },
): BulkStatusPlan<T> {
  const plan: BulkStatusPlan<T> = { change: [], same: [], blocked: [], needsReason: next === "cancelled" };
  rows.forEach((row) => {
    if (row.status === next) { plan.same.push(row); return; }
    if (!opts.canWrite(row)) { plan.blocked.push({ row, reason: "No permission" }); return; }
    const problem = opts.validate?.(row, next);
    if (problem) { plan.blocked.push({ row, reason: problem }); return; }
    plan.change.push(row);
  });
  return plan;
}

export interface BulkStatusOutcome {
  summary: StatusBatchSummary;
  message: string;
  /** Rows that really changed — restored by `undo()`. */
  changed: string[];
  undo: () => Promise<void>;
}

/**
 * Applies a planned bulk status change: optimistic local write, server-side
 * confirmation (role + conflict checks), rollback of everything refused.
 */
export async function applyBulkStatus<T extends BulkStatusRow>(args: {
  collection: Collection<T>;
  docType: DocType & StatusDocType;
  rows: T[];
  next: string;
  reason?: string;
  userId?: string;
  /** Extra fields to write per row (e.g. paid amount when marking paid). */
  extra?: (row: T) => Partial<T>;
}): Promise<BulkStatusOutcome> {
  const { collection, docType, rows, next, reason, userId } = args;
  const now = new Date().toISOString();

  const applied = rows.map((row) => {
    const patch = {
      status: next,
      updatedBy: userId,
      updatedAt: now,
      ...(next === "cancelled"
        ? { cancelledAt: now, cancellationReason: reason }
        : { cancelledAt: undefined, cancellationReason: undefined }),
      ...(args.extra?.(row) ?? {}),
    } as unknown as Partial<T>;
    const previous = {
      status: row.status,
      updatedBy: (row as { updatedBy?: string }).updatedBy,
      updatedAt: row.updatedAt,
      cancelledAt: (row as { cancelledAt?: string }).cancelledAt,
      cancellationReason: (row as { cancellationReason?: string }).cancellationReason,
      paid: row.paid,
      paidDate: row.paidDate,
    } as unknown as Partial<T>;
    withoutHistory(() => collection.update(row.id, patch, { silent: true }));
    return { row, previous };
  });

  const results = await confirmStatusChanges(
    docType,
    applied.map(({ row }) => ({
      id: row.id,
      expectedStatus: row.status,
      expectedUpdatedAt: row.updatedAt ?? null,
      next,
      reason: reason ?? null,
      paid: (args.extra?.(row) as { paid?: number } | undefined)?.paid ?? null,
      paidDate: (args.extra?.(row) as { paidDate?: string } | undefined)?.paidDate ?? null,
    })),
  );

  const byId = new Map(results.map((r) => [r.id, r]));
  const kept: typeof applied = [];

  applied.forEach((entry) => {
    const res = byId.get(entry.row.id);
    if (!res || res.state === "ok" || res.state === "skipped") { kept.push(entry); return; }
    // Refused: put the row back to whatever the database really holds.
    const restore = { ...entry.previous } as Record<string, unknown>;
    if (res.current?.status) restore['status'] = res.current.status;
    if (res.current?.updatedAt) restore['updatedAt'] = res.current.updatedAt;
    withoutHistory(() => collection.update(entry.row.id, restore as Partial<T>, { silent: true }));
  });

  kept.forEach(({ row }) => {
    void logActivity({
      docType,
      docId: row.id,
      docNumber: row.number,
      companyId: row.companyId,
      action: "status_changed",
      summary: `Bulk: ${statusLabel(row.status)} → ${statusLabel(next)}${reason ? ` — ${reason}` : ""}`,
      details: { from: row.status, to: next, bulk: true, reason: reason ?? null },
    });
  });

  const summary = summarizeStatusWrites(results);

  const undo = async () => {
    await withoutHistory(async () => {
      kept.forEach(({ row, previous }) => collection.update(row.id, previous, { silent: true }));
    });
    await confirmStatusChanges(
      docType,
      kept.map(({ row, previous }) => ({
        id: row.id,
        expectedStatus: next,
        next: (previous as { status?: string }).status ?? row.status,
        reason: (previous as { cancellationReason?: string }).cancellationReason ?? null,
      })),
    );
    kept.forEach(({ row, previous }) => {
      void logActivity({
        docType,
        docId: row.id,
        docNumber: row.number,
        companyId: row.companyId,
        action: "status_changed",
        summary: `Bulk status change undone (${statusLabel(next)} → ${statusLabel((previous as { status?: string }).status)})`,
        details: { from: next, to: (previous as { status?: string }).status ?? null, undo: true, bulk: true },
      });
    });
  };

  return {
    summary,
    message: statusBatchMessage(summary, docType === "quote" ? "quotation" : "invoice", next),
    changed: kept.map(({ row }) => row.id),
    undo,
  };
}
