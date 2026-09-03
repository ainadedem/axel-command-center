import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTeamMembers, useSalesMembers, useClients, useOpportunities, useQuotes,
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
import { Pencil, Trash2, Target, Handshake, ShieldCheck } from "lucide-react";
import { useSalesRoleSync } from "@/lib/use-sales-role-sync";
import { toast } from "sonner";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";

export const Route = createFileRoute("/_authenticated/sales-team")({ component: SalesTeamPage });

const ROLE_STYLES: Record<SalesRole, { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }> = {
  acquisition: { label: "Acquisition", cls: "bg-sky-500/10 text-sky-700 border border-sky-500/20", icon: Target },
  closer: { label: "Closer", cls: "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20", icon: Handshake },
  both: { label: "Acq + Closer", cls: "bg-violet-500/10 text-violet-700 border border-violet-500/20", icon: Handshake },
};

function SalesTeamPage() {
  const team = useTeamMembers();
  const sales = useSalesMembers();
  const clients = useClients();
  const opportunities = useOpportunities();
  const quotes = useQuotes();
  useSalesRoleSync();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalesMember | null>(null);

  const teamById = useMemo(() => new Map(team.map((t) => [t.id, t])), [team]);

  return (
    <AppShell>
      <PageHeader title="Sales team" description="People who acquire or close deals - drawn from the Team database." />
      <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
        <div className="flex items-center justify-between">
          <CrudToolbar createLabel="Add sales member" count={sales.length} label="sales people" onCreate={() => { if (team.length > 0) { setEditing(null); setOpen(true); } }} />
          {team.length === 0 && (
            <div className="t-label text-muted-foreground">
              No people yet - <Link to="/team" className="text-primary underline">add team members</Link> first.
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
              const memberKey = tm.userId || tm.name;
              const quotesCount = quotes.filter(
                (q) =>
                  (q.assignedTo ?? []).some((id) => id === tm.userId || id === tm.name) ||
                  (clients.find((c) => c.id === q.clientId)?.acquisition ?? "").toLowerCase() === tm.name.toLowerCase(),
              ).length;
              return (
                <div key={s.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/40 transition group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar src={tm.avatarUrl} name={tm.name} size={40} />
                      <div className="min-w-0">
                        <div className="font-medium t-body truncate">{tm.name}</div>
                        <div className="t-label text-muted-foreground truncate">{tm.jobTitle || tm.email || "-"}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          {tm.userId ? (
                            <span className="inline-flex items-center gap-1 t-micro px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              <ShieldCheck className="h-2.5 w-2.5" /> App user
                            </span>
                          ) : (
                            <span className="t-micro text-muted-foreground">Manual entry</span>
                          )}
                          <Link to="/team" className="t-micro text-primary hover:underline">Team profile</Link>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditing(s); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => {
                        if (s.source === "role_sync") {
                          toast.info("This person is on the sales team because their account holds the sales role. Change it in Users & Access.");
                          return;
                        }
                        if (confirm(`Remove ${tm.name} from the sales team?`)) salesMembersStore.remove(s.id);
                      }} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1 t-label px-2 py-1 rounded ${styles.cls}`}>
                      <Icon className="h-3 w-3" /> {styles.label}
                    </span>
                    <div className="flex gap-3 t-label text-muted-foreground font-tnum">
                      {s.role !== "closer" && <div><span className="text-foreground font-semibold">{acqClients}</span> clients</div>}
                      {s.role !== "acquisition" && <div><span className="text-foreground font-semibold">{closerOpps}</span> deals</div>}
                      <Link
                        to="/quotations"
                        search={{ sales: memberKey } as never}
                        className="hover:text-primary transition"
                        title={`Quotations for ${tm.name}`}
                      >
                        <span className="text-foreground font-semibold">{quotesCount}</span> quotes
                      </Link>
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
  const [showErrors, setShowErrors] = useState(false);

  const available = team.filter((t) => editing?.teamMemberId === t.id || !sales.some((s) => s.teamMemberId === t.id));

  useEffect(() => {
    if (!open) return;
    setShowErrors(false);
    if (editing) {
      setTeamMemberId(editing.teamMemberId);
      setRole(editing.role);
    } else {
      setTeamMemberId(available[0]?.id ?? "");
      setRole("acquisition");
    }
  }, [open, editing, available]);

  const submit = () => {
    if (!teamMemberId) {
      setShowErrors(true);
      return;
    }
    if (editing) salesMembersStore.update(editing.id, { teamMemberId, role });
    else salesMembersStore.add({ id: newId("sm"), teamMemberId, role });
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit sales member" : "Add sales member"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div>
            <Label><RequiredLabel>Team member</RequiredLabel></Label>
            <Select value={teamMemberId} onValueChange={setTeamMemberId} disabled={!!editing}>
              <SelectTrigger className={invalidFieldClassName(showErrors && !teamMemberId)} aria-invalid={showErrors && !teamMemberId}><SelectValue placeholder="Select a person" /></SelectTrigger>
              <SelectContent>
                {available.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="t-label text-muted-foreground mt-1">Only people in the Team database can be added.</p>
          </div>
          <div>
            <Label>Sales role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as SalesRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="acquisition">Acquisition - brings new clients</SelectItem>
                <SelectItem value="closer">Closer - finalizes deals</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
