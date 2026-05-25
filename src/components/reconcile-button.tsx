import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScanSearch, Wand2, CheckCircle2 } from "lucide-react";

export interface ReconcileCheck {
  /** Stable id (used as key). */
  id: string;
  /** Short label shown in the list (e.g. "Invoices without project"). */
  label: string;
  /** Optional sub-text describing the fix. */
  description?: string;
  /** Number of items the check found right now. */
  count: number;
  /** Run the fix; return number of items fixed. */
  fix: () => number;
}

/**
 * Per-page "scan & reconcile" button.
 * Lists data integrity checks for the current scope and lets the user
 * fix them individually or all at once.
 */
export function ReconcileButton({ checks, label = "Scan" }: { checks: ReconcileCheck[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [lastFixed, setLastFixed] = useState<Record<string, number>>({});
  const totalIssues = checks.reduce((s, c) => s + c.count, 0);

  const fixOne = (c: ReconcileCheck) => {
    const n = c.fix();
    setLastFixed((m) => ({ ...m, [c.id]: (m[c.id] ?? 0) + n }));
  };
  const fixAll = () => {
    const next: Record<string, number> = { ...lastFixed };
    checks.forEach((c) => {
      if (c.count === 0) return;
      const n = c.fix();
      next[c.id] = (next[c.id] ?? 0) + n;
    });
    setLastFixed(next);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        title="Scan for data inconsistencies"
      >
        <ScanSearch className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
        {totalIssues > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-medium bg-warning/15 text-warning border border-warning/30">
            {totalIssues}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ScanSearch className="h-4 w-4" /> Reconciliation scan</DialogTitle>
            <DialogDescription>Detect missing links between invoices, projects, transactions and POs in the current scope.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[60vh] overflow-auto">
            {checks.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">No checks defined for this page.</div>
            )}
            {checks.map((c) => {
              const fixed = lastFixed[c.id] ?? 0;
              const clean = c.count === 0;
              return (
                <div key={c.id} className="flex items-start justify-between gap-4 rounded-lg border border-border bg-surface-elevated/40 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {clean ? <CheckCircle2 className="h-4 w-4 text-success" /> : <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-medium bg-warning/15 text-warning border border-warning/30">{c.count}</span>}
                      {c.label}
                    </div>
                    {c.description && <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>}
                    {fixed > 0 && <div className="text-xs text-success mt-1">Fixed {fixed}</div>}
                  </div>
                  <Button size="sm" variant="outline" disabled={clean} onClick={() => fixOne(c)} className="gap-1.5 shrink-0">
                    <Wand2 className="h-3.5 w-3.5" /> Fix
                  </Button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={fixAll} disabled={totalIssues === 0} className="gap-1.5"><Wand2 className="h-4 w-4" /> Fix all ({totalIssues})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
