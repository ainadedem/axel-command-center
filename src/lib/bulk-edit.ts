import type { Collection } from "@/lib/data-store";
import { pushHistory, withoutHistory } from "@/lib/history";
import { logActivity, type DocType } from "@/lib/document-activity";
import { docTotals } from "@/lib/discounts";
import { MAX_QUOTE_ASSIGNEES } from "@/lib/mock-data";

/** Minimal shape every bulk-editable document shares. */
export interface BulkDoc {
  id: string;
  number: string;
  companyId: string;
  clientId: string;
  projectId?: string;
  status?: string;
  currency?: string;
  amount?: number;
  paid?: number;
  lines?: Array<{ quantity: number; rate: number; discountPct?: number }>;
  discountPct?: number;
  taxRate?: number;
  taxAmount?: number;
  totalAmount?: number;
  issueDate?: string;
  dueDate?: string;
  validUntil?: string;
  nextFollowUpAt?: string;
  subject?: string;
  language?: string;
  bankAccountId?: string;
  signerId?: string;
  stampDirty?: boolean;
  assignedTo?: string[];
  updatedBy?: string;
  updatedAt?: string;
}

/** Set a date outright, or shift each document's own date by N days. */
export type DateOp = { mode: "set"; value: string } | { mode: "shift"; days: number };
export type AssigneeOp = { mode: "add" | "remove" | "replace"; ids: string[] };

/**
 * A batch of field operations. Every key is optional — an absent key means
 * "keep current". `null` clears the field where clearing is allowed.
 */
export interface BulkPatch {
  /* Ownership */
  clientId?: string;
  projectId?: string | null;
  assignees?: AssigneeOp;

  /* Dates */
  issueDate?: string;
  dueDate?: DateOp;
  validUntil?: DateOp;
  nextFollowUpAt?: string | null;

  /* Money & tax */
  taxRate?: number;
  discountPct?: number | null;
  currency?: string;

  /* Document setup */
  language?: string;
  bankAccountId?: string | null;
  signerId?: string | null;
  subject?: string;
}

export type SkipReason =
  | "nothing to change"
  | "paid — money fields locked"
  | "cancelled — money fields locked"
  | "payment recorded — currency locked"
  | "assignee limit reached";

export interface BulkSkip {
  id: string;
  number: string;
  reason: SkipReason;
}

export interface BulkFailure {
  id: string;
  number: string;
  error: string;
}

export interface BulkResult {
  updated: number;
  skipped: BulkSkip[];
  failed: BulkFailure[];
}

export const emptyBulkResult = (): BulkResult => ({ updated: 0, skipped: [], failed: [] });

/** True when the patch touches amounts, tax or currency. */
export function patchTouchesMoney(patch: BulkPatch): boolean {
  return patch.taxRate !== undefined || patch.discountPct !== undefined || patch.currency !== undefined;
}

export function isPatchEmpty(patch: BulkPatch): boolean {
  return Object.values(patch).every((v) => v === undefined);
}

function shiftDate(iso: string | undefined, days: number): string | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function resolveDate(current: string | undefined, op: DateOp | undefined): string | undefined {
  if (!op) return undefined;
  return op.mode === "set" ? op.value : shiftDate(current, op.days);
}

/**
 * Turns the patch into a concrete field patch for one document, or a skip
 * reason when the document cannot legally take the change.
 */
export function resolveRowPatch<T extends BulkDoc>(
  row: T,
  patch: BulkPatch,
): { patch: Partial<T> } | { skip: SkipReason } {
  const out: Record<string, unknown> = {};
  const money = patchTouchesMoney(patch);

  if (money && row.status === "paid") return { skip: "paid — money fields locked" };
  if (money && row.status === "cancelled") return { skip: "cancelled — money fields locked" };
  if (patch.currency !== undefined && (Number(row.paid) || 0) > 0) {
    return { skip: "payment recorded — currency locked" };
  }

  if (patch.clientId !== undefined && patch.clientId !== row.clientId) out.clientId = patch.clientId;
  if (patch.projectId !== undefined) {
    const next = patch.projectId ?? undefined;
    if (next !== row.projectId) out.projectId = next;
  }

  if (patch.issueDate !== undefined && patch.issueDate !== row.issueDate) out.issueDate = patch.issueDate;
  const due = resolveDate(row.dueDate, patch.dueDate);
  if (due && due !== row.dueDate) out.dueDate = due;
  const valid = resolveDate(row.validUntil, patch.validUntil);
  if (valid && valid !== row.validUntil) out.validUntil = valid;
  if (patch.nextFollowUpAt !== undefined) {
    const next = patch.nextFollowUpAt ?? undefined;
    if (next !== row.nextFollowUpAt) out.nextFollowUpAt = next;
  }

  if (patch.language !== undefined && patch.language !== row.language) out.language = patch.language;
  if (patch.subject !== undefined && patch.subject !== row.subject) out.subject = patch.subject;
  if (patch.bankAccountId !== undefined) {
    const next = patch.bankAccountId ?? undefined;
    if (next !== row.bankAccountId) out.bankAccountId = next;
  }
  if (patch.signerId !== undefined) {
    const next = patch.signerId ?? undefined;
    if (next !== row.signerId) {
      out.signerId = next;
      // The rendered stamp/signature block is stale until the doc re-renders.
      out.stampDirty = true;
    }
  }

  if (patch.assignees) {
    const current = row.assignedTo ?? [];
    let next: string[];
    if (patch.assignees.mode === "replace") next = [...new Set(patch.assignees.ids)];
    else if (patch.assignees.mode === "remove") next = current.filter((id) => !patch.assignees!.ids.includes(id));
    else next = [...new Set([...current, ...patch.assignees.ids])];
    if (next.length > MAX_QUOTE_ASSIGNEES) return { skip: "assignee limit reached" };
    if (next.join("|") !== current.join("|")) out.assignedTo = next;
  }

  if (money) {
    const taxRate = patch.taxRate ?? row.taxRate;
    const discountPct = patch.discountPct !== undefined ? patch.discountPct ?? undefined : row.discountPct;
    if (patch.taxRate !== undefined) out.taxRate = patch.taxRate;
    if (patch.discountPct !== undefined) out.discountPct = discountPct;
    if (patch.currency !== undefined && patch.currency !== row.currency) out.currency = patch.currency;

    if (patch.taxRate !== undefined || patch.discountPct !== undefined) {
      const t = docTotals(row.lines, discountPct, taxRate, row.amount);
      out.amount = t.subtotal;
      out.taxAmount = t.taxAmount;
      out.totalAmount = t.total;
    }
  }

  if (Object.keys(out).length === 0) return { skip: "nothing to change" };
  return { patch: out as Partial<T> };
}

/** Human-readable list of what the patch does, used in toasts and activity. */
export function describePatch(
  patch: BulkPatch,
  names?: { client?: (id: string) => string; project?: (id: string) => string; user?: (id: string) => string },
): string[] {
  const bits: string[] = [];
  if (patch.clientId !== undefined) bits.push(`client → ${names?.client?.(patch.clientId) ?? patch.clientId}`);
  if (patch.projectId !== undefined) {
    bits.push(patch.projectId === null ? "project cleared" : `project → ${names?.project?.(patch.projectId) ?? patch.projectId}`);
  }
  if (patch.issueDate) bits.push(`issue date → ${patch.issueDate}`);
  if (patch.dueDate) {
    bits.push(patch.dueDate.mode === "set" ? `due date → ${patch.dueDate.value}` : `due date shifted ${patch.dueDate.days > 0 ? "+" : ""}${patch.dueDate.days}d`);
  }
  if (patch.validUntil) {
    bits.push(patch.validUntil.mode === "set" ? `valid until → ${patch.validUntil.value}` : `validity shifted ${patch.validUntil.days > 0 ? "+" : ""}${patch.validUntil.days}d`);
  }
  if (patch.nextFollowUpAt !== undefined) {
    bits.push(patch.nextFollowUpAt === null ? "follow-up cleared" : `next follow-up → ${patch.nextFollowUpAt}`);
  }
  if (patch.taxRate !== undefined) bits.push(`tax → ${patch.taxRate}%`);
  if (patch.discountPct !== undefined) bits.push(patch.discountPct === null ? "discount cleared" : `discount → ${patch.discountPct}%`);
  if (patch.currency !== undefined) bits.push(`currency → ${patch.currency}`);
  if (patch.language !== undefined) bits.push(`language → ${patch.language.toUpperCase()}`);
  if (patch.bankAccountId !== undefined) bits.push(patch.bankAccountId === null ? "bank account cleared" : "bank account changed");
  if (patch.signerId !== undefined) {
    bits.push(patch.signerId === null ? "signer cleared" : `signer → ${names?.user?.(patch.signerId) ?? patch.signerId}`);
  }
  if (patch.subject !== undefined) bits.push(`object → ${patch.subject || "cleared"}`);
  if (patch.assignees) {
    const who = patch.assignees.ids.map((id) => names?.user?.(id) ?? id).join(", ") || "nobody";
    bits.push(`assignees ${patch.assignees.mode} ${who}`);
  }
  return bits;
}

/** Dry run: what would happen if this patch were applied to these rows. */
export function previewBulk<T extends BulkDoc>(rows: T[], patch: BulkPatch): {
  targets: { row: T; patch: Partial<T> }[];
  skipped: BulkSkip[];
} {
  const targets: { row: T; patch: Partial<T> }[] = [];
  const skipped: BulkSkip[] = [];
  if (isPatchEmpty(patch)) {
    return { targets, skipped: rows.map((r) => ({ id: r.id, number: r.number, reason: "nothing to change" as const })) };
  }
  for (const row of rows) {
    const res = resolveRowPatch(row, patch);
    if ("skip" in res) skipped.push({ id: row.id, number: row.number, reason: res.skip });
    else targets.push({ row, patch: res.patch });
  }
  return { targets, skipped };
}

/**
 * Applies a multi-field patch to several documents at once. The whole batch is
 * one undo entry, and each touched document gets its own activity line.
 */
export async function bulkUpdateDocuments<T extends BulkDoc>(opts: {
  collection: Collection<T>;
  docType: DocType;
  rows: T[];
  patch: BulkPatch;
  userId?: string;
  label: string;
  clientName?: (id: string) => string;
  projectName?: (id: string) => string;
  userName?: (id: string) => string;
}): Promise<BulkResult> {
  const { collection, docType, rows, patch, userId, label } = opts;
  const { targets, skipped } = previewBulk(rows, patch);
  const result: BulkResult = { updated: 0, skipped, failed: [] };
  if (targets.length === 0) return result;

  const before = targets.map(({ row, patch: p }) => {
    const prev: Record<string, unknown> = { updatedBy: row.updatedBy, updatedAt: row.updatedAt };
    for (const k of Object.keys(p)) prev[k] = (row as Record<string, unknown>)[k];
    return { id: row.id, number: row.number, previous: prev as Partial<T> };
  });

  const failed: BulkFailure[] = [];
  const apply = () => {
    const stamp = { updatedBy: userId, updatedAt: new Date().toISOString() };
    targets.forEach(({ row, patch: p }) => {
      try {
        collection.update(row.id, { ...p, ...stamp } as Partial<T>, { silent: true });
      } catch (e) {
        failed.push({ id: row.id, number: row.number, error: e instanceof Error ? e.message : String(e) });
      }
    });
  };

  await withoutHistory(apply);
  result.failed = failed;
  const failedIds = new Set(failed.map((f) => f.id));
  result.updated = targets.length - failed.length;

  pushHistory({
    label,
    undo: () => {
      before
        .filter((b) => !failedIds.has(b.id))
        .forEach((b) => collection.update(b.id, b.previous, { silent: true }));
    },
    redo: () => { apply(); },
  });

  const summary = `Bulk update: ${describePatch(patch, {
    client: opts.clientName, project: opts.projectName, user: opts.userName,
  }).join(", ")}`;

  await Promise.all(
    targets
      .filter(({ row }) => !failedIds.has(row.id))
      .map(({ row, patch: p }) =>
        logActivity({
          docType,
          docId: row.id,
          docNumber: row.number,
          companyId: row.companyId,
          action: "updated",
          summary,
          details: { bulk: true, ...(p as Record<string, unknown>) },
        }),
      ),
  );

  return result;
}

/** One-line toast text for a bulk result. */
export function bulkResultMessage(result: BulkResult, noun: string): string {
  const plural = (n: number) => `${n} ${noun}${n !== 1 ? "s" : ""}`;
  const bits = [`Updated ${plural(result.updated)}`];
  if (result.skipped.length) bits.push(`${result.skipped.length} skipped`);
  if (result.failed.length) bits.push(`${result.failed.length} failed`);
  return bits.join(" · ");
}

/**
 * Applies an arbitrary field patch (status changes, payment marks, …) to a
 * batch of documents as a single undo entry, with one activity entry per row.
 */
export async function bulkSetFields<T extends BulkDoc>(opts: {
  collection: Collection<T>;
  docType: DocType;
  rows: T[];
  /** Per-row patch; return null to skip the row. */
  patch: (row: T) => Partial<T> | null;
  userId?: string;
  label: string;
  summary: string;
}): Promise<number> {
  const { collection, docType, rows, userId, label, summary } = opts;
  const targets = rows
    .map((r) => ({ row: r, patch: opts.patch(r) }))
    .filter((t): t is { row: T; patch: Partial<T> } => t.patch !== null);
  if (targets.length === 0) return 0;

  const before = targets.map(({ row, patch }) => {
    const prev: Record<string, unknown> = { updatedBy: row.updatedBy, updatedAt: row.updatedAt };
    for (const k of Object.keys(patch)) prev[k] = (row as Record<string, unknown>)[k];
    return { id: row.id, previous: prev as Partial<T> };
  });

  const apply = () => {
    targets.forEach(({ row, patch }) =>
      collection.update(row.id, { ...patch, updatedBy: userId, updatedAt: new Date().toISOString() } as Partial<T>, { silent: true }),
    );
  };

  await withoutHistory(apply);

  pushHistory({
    label,
    undo: () => before.forEach((b) => collection.update(b.id, b.previous, { silent: true })),
    redo: () => apply(),
  });

  await Promise.all(
    targets.map(({ row, patch }) =>
      logActivity({
        docType,
        docId: row.id,
        docNumber: row.number,
        companyId: row.companyId,
        action: "updated",
        summary,
        details: { bulk: true, ...(patch as Record<string, unknown>) },
      }),
    ),
  );

  return targets.length;
}
