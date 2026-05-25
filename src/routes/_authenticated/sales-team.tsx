import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTeamMembers, useSalesMembers, useClients, useOpportunities,
  salesMembersStore,
  type SalesMember, type SalesRole,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Avatar } from "@/components/avatar-upload";
import { Pencil, Trash2, Target, Handshake } from "lucide-react";

export const Route = createFileRoute("/_authenticated/sales-team")({ component: SalesTeamPage });

const ROLE_STYLES: Record<SalesRole, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  acquisition: { label: "Acquisition", cls: "bg-sky-500/10 text-sky-300 border border-sky-500/20",       icon: Target },
  closer:      { label: "Closer",      cls: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20", icon: Handshake },
  both:        { label: "Acq + Closer", cls: "bg-violet-500/10 text-violet-300 border border-violet-500/20",   icon: Handshake },
};

function SalesTeamPage() {
  const team = useTeamMembers();
  const sales = useSalesMembers();
  const clients = useClients();
  const opportunities = useOpportunities();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalesMember | null>(null);

  const teamById = useMemo(() => new Map(team.map((t) => [t.id, t])), [team]);

  return (
    <AppShell>
      <PageHeader title="Sales team" description="People who acquire or close deals — drawn from the Team database." />
      <div className="p-8 space-y-5">
        <div className="flex items-center justify-between">
          <CrudToolbar count={sales.length} label="sales people" onCreate={() => { if (team.length > 0) { setEditing(null); setOpen(true); } }} />
          {team.length === 0 && (
            <div className="text-xs text-muted-foreground">
              No people yet — <Link to="/team" className="text-primary underline">add team members</Link> first.
            </div>
          )}
        </div>
        {sales.length === 0 ? (
          <EmptyState label="sales team members" onCreate={() => { setEditing(null); setOpen(true); }} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sales.map((s) => {
              const tm = teamById.get(s.teamMemberId);
              if (!tm) return null;
              const styles = ROLE_STYLES[s.role];
              const Icon = styles.icon;
              const acqClients = s.role !== "closer"
                ? clients.filter((c) => (c.acquisition ?? "").toLowerCase() === tm.name.toLowerCase()).length
                : 0;
              const closerOpps = s.role !== "acquisition"
                ? opportunities.filter((o) => (o.closer ?? "").toLowerCase() === tm.name.toLowerCase()).length
                : 0;
              return (
                <div key={s.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/40 transition group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={tm.avatarUrl} name={tm.name} size={40} />
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{tm.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{tm.jobTitle || tm.email || "—"}</div>
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditing(s); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => confirm(`Remove ${tm.name} from the sales team?`) && salesMembersStore.remove(s.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded ${styles.cls}`}>
                      <Icon className="h-3 w-3" /> {styles.label}
                    </span>
                    <div className="flex gap-3 text-[11px] text-muted-foreground font-tnum">
                      {s.role !== "closer" && <div><span className="text-foreground font-semibold">{acqClients}</span> clients</div>}
                      {s.role !== "acquisition" && <div><span className="text-foreground font-semibold">{closerOpps}</span> deals</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <SalesDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppShell>
  );
}

function SalesDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: SalesMember | null }) {
  const team = useTeamMembers();
  const sales = useSalesMembers();
  const [teamMemberId, setTeamMemberId] = useState("");
  const [role, setRole] = useState<SalesRole>("acquisition");

  // Team members not yet in the sales team (when creating).
  const available = team.filter((t) => editing?.teamMemberId === t.id || !sales.some((s) => s.teamMemberId === t.id));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTeamMemberId(editing.teamMemberId);
      setRole(editing.role);
    } else {
      setTeamMemberId(available[0]?.id ?? "");
      setRole("acquisition");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const submit = () => {
    if (!teamMemberId) return;
    if (editing) salesMembersStore.update(editing.id, { teamMemberId, role });
    else salesMembersStore.add({ id: newId("sm"), teamMemberId, role });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit sales member" : "Add sales member"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Team member</Label>
            <Select value={teamMemberId} onValueChange={setTeamMemberId} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder="Select a person" /></SelectTrigger>
              <SelectContent>
                {available.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">Only people in the Team database can be added.</p>
          </div>
          <div>
            <Label>Sales role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as SalesRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acquisition">Acquisition — brings new clients</SelectItem>
                <SelectItem value="closer">Closer — finalizes deals</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!teamMemberId}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
