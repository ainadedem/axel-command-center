import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTeamMembers, useSalesMembers,
  teamMembersStore, salesMembersStore,
  type TeamMember,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team")({ component: TeamPage });

function TeamPage() {
  const team = useTeamMembers();
  const sales = useSalesMembers();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const openCreate = () => { setEditing(null); setOpen(true); };

  const salesByTm = new Map(sales.map((s) => [s.teamMemberId, s]));

  const remove = (m: TeamMember) => {
    if (!confirm(`Remove ${m.name} from the team? This also removes them from the sales team.`)) return;
    const s = salesByTm.get(m.id);
    if (s) salesMembersStore.remove(s.id);
    teamMembersStore.remove(m.id);
  };

  return (
    <AppShell>
      <PageHeader title="Team" description="Everyone in the organization — the source of truth for people." />
      <div className="p-8 space-y-5">
        <CrudToolbar count={team.length} label="people" onCreate={openCreate} />
        {team.length === 0 ? (
          <EmptyState label="team members" onCreate={openCreate} />
        ) : (
          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Job title</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-1">Sales</div>
              <div className="col-span-1 text-right">·</div>
            </div>
            {team
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((m) => {
                const s = salesByTm.get(m.id);
                return (
                  <div key={m.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated/60 transition group">
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/30 to-chart-2/30 grid place-items-center text-[10px] font-semibold">
                        {m.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="text-sm font-medium truncate">{m.name}</div>
                    </div>
                    <div className="col-span-3 text-xs text-muted-foreground truncate">{m.email || "—"}</div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">{m.jobTitle || "—"}</div>
                    <div className="col-span-2 text-xs text-muted-foreground truncate">{m.department || "—"}</div>
                    <div className="col-span-1">
                      {s ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
                          <Users className="h-2.5 w-2.5" /> {s.role}
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setEditing(m); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => remove(m)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
      <TeamDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppShell>
  );
}

function TeamDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: TeamMember | null }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name); setEmail(editing.email ?? ""); setJobTitle(editing.jobTitle ?? ""); setDepartment(editing.department ?? "");
    } else {
      setName(""); setEmail(""); setJobTitle(""); setDepartment("");
    }
  }, [open, editing]);

  const submit = () => {
    if (!name.trim()) return;
    const data = { name: name.trim(), email: email.trim() || undefined, jobTitle: jobTitle.trim() || undefined, department: department.trim() || undefined };
    if (editing) teamMembersStore.update(editing.id, data);
    else teamMembersStore.add({ id: newId("tm"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit team member" : "New team member"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Job title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
            <div><Label>Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Add this person to the Sales team from the Sales team page to make them available as an Acquisition or Closer.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
