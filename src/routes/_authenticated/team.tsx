import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTeamMembers, useSalesMembers,
  teamMembersStore, salesMembersStore,
  type TeamMember,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { Fragment, useEffect, useMemo, useState } from "react";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/crud-toolbar";
import { Avatar, AvatarUpload } from "@/components/avatar-upload";
import { Pencil, Trash2, Users, ShieldCheck } from "lucide-react";
import { useSalesRoleSync } from "@/lib/use-sales-role-sync";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompany } from "@/lib/company-context";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";
import { DetailField, DetailPanel, DetailSection } from "@/components/master-detail";
import { ProjectsStylePageShell, ProjectsStyleToolbarGroup, RecordCountChip } from "@/components/projects-style-page-shell";

export const Route = createFileRoute("/_authenticated/team")({ component: TeamPage });

const TEAM_COLUMNS: ColumnDef[] = [
  { key: "lastName", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone", priority: "optional" },
  { key: "jobTitle", label: "Job" },
  { key: "department", label: "Department", priority: "optional" },
  { key: "company", label: "Company" },
  { key: "salesRole", label: "Sales", priority: "optional" },
];

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const cp = useColumnPrefs("team", TEAM_COLUMNS);
  const colCount = 2 + TEAM_COLUMNS.filter((c) => cp.on(c.key)).length;
  const selected = selectedId ? groups.flatMap((g) => g.items).find((m) => m.id === selectedId) ?? null : null;
  const selectedSales = selected ? salesByTm.get(selected.id) : undefined;
  const detail = selected ? (
    <DetailPanel
      eyebrow={companyLabel(selected.companyId)}
      title={selected.name}
      subtitle={selected.jobTitle ?? selected.department}
      onClose={() => setSelectedId(null)}
      actions={isAdmin ? (
        <>
          <Button size="sm" onClick={() => { setEditing(selected); setOpen(true); }} className="gap-1.5"><Pencil className="h-4 w-4" /> Edit</Button>
          <Button size="sm" variant="outline" onClick={() => remove(selected)} className="gap-1.5"><Trash2 className="h-4 w-4" /> Remove</Button>
        </>
      ) : undefined}
    >
      <DetailSection title="Contact">
        <DetailField label="Email" value={selected.email} />
        <DetailField label="Phone" value={selected.phone} mono />
        <DetailField label="App user" value={selected.userId ? "Linked" : "Not linked"} />
      </DetailSection>
      <DetailSection title="Organization">
        <DetailField label="Company" value={companyLabel(selected.companyId)} />
        <DetailField label="Department" value={selected.department} />
        <DetailField label="Sales role" value={selectedSales?.role ?? "—"} />
      </DetailSection>
    </DetailPanel>
  ) : null;

  const renderRow = (m: TeamMember) => {
    const s = salesByTm.get(m.id);
    return (
      <tr key={m.id} onClick={() => setSelectedId(m.id)} className="group hover-row border-b border-border/40 last:border-0">
        <ListRowActions>
          {isAdmin && (
            <>
              <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label={`Edit ${m.name}`} onClick={() => { setEditing(m); setOpen(true); }} />
              <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label={`Remove ${m.name}`} tone="danger" onClick={() => remove(m)} />
            </>
          )}
        </ListRowActions>
        <ListTd title={m.name}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar src={m.avatarUrl} name={m.name} size={24} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{m.firstName || m.name}</div>
              {m.userId && <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-primary"><ShieldCheck className="h-2.5 w-2.5" /> App user</div>}
            </div>
          </div>
        </ListTd>
        {cp.on("lastName") && <ListTd title={m.lastName}>{m.lastName || "—"}</ListTd>}
        {cp.on("email") && <ListTd className="text-xs text-muted-foreground" title={m.email}>{m.email || "—"}</ListTd>}
        {cp.on("phone") && <ListTd className="text-xs text-muted-foreground font-tnum" title={m.phone}>{m.phone || "—"}</ListTd>}
        {cp.on("jobTitle") && <ListTd className="text-xs" title={m.jobTitle}>{m.jobTitle || "—"}</ListTd>}
        {cp.on("department") && <ListTd className="text-xs text-muted-foreground" title={m.department}>{m.department || "—"}</ListTd>}
        {cp.on("company") && <ListTd title={companyLabel(m.companyId)}><CompanyChip value={companyLabel(m.companyId)} /></ListTd>}
        {cp.on("salesRole") && (
          <ListTd>
            {s ? <span className="inline-flex items-center gap-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"><Users className="h-2.5 w-2.5" /> {s.role}</span> : <span className="text-muted-foreground">—</span>}
          </ListTd>
        )}
      </tr>
    );
  };

  const header = <>
    <ListActionsTh width="3.25rem" />
    <ListTh width="16%">First name</ListTh>
    {cp.on("lastName") && <ListTh width="13%">Last name</ListTh>}
    {cp.on("email") && <ListTh width="20%">Email</ListTh>}
    {cp.on("phone") && <ListTh width="12%">Phone</ListTh>}
    {cp.on("jobTitle") && <ListTh width="13%">Job</ListTh>}
    {cp.on("department") && <ListTh width="11%">Department</ListTh>}
    {cp.on("company") && <ListTh width="10%">Company</ListTh>}
    {cp.on("salesRole") && <ListTh width="9%">Sales</ListTh>}
  </>;

  return (
    <AppShell>
      <PageHeader title="Team" description="Everyone in the organization - the source of truth for people." />
      <ProjectsStylePageShell
        detail={detail}
        toolbar={(
          <>
            <ProjectsStyleToolbarGroup>
              {isAdmin && <Button size="sm" onClick={openCreate} className="btn-new gap-1.5"><Users className="h-4 w-4" /> New team member</Button>}
              <RecordCountChip count={total} total={team.length} label="people" filtered={total !== team.length} />
            </ProjectsStyleToolbarGroup>
            <ProjectsStyleToolbarGroup>
              <DataToolbar view={view} items={team} iconOnly />
              <ColumnPicker prefs={cp} iconOnly />
            </ProjectsStyleToolbarGroup>
          </>
        )}
      >
        {team.length === 0 ? (
          isAdmin ? (
            <EmptyState label="team members" onCreate={openCreate} />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center text-sm text-muted-foreground">
              No team members yet. Ask an administrator to add people.
            </div>
          )
        ) : total === 0 ? (
          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 sm:p-10 lg:p-12 text-center text-sm text-muted-foreground">
            No people match the current filters.
          </div>
        ) : grouped ? (
          <ListTableShell>
            <ListTable>
              <thead><ListHeadRow>{header}</ListHeadRow></thead>
              <tbody>
            {groups.map((g) => (
              <Fragment key={g.key}>
                <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />
                {g.items.map(renderRow)}
              </Fragment>
            ))}
              </tbody>
            </ListTable>
          </ListTableShell>
        ) : (
          <ListTableShell>
            <ListTable>
              <thead><ListHeadRow>{header}</ListHeadRow></thead>
              <tbody>{groups[0].items.map(renderRow)}</tbody>
            </ListTable>
          </ListTableShell>
        )}
      </ProjectsStylePageShell>

      {isAdmin && <TeamDialog open={open} onOpenChange={setOpen} editing={editing} />}
    </AppShell>
  );
}

function CompanyChip({ value }: { value: string }) {
  return <span className="inline-flex max-w-full items-center rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground"><span className="truncate">{value}</span></span>;
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
  const [userId, setUserId] = useState<string>("none");
  const [showErrors, setShowErrors] = useState(false);
  const { scope, accessibleCompanies } = useCompany();
  const { users: appUsers } = useAppUsers();

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
      setUserId(editing.userId ?? "none");

    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setJobTitle("");
      setDepartment("");
      setAvatarUrl(undefined);
      setCompanyId(scope.id === "company" ? scope.companyId : "all");
      setUserId("none");
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
      userId: userId === "none" ? null : userId,
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
