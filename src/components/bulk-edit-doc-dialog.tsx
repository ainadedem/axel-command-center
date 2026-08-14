import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients, useProjects, contactBelongsTo } from "@/lib/mock-data";
import type { BulkPatch } from "@/lib/bulk-edit";

const KEEP = "__keep__";
const CLEAR = "__clear__";

export interface BulkEditRow {
  id: string;
  number: string;
  companyId: string;
  clientId: string;
  projectId?: string;
  status?: string;
}

export function BulkEditDocDialog({
  open,
  onOpenChange,
  rows,
  noun,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rows: BulkEditRow[];
  noun: string;
  onApply: (patch: BulkPatch) => void | Promise<void>;
}) {
  const clients = useClients();
  const projects = useProjects();
  const [clientChoice, setClientChoice] = useState(KEEP);
  const [projectChoice, setProjectChoice] = useState(KEEP);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setClientChoice(KEEP);
      setProjectChoice(KEEP);
    }
  }, [open]);

  const companyIds = useMemo(() => [...new Set(rows.map((r) => r.companyId))], [rows]);

  const availableClients = useMemo(
    () =>
      clients
        .filter((c) => companyIds.every((cid) => contactBelongsTo(c, cid)))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clients, companyIds],
  );

  // The project list follows the client that will be effective after the edit.
  const effectiveClientIds = useMemo(
    () => (clientChoice !== KEEP ? [clientChoice] : [...new Set(rows.map((r) => r.clientId))]),
    [clientChoice, rows],
  );

  const availableProjects = useMemo(
    () =>
      projects
        .filter((p) => companyIds.includes(p.companyId) && effectiveClientIds.includes(p.clientId ?? ""))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, companyIds, effectiveClientIds],
  );

  const cancelledCount = rows.filter((r) => r.status === "cancelled").length;
  const hasChange = clientChoice !== KEEP || projectChoice !== KEEP;

  const submit = async () => {
    const patch: BulkPatch = {};
    if (clientChoice !== KEEP) patch.clientId = clientChoice;
    if (projectChoice === CLEAR) patch.projectId = null;
    else if (projectChoice !== KEEP) patch.projectId = projectChoice;
    setBusy(true);
    try {
      await onApply(patch);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Bulk edit {rows.length} {noun}
            {rows.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Reassign the client and/or project. Amounts, numbers and statuses stay untouched.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientChoice} onValueChange={setClientChoice}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                {availableClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableClients.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No client is shared by every selected company.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectChoice} onValueChange={setProjectChoice}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={KEEP}>Keep current</SelectItem>
                <SelectItem value={CLEAR}>Clear project</SelectItem>
                {availableProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableProjects.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No project matches the selected client(s).</p>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-elevated/40 px-3 py-2 text-[11px] text-muted-foreground space-y-1">
            <div>
              {rows.length} {noun}
              {rows.length !== 1 ? "s" : ""} across {companyIds.length} compan{companyIds.length !== 1 ? "ies" : "y"}.
            </div>
            {cancelledCount > 0 && (
              <div className="text-warning">
                {cancelledCount} cancelled document{cancelledCount !== 1 ? "s" : ""} included.
              </div>
            )}
            <div>You can undo this in one step.</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!hasChange || busy}>
            Update {rows.length} {noun}
            {rows.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
