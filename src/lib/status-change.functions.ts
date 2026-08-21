/**
 * Server-side guarded status writes for quotations and invoices.
 *
 * The browser applies status changes optimistically, but the write that
 * decides the truth happens here: the update is conditional on the document
 * still holding the status (and `updated_at`) the user was looking at, and it
 * runs through the caller's own session so row level security — not the UI —
 * enforces who may change what. A stale write is rejected and reported back
 * with the winning value instead of silently overwriting a colleague.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type StatusDocType = "quote" | "invoice";

export interface StatusWriteItem {
  /** Database id of the document (non-UUID ids are local-only and skipped). */
  id: string;
  /** Status the user saw when they made the change. */
  expectedStatus: string;
  /** `updated_at` the user saw, when known. */
  expectedUpdatedAt?: string | null;
  next: string;
  /** Mandatory when `next` is "cancelled". */
  reason?: string | null;
  paid?: number | null;
  paidDate?: string | null;
}

export type StatusWriteState = "ok" | "conflict" | "denied" | "missing" | "skipped" | "error";

export interface StatusWriteOutcome {
  id: string;
  state: StatusWriteState;
  /** The value that is actually in the database now (conflict / denied). */
  current?: { status: string; updatedAt?: string | null; updatedBy?: string | null } | null;
  message?: string;
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export const commitStatusChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { docType: StatusDocType; items: StatusWriteItem[] }) => {
    if (input.docType !== "quote" && input.docType !== "invoice") throw new Error("Unknown document type");
    if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Nothing to update");
    if (input.items.length > 200) throw new Error("Too many documents in one batch");
    input.items.forEach((it) => {
      if (it.next === "cancelled" && !it.reason?.trim()) {
        throw new Error("A cancellation reason is required");
      }
    });
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context as unknown as {
      supabase: {
        from: (t: string) => {
          select: (c: string) => {
            eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> };
          };
          update: (patch: Record<string, unknown>) => {
            eq: (c: string, v: string) => {
              eq: (c: string, v: string) => { select: (c: string) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }> };
            };
          };
        };
      };
    };

    const table = data.docType === "quote" ? "quotes" : "invoices";
    const cols = "id, status, updated_at, updated_by";

    const read = async (id: string) => {
      const { data: row } = await supabase.from(table).select(cols).eq("id", id).maybeSingle();
      return row as { status?: string; updated_at?: string; updated_by?: string } | null;
    };

    const results: StatusWriteOutcome[] = [];

    for (const item of data.items) {
      if (!isUuid(item.id)) {
        results.push({ id: item.id, state: "skipped", message: "Not saved to the database yet" });
        continue;
      }
      try {
        const before = await read(item.id);
        if (!before) {
          results.push({ id: item.id, state: "missing", message: "Document not found or not visible to you" });
          continue;
        }
        const stale =
          before.status !== item.expectedStatus ||
          (item.expectedUpdatedAt ? before.updated_at !== item.expectedUpdatedAt : false);
        if (stale) {
          results.push({
            id: item.id,
            state: "conflict",
            current: { status: before.status ?? "", updatedAt: before.updated_at ?? null, updatedBy: before.updated_by ?? null },
          });
          continue;
        }

        const patch: Record<string, unknown> = { status: item.next, updated_at: new Date().toISOString() };
        if (item.next === "cancelled") {
          patch['cancellation_reason'] = item.reason?.trim() ?? null;
          patch['cancelled_at'] = new Date().toISOString();
        } else {
          patch['cancellation_reason'] = null;
          patch['cancelled_at'] = null;
        }
        if (data.docType === "invoice") {
          if (item.paid != null) patch['paid'] = item.paid;
          if (item.paidDate != null) patch['paid_date'] = item.paidDate;
        }

        const { data: updated, error } = await supabase
          .from(table)
          .update(patch)
          .eq("id", item.id)
          .eq("status", item.expectedStatus)
          .select(cols);

        if (error) {
          results.push({ id: item.id, state: "error", message: error.message });
          continue;
        }
        if (!updated || updated.length === 0) {
          const after = await read(item.id);
          if (after && after.status !== item.expectedStatus) {
            results.push({
              id: item.id,
              state: "conflict",
              current: { status: after.status ?? "", updatedAt: after.updated_at ?? null, updatedBy: after.updated_by ?? null },
            });
          } else {
            results.push({
              id: item.id,
              state: "denied",
              current: after ? { status: after.status ?? "", updatedAt: after.updated_at ?? null } : null,
              message: "You do not have permission to change this document",
            });
          }
          continue;
        }

        const row = updated[0] as { status?: string; updated_at?: string; updated_by?: string };
        results.push({
          id: item.id,
          state: "ok",
          current: { status: row.status ?? item.next, updatedAt: row.updated_at ?? null, updatedBy: row.updated_by ?? null },
        });
      } catch (e) {
        results.push({ id: item.id, state: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }

    return { results };
  });
