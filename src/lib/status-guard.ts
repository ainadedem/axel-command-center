/**
 * Client side of the guarded status write.
 *
 * The UI changes instantly (optimistic), then this helper confirms the change
 * against the database. If somebody else moved the document first, the write
 * is rejected server-side and we roll the row back to the value that actually
 * won, so nobody's change is silently lost.
 */
import { STATUS_META } from "@/components/status-badge";
import {
  commitStatusChanges,
  type StatusDocType,
  type StatusWriteItem,
  type StatusWriteOutcome,
} from "@/lib/status-change.functions";

export type { StatusDocType, StatusWriteItem, StatusWriteOutcome };

export const statusLabel = (s?: string | null) => (s ? STATUS_META[s]?.label ?? s : "—");

/** Counts and messages for a batch of guarded writes — pure, so it is testable. */
export interface StatusBatchSummary {
  ok: string[];
  conflicts: StatusWriteOutcome[];
  denied: string[];
  failed: string[];
  /** Written locally but not confirmed remotely (offline/demo rows). */
  skipped: string[];
}

export function summarizeStatusWrites(results: StatusWriteOutcome[]): StatusBatchSummary {
  const s: StatusBatchSummary = { ok: [], conflicts: [], denied: [], failed: [], skipped: [] };
  results.forEach((r) => {
    if (r.state === "ok") s.ok.push(r.id);
    else if (r.state === "conflict") s.conflicts.push(r);
    else if (r.state === "denied" || r.state === "missing") s.denied.push(r.id);
    else if (r.state === "skipped") s.skipped.push(r.id);
    else s.failed.push(r.id);
  });
  return s;
}

/** One-line toast text describing what a batch actually did. */
export function statusBatchMessage(summary: StatusBatchSummary, noun: string, next: string): string {
  const n = (c: number) => `${c} ${noun}${c === 1 ? "" : "s"}`;
  const parts: string[] = [];
  const changed = summary.ok.length + summary.skipped.length;
  if (changed) parts.push(`${n(changed)} → ${statusLabel(next)}`);
  if (summary.conflicts.length) parts.push(`${summary.conflicts.length} changed by someone else`);
  if (summary.denied.length) parts.push(`${summary.denied.length} not permitted`);
  if (summary.failed.length) parts.push(`${summary.failed.length} failed`);
  return parts.join(" · ") || "Nothing to update";
}

/** Human sentence for a single conflict. */
export function conflictMessage(number: string, outcome: StatusWriteOutcome): string {
  const current = statusLabel(outcome.current?.status);
  return `${number} was already changed to ${current} by someone else.`;
}

/**
 * Confirms status changes server-side. Never throws: a transport failure comes
 * back as `error` outcomes so the caller can roll the rows back.
 */
export async function confirmStatusChanges(
  docType: StatusDocType,
  items: StatusWriteItem[],
): Promise<StatusWriteOutcome[]> {
  if (items.length === 0) return [];
  try {
    const res = await commitStatusChanges({ data: { docType, items } });
    return res.results;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return items.map((i) => ({ id: i.id, state: "error" as const, message }));
  }
}
