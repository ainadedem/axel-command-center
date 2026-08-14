import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTeamMembers, useSalesMembers,
  teamMembersStore, salesMembersStore,
  type TeamMember,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useEffect, useMemo, useState } from "react";
import { DataToolbar } from "@/components/data-toolbar";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Avatar, AvatarUpload } from "@/components/avatar-upload";
import { Pencil, Trash2, Users, ShieldCheck } from "lucide-react";
import { useSalesRoleSync } from "@/lib/use-sales-role-sync";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-context";
import { useEffectiveRole } from "@/lib/use-effective-role";

export const Route = createFileRoute("/_authenticated/team")({ component: TeamPage });

function TeamPage() {
  const allTeam = useTeamMembers();
  const { scope, accessibleCompanies } = useCompany();
  // Everyone with company access can see their people; only admins may change them.
  const { isAdmin } = useEffectiveRole();
  const team = scope.id === "group"
    ? allTeam
    : allTeam.filter((m) => m.companyId === undefined || m.companyId === scope.companyId);

  const companyById = new Map(accessibleCompanies.map((c) => [c.id, c]));
  const sales = useSalesMembers();
  useSalesRoleSync();
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

  const companyLabel = (id?: string | null) => {
    if (id === null) return "No company";
    if (id === undefined) return "All companies";
    return companyById.get(id)?.shortName || companyById.get(id)?.name || "-";
  };

  const fields = useMemo<FieldDef<TeamMember>[]>(() => [

    { key: "firstName", label: "First name", type: "string", accessor: (m) => m.firstName || m.name },
    { key: "lastName", label: "Last name", type: "string", accessor: (m) => m.lastName ?? "" },
    { key: "email", label: "Email", type: "string", accessor: (m) => m.email ?? "", noGroup: true },
    { key: "phone", label: "Phone", type: "string", accessor: (m) => m.phone ?? "", noGroup: true },
    { key: "jobTitle", label: "Job title", type: "enum", accessor: (m) => m.jobTitle ?? "" },
    { key: "department", label: "Department", type: "enum", accessor: (m) => m.department ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (m) => companyLabel(m.companyId) },
    { key: "salesRole", label: "Sales role", type: "enum", accessor: (m) => salesByTm.get(m.id)?.role ?? "—" },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [accessibleCompanies, sales]);

  const view = useDataView<TeamMember>("team", fields);
  const groups = view.apply(team);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const grouped = !!view.state.group;

  const renderRow = (m: TeamMember) => {
    const s = salesByTm.get(m.id);
    return (
      <div key={m.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated/60 transition group">
        <div className="col-span-2 flex items-center gap-2.5 min-w-0">
          <Avatar src={m.avatarUrl} name={m.name} size={28} />
          <div className="text-sm font-medium truncate">{m.firstName || m.name}</div>
        </div>
        <div className="col-span-2 text-sm truncate">{m.lastName || "-"}</div>
        <div className="col-span-2 text-xs text-muted-foreground truncate flex items-center gap-1.5">
          <span className="truncate">{m.email || "-"}</span>
          {m.userId && (
            <span title="Linked app user account" className="shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="h-2.5 w-2.5" /> App user
            </span>
          )}
        </div>
        <div className="col-span-2 text-xs text-muted-foreground truncate font-tnum">{m.phone || "-"}</div>
        <div className="col-span-1 text-xs text-muted-foreground truncate">{m.jobTitle || "-"}</div>
        <div className="col-span-1 text-xs truncate">
          {m.companyId === undefined ? (
            <span className="text-[10px] text-muted-foreground">All</span>
          ) : m.companyId === null ? (
            <span className="text-[10px] text-muted-foreground">None</span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent-foreground border border-border">
              {companyLabel(m.companyId)}
            </span>
          )}
        </div>

        <div className="col-span-1">
          {s ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 inline-flex items-center gap-1">
              <Users className="h-2.5 w-2.5" /> {s.role}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">-</span>
          )}
        </div>
        <div className="col-span-1 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100">
          {isAdmin && (
            <>
              <button onClick={() => { setEditing(m); setOpen(true); }} aria-label={`Edit ${m.name}`} className="h-7 w-7 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
              <button onClick={() => remove(m)} aria-label={`Remove ${m.name}`} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </>
          )}
        </div>
      </div>
    );
  };

  const header = (
    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
      <div className="col-span-2">First name</div>
      <div className="col-span-2">Last name</div>
      <div className="col-span-2">Email</div>
      <div className="col-span-2">Phone</div>
      <div className="col-span-1">Job</div>
      <div className="col-span-1">Company</div>
      <div className="col-span-1">Sales</div>
      <div className="col-span-1 text-right">.</div>
    </div>
  );

  return (
    <AppShell>
      <PageHeader title="Team" description="Everyone in the organization - the source of truth for people." />
      <div className="p-4 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {isAdmin ? (
            <CrudToolbar createLabel="New team member" count={total} label="people" onCreate={openCreate} />
          ) : (
            <div className="text-xs text-muted-foreground font-tnum">{total} people</div>
          )}
          <DataToolbar view={view} items={team} />
        </div>
        {team.length === 0 ? (
          isAdmin ? (
            <EmptyState label="team members" onCreate={openCreate} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center text-sm text-muted-foreground">
              No team members yet. Ask an administrator to add people.
            </div>
          )
        ) : total === 0 ? (
          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-4 sm:p-8 text-center text-sm text-muted-foreground">
            No people match the current filters.
          </div>
        ) : grouped ? (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key} className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-primary/5 border-b border-border">
                  <div className="text-xs font-medium">{g.label}</div>
                  <div className="text-[11px] text-muted-foreground font-tnum">{g.items.length}</div>
                </div>
                {header}
                {g.items.map(renderRow)}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
            {header}
            {groups[0].items.map(renderRow)}
          </div>
        )}
      </div>

      {isAdmin && <TeamDialog open={open} onOpenChange={setOpen} editing={editing} />}
    </AppShell>
  );
}

function TeamDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: TeamMember | null }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [companyId, setCompanyId] = useState<string>("all");
  const [showErrors, setShowErrors] = useState(false);
  const { scope, accessibleCompanies } = useCompany();

  useEffect(() => {
    if (!open) return;
    setShowErrors(false);
    if (editing) {
      const [fnFallback, ...rest] = (editing.name || "").trim().split(/\s+/);
      setFirstName(editing.firstName ?? fnFallback ?? "");
      setLastName(editing.lastName ?? rest.join(" "));
      setEmail(editing.email ?? "");
      setPhone(editing.phone ?? "");
      setJobTitle(editing.jobTitle ?? "");
      setDepartment(editing.department ?? "");
      setAvatarUrl(editing.avatarUrl);
      setCompanyId(editing.companyId === undefined ? "all" : editing.companyId === null ? "none" : editing.companyId);

    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setJobTitle("");
      setDepartment("");
      setAvatarUrl(undefined);
      setCompanyId(scope.id === "company" ? scope.companyId : "all");
    }
  }, [open, editing, scope]);

  const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const submit = () => {
    if (!displayName) {
      setShowErrors(true);
      return;
    }
    const data = {
      name: displayName,
      firstName: firstName.trim() || undefined,
      lastName: lastName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      jobTitle: jobTitle.trim() || undefined,
      department: department.trim() || undefined,
      avatarUrl,
      companyId: companyId === "all" ? undefined : companyId === "none" ? null : companyId,
    };

    if (editing) teamMembersStore.update(editing.id, data);
    else teamMembersStore.add({ id: newId("tm"), ...data });
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit team member" : "New team member"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div className="flex items-start gap-4">
            <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} name={displayName} size={72} />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label><RequiredLabel>First name</RequiredLabel></Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={invalidFieldClassName(showErrors && !displayName)} aria-invalid={showErrors && !displayName} /></div>
              <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} className={invalidFieldClassName(showErrors && !displayName)} aria-invalid={showErrors && !displayName} /></div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+261 ..." /></div>
          </div>
          <div>
            <Label>Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select a company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                <SelectItem value="none">No company</SelectItem>
                {accessibleCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              "All companies" shows the person in every company view. "No company" keeps them unassigned and only visible in the group view. A specific company limits them to that company.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Job title</Label><Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></div>
            <div><Label>Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Add this person to the Sales team from the Sales team page to make them available as an Acquisition or Closer.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
