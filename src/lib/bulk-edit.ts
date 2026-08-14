import type { Collection } from "@/lib/data-store";
import { pushHistory, withoutHistory } from "@/lib/history";
import { logActivity, type DocType } from "@/lib/document-activity";

export interface BulkDoc {
  id: string;
  number: string;
  companyId: string;
  clientId: string;
  projectId?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface BulkPatch {
  /** New client, when the user picked one. */
  clientId?: string;
  /** "set" with a project id, "clear" to unlink, undefined to keep. */
  projectId?: string | null;
}

/**
 * Applies a client/project patch to several documents at once. The whole batch
 * is recorded as a single undo entry so one undo reverts every row.
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
}): Promise<number> {
  const { collection, docType, rows, patch, userId, label } = opts;
  const keys: (keyof T)[] = [];
  if (patch.clientId !== undefined) keys.push("clientId" as keyof T);
  if (patch.projectId !== undefined) keys.push("projectId" as keyof T);
  if (keys.length === 0 || rows.length === 0) return 0;

  const buildPatch = () => {
    const p: Record<string, unknown> = {
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };
    if (patch.clientId !== undefined) p.clientId = patch.clientId;
    if (patch.projectId !== undefined) p.projectId = patch.projectId ?? undefined;
    return p as Partial<T>;
  };

  const before = rows.map((r) => ({
    id: r.id,
    previous: {
      clientId: r.clientId,
      projectId: r.projectId,
      updatedBy: r.updatedBy,
      updatedAt: r.updatedAt,
    } as Partial<T>,
  }));

  const apply = () => {
    const next = buildPatch();
    rows.forEach((r) => collection.update(r.id, next, { silent: true }));
  };

  await withoutHistory(apply);

  pushHistory({
    label,
    undo: () => {
      before.forEach((b) => collection.update(b.id, b.previous, { silent: true }));
    },
    redo: () => {
      apply();
    },
  });

  // Activity trail, one entry per document.
  const summaryBits: string[] = [];
  if (patch.clientId !== undefined) {
    summaryBits.push(`client → ${opts.clientName?.(patch.clientId) ?? patch.clientId}`);
  }
  if (patch.projectId !== undefined) {
    summaryBits.push(
      patch.projectId === null
        ? "project cleared"
        : `project → ${opts.projectName?.(patch.projectId) ?? patch.projectId}`,
    );
  }
  const summary = `Bulk update: ${summaryBits.join(", ")}`;
  await Promise.all(
    rows.map((r) =>
      logActivity({
        docType,
        docId: r.id,
        docNumber: r.number,
        companyId: r.companyId,
        action: "updated",
        summary,
        details: { bulk: true, ...patch },
      }),
    ),
  );

  return rows.length;
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
