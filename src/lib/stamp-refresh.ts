import type { Collection } from "@/lib/data-store";
import { pushHistory, withoutHistory } from "@/lib/history";
import { logActivity, type DocType } from "@/lib/document-activity";
import { supabase } from "@/integrations/supabase/client";
import { dbCompanyId } from "@/lib/db-sync";

/**
 * Stamp & signature refresh.
 *
 * Documents keep a snapshot of who signs them and where the stamp sits. When
 * the company stamp or someone's signature changes, existing documents are
 * flagged (`stampDirty`) and can be refreshed in bulk from the list pages,
 * instead of re-opening each document one by one.
 */

export interface StampDoc {
  id: string;
  number: string;
  companyId: string;
  signerId?: string;
  stampX?: number;
  stampY?: number;
  stampScale?: number;
  stampDirty?: boolean;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
}

const isUuid = (v?: string) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export interface RefreshOptions<T extends StampDoc> {
  collection: Collection<T>;
  docType: DocType;
  rows: T[];
  /** Signer applied to documents that have none yet (usually the current user). */
  fallbackSignerId?: string;
  /** Reset any custom stamp coordinates back to the company default corner. */
  resetPlacement?: boolean;
  userId?: string;
}

/**
 * Re-applies the current signature + stamp settings to several documents at
 * once. Recorded as a single undo entry, with one activity line per document.
 */
export async function refreshStampsAndSignatures<T extends StampDoc>(
  opts: RefreshOptions<T>,
): Promise<number> {
  const { collection, docType, rows, fallbackSignerId, resetPlacement, userId } = opts;
  if (rows.length === 0) return 0;

  const before = rows.map((r) => ({
    id: r.id,
    previous: {
      signerId: r.signerId,
      stampX: r.stampX,
      stampY: r.stampY,
      stampScale: r.stampScale,
      stampDirty: r.stampDirty,
    } as Partial<T>,
  }));

  const patchFor = (r: T): Partial<T> => {
    const p: Record<string, unknown> = { stampDirty: false };
    const signer = r.signerId ?? r.updatedBy ?? r.createdBy ?? fallbackSignerId;
    if (signer && isUuid(signer)) p.signerId = signer;
    if (resetPlacement) { p.stampX = undefined; p.stampY = undefined; p.stampScale = undefined; }
    return p as Partial<T>;
  };

  const apply = () => {
    rows.forEach((r) => collection.update(r.id, patchFor(r), { silent: true }));
  };

  await withoutHistory(apply);

  pushHistory({
    label: `Refresh stamp & signature on ${rows.length} document${rows.length > 1 ? "s" : ""}`,
    undo: () => { before.forEach((b) => collection.update(b.id, b.previous, { silent: true })); },
    redo: () => { apply(); },
  });

  await Promise.all(
    rows.map((r) =>
      logActivity({
        docType,
        docId: r.id,
        docNumber: r.number,
        companyId: r.companyId,
        action: "updated",
        summary: resetPlacement
          ? "Stamp & signature refreshed (placement reset to company default)"
          : "Stamp & signature refreshed",
        details: { bulk: true, stampRefresh: true, actor: userId },
      }),
    ),
  );

  return rows.length;
}

/** Flags every document of a company as needing a stamp/signature refresh. */
export async function markCompanyDocumentsDirty(companyId: string): Promise<void> {
  const dbId = dbCompanyId(companyId);
  if (!dbId) return;
  await Promise.all(
    (["invoices", "quotes", "purchase_orders"] as const).map((table) =>
      supabase.from(table).update({ stamp_dirty: true }).eq("company_id", dbId),
    ),
  );
}

/** Flags every document signed by a user after their signature changed. */
export async function markSignerDocumentsDirty(userId?: string): Promise<void> {
  if (!isUuid(userId)) return;
  await Promise.all(
    (["invoices", "quotes", "purchase_orders"] as const).map((table) =>
      supabase.from(table).update({ stamp_dirty: true }).eq("signer_id", userId!),
    ),
  );
}
