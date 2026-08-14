import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dbCompanyId } from "@/lib/db-sync";

/**
 * Append-only per-document history: creation, edits, status changes, payments
 * and document uploads, each attributed to a user with a timestamp.
 */

export type DocType = "quote" | "invoice" | "po";

export type ActivityAction =
  | "created"
  | "updated"
  | "status_changed"
  | "payment"
  | "document_uploaded"
  | "sent"
  | "deleted"
  | "stamp_changed"
  | "signer_changed";


export interface ActivityEntry {
  id: string;
  docType: DocType;
  docId: string;
  docNumber?: string;
  action: ActivityAction;
  summary?: string;
  details: Record<string, unknown>;
  actorId?: string;
  createdAt: string;
}

const isUuid = (v?: string) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Records one history entry. Failures never block the user's action. */
export async function logActivity(input: {
  docType: DocType;
  docId: string;
  docNumber?: string;
  companyId: string;
  action: ActivityAction;
  summary?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const company = dbCompanyId(input.companyId);
    if (!company || !isUuid(input.docId)) return;
    const { data } = await supabase.auth.getUser();
    const actor = data.user?.id;
    if (!actor) return;
    const { error } = await supabase.from("document_activity").insert({
      company_id: company,
      doc_type: input.docType,
      doc_id: input.docId,
      doc_number: input.docNumber ?? null,
      action: input.action,
      summary: input.summary ?? null,
      details: (input.details ?? {}) as never,
      actor_id: actor,
    });
    if (error) { console.warn("[activity]", error.message); return; }
    notify();
  } catch (e) {
    console.warn("[activity]", e);
  }
}

/** Loads the history of one document, newest first. */
export function useDocumentActivity(docType: DocType, docId?: string) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isUuid(docId)) { setEntries([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("document_activity")
      .select("*")
      .eq("doc_type", docType)
      .eq("doc_id", docId!)
      .order("created_at", { ascending: false });
    setEntries(
      ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        docType: r.doc_type as DocType,
        docId: r.doc_id as string,
        docNumber: (r.doc_number as string) ?? undefined,
        action: r.action as ActivityAction,
        summary: (r.summary as string) ?? undefined,
        details: (r.details as Record<string, unknown>) ?? {},
        actorId: (r.actor_id as string) ?? undefined,
        createdAt: r.created_at as string,
      })),
    );
    setLoading(false);
  }, [docType, docId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    listeners.add(load);
    return () => { listeners.delete(load); };
  }, [load]);

  return { entries, loading, reload: load };
}

type Diffable = Record<string, unknown>;

const LABELS: Record<string, string> = {
  number: "number",
  clientId: "client",
  projectId: "project",
  companyId: "company",
  issueDate: "issue date",
  dueDate: "due date",
  validUntil: "valid until",
  amount: "amount",
  currency: "currency",
  status: "status",
  subject: "object",
  notes: "notes",
  taxRate: "tax rate",
  totalAmount: "total",
  clientReference: "client reference",
  bankAccountId: "bank account",
  paid: "amount paid",
  language: "language",
};

/** Human-readable summary of what changed between two versions of a document. */
export function diffDocument(before: Diffable, after: Diffable): string {
  const changes: string[] = [];
  for (const key of Object.keys(LABELS)) {
    const a = before[key];
    const b = after[key];
    if (a === b) continue;
    if ((a ?? "") === (b ?? "")) continue;
    changes.push(LABELS[key]!);
  }
  const beforeLines = Array.isArray(before.lines) ? (before.lines as unknown[]).length : 0;
  const afterLines = Array.isArray(after.lines) ? (after.lines as unknown[]).length : 0;
  if (afterLines > beforeLines) changes.push(`${afterLines - beforeLines} line${afterLines - beforeLines > 1 ? "s" : ""} added`);
  else if (afterLines < beforeLines) changes.push(`${beforeLines - afterLines} line${beforeLines - afterLines > 1 ? "s" : ""} removed`);
  else if (afterLines && JSON.stringify(before.lines) !== JSON.stringify(after.lines)) changes.push("lines edited");

  if (changes.length === 0) return "";
  if (changes.length <= 4) return `Changed ${changes.join(", ")}`;
  return `Changed ${changes.slice(0, 4).join(", ")} +${changes.length - 4} more`;
}
