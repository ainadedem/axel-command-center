import { useEffect, useMemo, useState } from "react";
import { ArrowRight, History, Loader2, Ban } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOwnerNames } from "@/hooks/use-owner-names";
import type { DocType } from "@/lib/document-activity";
import { boardMoveListeners } from "@/lib/board-moves";

interface Row {
  id: string;
  docId: string;
  docNumber: string | null;
  actorId: string | null;
  createdAt: string;
  from?: string;
  to?: string;
  blocked?: boolean;
  reason?: string;
}

const rel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** Reverse-chronological list of every board move for the documents on screen. */
export function BoardHistoryPanel({
  open,
  onOpenChange,
  docType,
  docIds,
  onOpenDoc,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docType: DocType;
  docIds: string[];
  onOpenDoc?: (docId: string) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const idKey = docIds.slice(0, 400).join(",");

  useEffect(() => {
    if (!open) return;
    const listener = () => setTick((t) => t + 1);
    boardMoveListeners.add(listener);
    return () => { boardMoveListeners.delete(listener); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ids = idKey ? idKey.split(",") : [];
    if (ids.length === 0) { setRows([]); return; }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("document_activity")
      .select("id, doc_id, doc_number, actor_id, created_at, details, action")
      .eq("doc_type", docType)
      .eq("action", "status_changed")
      .in("doc_id", ids)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        setRows(
          ((data ?? []) as Record<string, unknown>[])
            .map((r) => {
              const d = (r.details as Record<string, unknown>) ?? {};
              return {
                id: r.id as string,
                docId: r.doc_id as string,
                docNumber: (r.doc_number as string) ?? null,
                actorId: (r.actor_id as string) ?? null,
                createdAt: r.created_at as string,
                from: d.from as string | undefined,
                to: d.to as string | undefined,
                blocked: Boolean(d.blocked),
                reason: d.reason as string | undefined,
              };
            })
            .filter((r) => r.from || r.to),
        );
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, docType, idKey, tick]);

  const { ownerName, ownerFirstName } = useOwnerNames(useMemo(() => rows.map((r) => r.actorId ?? undefined), [rows]));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Board history
          </SheetTitle>
          <SheetDescription>Every column move for the documents currently on the board.</SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
          </div>
        )}
        {!loading && rows.length === 0 && (
          <div className="text-sm text-muted-foreground py-6">No moves recorded yet.</div>
        )}

        <ol className="mt-4 space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenDoc?.(r.docId)}
                  className="text-xs font-tnum font-medium hover:underline"
                >
                  {r.docNumber ?? "Document"}
                </button>
                <span className="text-[10px] text-muted-foreground">{rel(r.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <Badge variant="outline" className="text-[10px] capitalize">{r.from ?? "—"}</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-[10px] capitalize">{r.to ?? "—"}</Badge>
                {r.blocked && (
                  <Badge variant="outline" className="text-[10px] gap-1 border-destructive/40 text-destructive">
                    <Ban className="h-3 w-3" /> blocked
                  </Badge>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground mt-1.5">
                <span title={ownerName(r.actorId ?? undefined)}>{ownerFirstName(r.actorId ?? undefined) || "Unknown user"}</span>
                {r.blocked && r.reason ? ` · ${r.reason}` : ""}
              </div>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
