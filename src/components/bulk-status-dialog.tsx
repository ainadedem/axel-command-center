import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge, STATUS_META } from "@/components/status-badge";
import { CANCEL_REASON_PRESETS } from "@/components/cancel-reason-dialog";
import { planBulkStatus, type BulkStatusRow } from "@/lib/bulk-status";
import { cn } from "@/lib/utils";

/**
 * Bulk status change with a preview: before anything is written the user sees
 * how many documents move, how many are already there, and which ones are
 * skipped and why.
 */
export function BulkStatusDialog<T extends BulkStatusRow>({
  open,
  onOpenChange,
  noun,
  rows,
  statuses,
  canWrite,
  validate,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  noun: string;
  rows: T[];
  statuses: readonly string[];
  canWrite: (row: T) => boolean;
  validate?: (row: T, next: string) => string | null;
  onApply: (next: string, rows: T[], reason?: string) => void | Promise<void>;
}) {
  const [next, setNext] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setNext(""); setReason(""); setBusy(false); } }, [open]);

  const plan = useMemo(
    () => (next ? planBulkStatus(rows, next, { canWrite, validate }) : null),
    [next, rows, canWrite, validate],
  );

  const needsReason = next === "cancelled";
  const ready = !!plan && plan.change.length > 0 && (!needsReason || reason.trim().length > 0);

  const submit = async () => {
    if (!plan || !ready) return;
    setBusy(true);
    try {
      await onApply(next, plan.change, needsReason ? reason.trim() : undefined);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change status · {rows.length} {noun}{rows.length === 1 ? "" : "s"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <Label className="t-label">New status</Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {statuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNext(s)}
                  aria-pressed={next === s}
                  className={cn(
                    "rounded-full border px-1.5 py-1 transition-colors",
                    next === s ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted",
                  )}
                >
                  <StatusBadge status={s} showLabel />
                </button>
              ))}
            </div>
          </div>

          {needsReason && (
            <div>
              <Label htmlFor="bulk-cancel-reason" className="t-label">
                Cancellation reason <span className="text-destructive">*</span>
              </Label>
              <div className="flex flex-wrap gap-1.5 my-1.5">
                {CANCEL_REASON_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setReason(p)}
                    className="rounded-full border border-border px-2.5 py-1 t-label text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <Textarea
                id="bulk-cancel-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Saved on every cancelled document and in the audit trail"
              />
            </div>
          )}

          {plan && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 t-label space-y-1.5">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-success" />
                <span><span className="font-medium">{plan.change.length}</span> will change to {STATUS_META[next]?.label ?? next}</span>
              </div>
              {plan.same.length > 0 && (
                <div className="text-muted-foreground">{plan.same.length} already {STATUS_META[next]?.label ?? next}</div>
              )}
              {plan.blocked.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>{plan.blocked.length} skipped</span>
                  </div>
                  <ul className="pl-5 text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                    {plan.blocked.slice(0, 8).map(({ row, reason: why }) => (
                      <li key={row.id} className="font-tnum">{row.number} — {why}</li>
                    ))}
                    {plan.blocked.length > 8 && <li>+{plan.blocked.length - 8} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={!ready || busy}>
            {busy ? "Applying…" : `Apply to ${plan?.change.length ?? 0}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
