import { useEffect, useState } from "react";
import { Ban } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Frequent reasons — one click fills the box, the text stays editable. */
export const CANCEL_REASON_PRESETS = [
  "Client withdrew",
  "Duplicate",
  "Superseded by a new document",
  "Pricing error",
  "Project cancelled",
];

/**
 * Reason-gated cancellation, shared by quotations and invoices (single and
 * bulk). Cancelling is never allowed without a written reason, because the
 * reason is what the audit trail keeps.
 */
export function CancelReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Cancel document",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [showError, setShowError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setReason(""); setShowError(false); setBusy(false); }
  }, [open]);

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) { setShowError(true); return; }
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          <div className="flex flex-wrap gap-1.5">
            {CANCEL_REASON_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setReason(p); setShowError(false); }}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="cancel-reason" className="text-[11px]">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="cancel-reason"
              autoFocus
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (e.target.value.trim()) setShowError(false); }}
              placeholder="Why is this being cancelled?"
              rows={4}
              aria-invalid={showError}
              className={showError ? "border-destructive focus-visible:ring-destructive" : undefined}
            />
            {showError && <p className="text-[11px] text-destructive mt-1">A reason is required to cancel.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep as is</Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={busy}>
            <Ban className="h-3.5 w-3.5 mr-1.5" /> {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
