import { useMemo } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  CircleDollarSign, FilePlus2, FileUp, Pencil, Send, Tag, Trash2, History, Loader2, Stamp, PenLine, ShieldCheck, ShieldQuestion, ShieldAlert, MessageSquare, CheckCircle2, Undo2, Redo2,
} from "lucide-react";
import { useDocumentActivity, type ActivityAction, type DocType } from "@/lib/document-activity";
import { useOwnerNames } from "@/hooks/use-owner-names";

const ICONS: Record<ActivityAction, typeof Pencil> = {
  created: FilePlus2,
  updated: Pencil,
  status_changed: Tag,
  payment: CircleDollarSign,
  document_uploaded: FileUp,
  sent: Send,
  deleted: Trash2,
  stamp_changed: Stamp,
  signer_changed: PenLine,
  payment_verified: ShieldCheck,
  payment_unlinked: ShieldQuestion,
  payment_reviewed: ShieldAlert,
  comment: MessageSquare,
  accepted: CheckCircle2,
  acceptance_undone: Undo2,
  acceptance_redone: Redo2,
};

const TITLES: Record<ActivityAction, string> = {
  created: "Created",
  updated: "Edited",
  status_changed: "Status changed",
  payment: "Payment recorded",
  document_uploaded: "Document uploaded",
  sent: "Sent",
  deleted: "Deleted",
  stamp_changed: "Stamp changed",
  signer_changed: "Signer changed",
  payment_verified: "Payment verified",
  payment_unlinked: "Payment link removed",
  payment_reviewed: "Payment reviewed",
  comment: "Comment",
};


const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  docType: DocType;
  docId?: string;
  docNumber?: string;
}

/** Chronological timeline of everything that happened to one document. */
export function DocumentActivityPanel({ open, onOpenChange, docType, docId, docNumber }: Props) {
  const { entries, loading } = useDocumentActivity(docType, open ? docId : undefined);
  const actorIds = useMemo(() => entries.map((e) => e.actorId), [entries]);
  const { ownerName } = useOwnerNames(actorIds);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" aria-hidden="true" />
            Activity{docNumber ? ` · ${docNumber}` : ""}
          </SheetTitle>
          <SheetDescription>Creation, edits, status changes and payments with user attribution.</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading history…
            </div>
          )}
          {!loading && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded yet for this document.</p>
          )}
          <ol className="relative space-y-5">
            {entries.map((e, i) => {
              const Icon = ICONS[e.action] ?? Pencil;
              return (
                <li key={e.id} className="relative pl-9">
                  {i < entries.length - 1 && (
                    <span className="absolute left-[13px] top-7 bottom-[-20px] w-px bg-border" aria-hidden="true" />
                  )}
                  <span className="absolute left-0 top-0 grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{TITLES[e.action] ?? e.action}</span>
                    {e.action === "status_changed" && typeof e.details.to === "string" && (
                      <Badge variant="secondary" className="text-[10px]">{String(e.details.to)}</Badge>
                    )}
                  </div>
                  {e.summary && <p className="text-xs text-muted-foreground mt-0.5">{e.summary}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {ownerName(e.actorId)} · {fmt(e.createdAt)}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </SheetContent>
    </Sheet>
  );
}
