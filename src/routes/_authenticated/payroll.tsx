import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useSalaryRegister, usePayrollRuns, useTeamMembers, useCompanies, useAccounts,
  salaryRegisterStore, payrollRunsStore, transactionsStore, companyCode,
  fmtAmount, type SalaryRegisterEntry, type PayrollRun, type PayrollEntry,
  type Currency, type Transaction,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/crud-toolbar";
import { Avatar } from "@/components/avatar-upload";
import { Pencil, Trash2, Users, CalendarDays, CheckCircle2, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { useSingleFlightSubmit } from "@/components/form-ux";
import { KpiCard } from "@/components/kpi-card";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";
import { DetailField, DetailPanel, DetailSection } from "@/components/master-detail";
import { ProjectsStylePageShell, ProjectsStyleToolbarGroup, RecordCountChip } from "@/components/projects-style-page-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchApprovedTimesheets } from "@/lib/time-attendance";
import { dbCompanyId } from "@/lib/db-sync";

export const Route = createFileRoute("/_authenticated/payroll")({ component: PayrollPage });

const REGISTER_COLUMNS: ColumnDef[] = [
  { key: "company", label: "Company" },
  { key: "gross", label: "Gross" },
  { key: "cnaps", label: "CNAPS", priority: "optional" },
  { key: "ostie", label: "OSTIE", priority: "optional" },
  { key: "irsa", label: "IRSA", priority: "optional" },
  { key: "net", label: "Net est." },
  { key: "startDate", label: "Since" },
  { key: "active", label: "Active", priority: "optional" },
];

const RUN_COLUMNS: ColumnDef[] = [
  { key: "company", label: "Company" },
  { key: "people", label: "People" },
  { key: "paid", label: "Paid" },
  { key: "gross", label: "Gross" },
  { key: "net", label: "Net" },
  { key: "status", label: "Status" },
];

function PayrollPage() {
  return (
    <AppShell>
      <PageHeader title="Payroll" description="Salary register and monthly payroll runs." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const [tab, setTab] = useState<"register" | "runs">("runs");
  return (
    <div className="space-y-3">
      <div className="px-4 sm:px-5 lg:px-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "register" | "runs")}>
          <TabsList className="h-9">
            <TabsTrigger value="runs" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Monthly runs</TabsTrigger>
            <TabsTrigger value="register" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Salary register</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {tab === "register" ? <RegisterTab /> : <RunsTab />}
    </div>
  );
}

/* ─── Register tab ─────────────────────────────────────────────────── */

function RegisterTab() {
  const { scope } = useCompany();
  const all = useSalaryRegister();
  const team = useTeamMembers();
  const companies = useCompanies();
  const baseList = inScope(all, scope).sort((a, b) => {
    const an = team.find((t) => t.id === a.teamMemberId)?.name ?? "";
    const bn = team.find((t) => t.id === b.teamMemberId)?.name ?? "";
    return an.localeCompare(bn);
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryRegisterEntry | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const remove = (e: SalaryRegisterEntry) => {
    if (!confirm("Remove this salary entry?")) return;
    salaryRegisterStore.remove(e.id);
    setSelectedId((id) => (id === e.id ? null : id));
  };

  const defaultCurrency: Currency = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId)?.baseCurrency ?? "MGA"
    : "MGA";

  const fields = useMemo<FieldDef<SalaryRegisterEntry>[]>(() => [
    { key: "person", label: "Person", type: "string", accessor: (e) => team.find((t) => t.id === e.teamMemberId)?.name ?? "", noGroup: true },
    { key: "company", label: "Company", type: "enum", accessor: (e) => companyCode(companies.find((c) => c.id === e.companyId)) },
    { key: "gross", label: "Gross", type: "number", accessor: (e) => e.gross, noGroup: true },
    { key: "net", label: "Net", type: "number", accessor: (e) => netSalary(e), noGroup: true },
    { key: "active", label: "Active", type: "boolean", accessor: (e) => e.active },
  ], [team, companies]);
  const view = useDataView<SalaryRegisterEntry>("payroll-register", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);
  const grouped = Boolean(view.state.group);
  const cp = useColumnPrefs("payroll-register", REGISTER_COLUMNS);
  const colCount = 2 + REGISTER_COLUMNS.filter((c) => cp.on(c.key)).length;
  const totalGross = list.filter((e) => e.active).reduce((sum, e) => sum + e.gross, 0);
  const totalNet = list.filter((e) => e.active).reduce((sum, e) => sum + netSalary(e), 0);
  const selected = selectedId ? list.find((e) => e.id === selectedId) ?? null : null;

  const detail = selected ? (() => {
    const member = team.find((t) => t.id === selected.teamMemberId);
    const company = companies.find((c) => c.id === selected.companyId);
    return (
      <DetailPanel
        eyebrow={company?.name ?? "Salary register"}
        title={member?.name ?? "Salary entry"}
        subtitle={member?.jobTitle}
        onClose={() => setSelectedId(null)}
        actions={(
          <>
            <Button size="sm" onClick={() => { setEditing(selected); setOpen(true); }} className="gap-1.5"><Pencil className="h-4 w-4" /> Edit</Button>
            <Button size="sm" variant="outline" onClick={() => remove(selected)} className="gap-1.5"><Trash2 className="h-4 w-4" /> Remove</Button>
          </>
        )}
      >
        <DetailSection title="Compensation">
          <DetailField label="Gross" value={fmtAmount(selected.gross, selected.currency)} mono />
          <DetailField label="CNAPS" value={fmtAmount(selected.gross * (selected.cnapsRate / 100), selected.currency)} mono />
          <DetailField label="OSTIE" value={fmtAmount(selected.gross * (selected.ostieRate / 100), selected.currency)} mono />
          <DetailField label="IRSA" value={fmtAmount(irsaAmount(selected), selected.currency)} mono />
          <DetailField label="Net est." value={fmtAmount(netSalary(selected), selected.currency)} mono />
        </DetailSection>
        <DetailSection title="Status">
          <DetailField label="Effective" value={format(parseISO(selected.startDate), "MMM yyyy")} mono />
          <DetailField label="Active" value={selected.active ? "Yes" : "No"} />
        </DetailSection>
      </DetailPanel>
    );
  })() : null;

  const renderRow = (e: SalaryRegisterEntry) => {
    const member = team.find((t) => t.id === e.teamMemberId);
    const company = companies.find((c) => c.id === e.companyId);
    const cnaps = e.gross * (e.cnapsRate / 100);
    const ostie = e.gross * (e.ostieRate / 100);
    const irsa = irsaAmount(e);
    const net = netSalary(e);
    return (
      <tr key={e.id} onClick={() => setSelectedId(e.id)} className={cn("group hover-row border-b border-border/40 last:border-0", !e.active && "opacity-60")}>
        <ListRowActions>
          <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit salary" onClick={() => { setEditing(e); setOpen(true); }} />
          <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Remove salary" tone="danger" onClick={() => remove(e)} />
        </ListRowActions>
        <ListTd title={member?.name}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar src={member?.avatarUrl} name={member?.name ?? "?"} size={24} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{member?.name ?? "—"}</div>
              <div className="truncate text-[11px] text-muted-foreground">{member?.jobTitle ?? ""}</div>
            </div>
          </div>
        </ListTd>
        {cp.on("company") && <ListTd className="text-[11px] font-tnum text-muted-foreground" title={company?.name}>{companyCode(company)}</ListTd>}
        {cp.on("gross") && <ListTd align="right" className="font-tnum font-medium" title={fmtAmount(e.gross, e.currency)}>{fmtAmount(e.gross, e.currency)}</ListTd>}
        {cp.on("cnaps") && <ListTd align="right" className="text-xs font-tnum text-muted-foreground">{fmtAmount(cnaps, e.currency)}</ListTd>}
        {cp.on("ostie") && <ListTd align="right" className="text-xs font-tnum text-muted-foreground">{fmtAmount(ostie, e.currency)}</ListTd>}
        {cp.on("irsa") && <ListTd align="right" className="text-xs font-tnum text-muted-foreground">{fmtAmount(irsa, e.currency)}</ListTd>}
        {cp.on("net") && <ListTd align="right" className="font-tnum text-success">{fmtAmount(net, e.currency)}</ListTd>}
        {cp.on("startDate") && <ListTd className="text-[11px] text-muted-foreground font-tnum">{format(parseISO(e.startDate), "MMM yyyy")}</ListTd>}
        {cp.on("active") && <ListTd><StatusPill tone={e.active ? "success" : "muted"}>{e.active ? "Active" : "Inactive"}</StatusPill></ListTd>}
      </tr>
    );
  };

  const header = <>
    <ListActionsTh width="3.25rem" />
    <ListTh width="21%">Person</ListTh>
    {cp.on("company") && <ListTh width="8%">Company</ListTh>}
    {cp.on("gross") && <ListTh width="14%" align="right">Gross</ListTh>}
    {cp.on("cnaps") && <ListTh width="10%" align="right">CNAPS</ListTh>}
    {cp.on("ostie") && <ListTh width="10%" align="right">OSTIE</ListTh>}
    {cp.on("irsa") && <ListTh width="10%" align="right">IRSA</ListTh>}
    {cp.on("net") && <ListTh width="13%" align="right">Net est.</ListTh>}
    {cp.on("startDate") && <ListTh width="10%">Since</ListTh>}
    {cp.on("active") && <ListTh width="9%">Active</ListTh>}
  </>;

  return (
    <ProjectsStylePageShell
      detail={detail}
      toolbar={(
        <>
          <ProjectsStyleToolbarGroup>
            <Button size="sm" onClick={openCreate} className="btn-new gap-1.5"><Plus className="h-4 w-4" /> New salary</Button>
            <RecordCountChip count={list.length} total={baseList.length} label="entries" filtered={list.length !== baseList.length} />
          </ProjectsStyleToolbarGroup>
          <ProjectsStyleToolbarGroup>
            <DataToolbar view={view} items={baseList} iconOnly />
            <ColumnPicker prefs={cp} iconOnly />
          </ProjectsStyleToolbarGroup>
        </>
      )}
      kpis={(
        <>
          <Kpi label="Active people" value={String(list.filter((e) => e.active).length)} />
          <Kpi label="Monthly gross" value={fmtAmount(totalGross, defaultCurrency)} accent="text-primary" />
          <Kpi label="Monthly net est." value={fmtAmount(totalNet, defaultCurrency)} accent="text-success" />
          <Kpi label="Inactive" value={String(list.filter((e) => !e.active).length)} />
        </>
      )}
    >
      {baseList.length === 0 ? (
        <EmptyState label="salary register entries" onCreate={openCreate} />
      ) : list.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">No salary entries match the current filters.</div>
      ) : (
        <ListTableShell>
          <ListTable>
            <thead><ListHeadRow>{header}</ListHeadRow></thead>
            <tbody>
              {grouped ? groups.map((g) => (
                <Fragment key={g.key}>
                  <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />
                  {g.items.map(renderRow)}
                </Fragment>
              )) : groups[0].items.map(renderRow)}
            </tbody>
          </ListTable>
        </ListTableShell>
      )}
      <RegisterDialog open={open} onOpenChange={setOpen} editing={editing} defaultCurrency={defaultCurrency} />
    </ProjectsStylePageShell>
  );
}

function RegisterDialog({
  open, onOpenChange, editing, defaultCurrency,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: SalaryRegisterEntry | null; defaultCurrency: Currency }) {
  const { scope } = useCompany();
  const team = useTeamMembers();
  const companies = useCompanies();

  const [teamMemberId, setTeamMemberId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [gross, setGross] = useState("");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [cnapsRate, setCnapsRate] = useState("1");
  const [ostieRate, setOstieRate] = useState("1");
  const [irsaRate, setIrsaRate] = useState("20");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTeamMemberId(editing.teamMemberId);
      setCompanyId(editing.companyId);
      setGross(String(editing.gross));
      setCurrency(editing.currency);
      setCnapsRate(String(editing.cnapsRate));
      setOstieRate(String(editing.ostieRate));
      setIrsaRate(String(editing.irsaRate));
      setStartDate(editing.startDate);
      setActive(editing.active);
    } else {
      setTeamMemberId(""); setCompanyId(scope.id === "company" ? scope.companyId : companies[0]?.id ?? "");
      setGross(""); setCurrency(defaultCurrency);
      setCnapsRate("1"); setOstieRate("1"); setIrsaRate("20");
      setStartDate(format(new Date(), "yyyy-MM-dd")); setActive(true);
    }
  }, [open, editing, defaultCurrency, scope, companies]);

  useReconciledSelection({
    open,
    currentValue: companyId,
    options: companies,
    getId: (company) => company.id,
    onChange: setCompanyId,
  });

  useReconciledSelection({
    open,
    currentValue: teamMemberId,
    options: team,
    getId: (member) => member.id,
    onChange: setTeamMemberId,
  });

  const teamOptions = useMemo(
    () => team
      .filter((m) => m.companyId === undefined || m.companyId === companyId)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [team, companyId],
  );

  const submit = () => {
    const g = parseFloat(gross);
    if (!teamMemberId || !companyId || !g) return;
    const data: Omit<SalaryRegisterEntry, "id"> = {
      teamMemberId, companyId,
      gross: g, currency,
      cnapsRate: parseFloat(cnapsRate) || 0,
      ostieRate: parseFloat(ostieRate) || 0,
      irsaRate: parseFloat(irsaRate) || 0,
      startDate, active,
    };
    if (editing) salaryRegisterStore.update(editing.id, data);
    else salaryRegisterStore.add({ id: newId("sal"), ...data });
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit salary" : "Add salary entry"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Team member</Label>
              <Select value={teamMemberId} onValueChange={setTeamMemberId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {teamOptions.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Employer company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{companyCode(c)} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Gross monthly</Label>
              <Input type="number" min="0" step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MGA">MGA</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>CNAPS %</Label>
              <Input type="number" min="0" step="0.1" value={cnapsRate} onChange={(e) => setCnapsRate(e.target.value)} />
            </div>
            <div>
              <Label>OSTIE %</Label>
              <Input type="number" min="0" step="0.1" value={ostieRate} onChange={(e) => setOstieRate(e.target.value)} />
            </div>
            <div>
              <Label>IRSA % (est.)</Label>
              <Input type="number" min="0" step="0.1" value={irsaRate} onChange={(e) => setIrsaRate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <Label>Effective since</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={active} onCheckedChange={setActive} />
              <span>Active</span>
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !teamMemberId || !companyId || !gross}>{editing ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Runs tab ─────────────────────────────────────────────────────── */

function RunsTab() {
  const { scope } = useCompany();
  const runs = usePayrollRuns();
  const register = useSalaryRegister();
  const team = useTeamMembers();
  const companies = useCompanies();
  const accounts = useAccounts();
  const baseList = inScope(runs, scope).sort((a, b) => b.month.localeCompare(a.month));

  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const defaultCurrency: Currency = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId)?.baseCurrency ?? "MGA"
    : "MGA";

  const validate = (run: PayrollRun) => {
    if (run.status === "validated") return;
    if (!confirm(`Validate payroll for ${run.month}? This will post accounting entries.`)) return;
    const txIds: string[] = [];
    const account = accounts.find((a) => a.companyId === run.companyId && a.currency === run.currency)
      ?? accounts.find((a) => a.companyId === run.companyId);
    if (!account) {
      alert("No account found for this company. Create one first.");
      return;
    }
    const monthEnd = format(new Date(`${run.month}-01T00:00:00`), "yyyy-MM-") + "28";
    for (const e of run.entries) {
      const member = team.find((t) => t.id === e.teamMemberId);
      const memberName = member?.name ?? "—";
      const tx: Transaction = {
        id: newId("tx"),
        companyId: run.companyId,
        accountId: account.id,
        date: monthEnd,
        type: "expense",
        category: "Payroll",
        description: `Salaire ${run.month} — ${memberName}`,
        amount: e.gross,
        currency: run.currency,
        source: "manual",
      };
      transactionsStore.add(tx); txIds.push(tx.id);
    }
    payrollRunsStore.update(run.id, {
      status: "validated",
      validatedAt: new Date().toISOString(),
      postedTransactionIds: txIds,
    });
  };

  const reopen = (run: PayrollRun) => {
    if (!confirm("Reopen this run? Posted transactions will be removed.")) return;
    for (const id of run.postedTransactionIds ?? []) transactionsStore.remove(id);
    payrollRunsStore.update(run.id, { status: "draft", validatedAt: undefined, postedTransactionIds: [] });
  };

  const remove = (run: PayrollRun) => {
    if (!confirm("Delete this run? Posted transactions will be removed.")) return;
    for (const id of run.postedTransactionIds ?? []) transactionsStore.remove(id);
    payrollRunsStore.remove(run.id);
    setSelectedId((id) => (id === run.id ? null : id));
  };

  const togglePaid = (run: PayrollRun, tmId: string) => {
    const entries = run.entries.map((e) => e.teamMemberId === tmId ? { ...e, paid: !e.paid } : e);
    payrollRunsStore.update(run.id, { entries });
  };

  const fields = useMemo<FieldDef<PayrollRun>[]>(() => [
    { key: "month", label: "Month", type: "string", accessor: (r) => r.month, noGroup: true },
    { key: "company", label: "Company", type: "enum", accessor: (r) => companyCode(companies.find((c) => c.id === r.companyId)) },
    { key: "status", label: "Status", type: "enum", accessor: (r) => r.status },
    { key: "people", label: "People", type: "number", accessor: (r) => r.entries.length, noGroup: true },
    { key: "gross", label: "Gross", type: "number", accessor: (r) => grossOfRun(r), noGroup: true },
    { key: "net", label: "Net", type: "number", accessor: (r) => netOfRun(r), noGroup: true },
  ], [companies]);
  const view = useDataView<PayrollRun>("payroll-runs", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);
  const grouped = Boolean(view.state.group);
  const cp = useColumnPrefs("payroll-runs", RUN_COLUMNS);
  const colCount = 2 + RUN_COLUMNS.filter((c) => cp.on(c.key)).length;

  const totals = useMemo(() => {
    let gross = 0, net = 0, runCount = 0, people = 0;
    for (const r of list) {
      runCount += 1;
      people += r.entries.length;
      gross += grossOfRun(r);
      net += netOfRun(r);
    }
    return { gross, net, runs: runCount, people };
  }, [list]);

  const selected = selectedId ? list.find((r) => r.id === selectedId) ?? null : null;
  const detail = selected ? (() => {
    const company = companies.find((c) => c.id === selected.companyId);
    const paidCount = selected.entries.filter((e) => e.paid).length;
    return (
      <DetailPanel
        eyebrow={company?.name ?? "Payroll run"}
        title={format(new Date(`${selected.month}-01T00:00:00`), "MMMM yyyy")}
        subtitle={`${selected.entries.length} people · ${paidCount} paid`}
        onClose={() => setSelectedId(null)}
        actions={(
          <>
            {selected.status === "draft" ? (
              <Button size="sm" onClick={() => validate(selected)} className="gap-1.5"><CheckCircle2 className="h-4 w-4" /> Validate</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => reopen(selected)} className="gap-1.5"><RotateCcw className="h-4 w-4" /> Reopen</Button>
            )}
            <Button size="sm" variant="outline" onClick={() => remove(selected)} className="gap-1.5"><Trash2 className="h-4 w-4" /> Delete</Button>
          </>
        )}
      >
        <DetailSection title="Summary">
          <DetailField label="Status" value={selected.status} />
          <DetailField label="Gross" value={fmtAmount(grossOfRun(selected), selected.currency)} mono />
          <DetailField label="Net" value={fmtAmount(netOfRun(selected), selected.currency)} mono />
          <DetailField label="Paid" value={`${paidCount}/${selected.entries.length}`} mono />
        </DetailSection>
        <DetailSection title="People">
          <div className="space-y-1.5">
            {selected.entries.map((entry) => {
              const member = team.find((t) => t.id === entry.teamMemberId);
              return (
                <button key={entry.teamMemberId} type="button" onClick={() => togglePaid(selected, entry.teamMemberId)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-surface">
                  <span className="min-w-0 truncate text-xs">{member?.name ?? "—"}</span>
                  <span className={cn("rounded border px-1.5 py-0.5 text-[10px]", entry.paid ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground")}>{entry.paid ? "Paid" : "Pending"}</span>
                </button>
              );
            })}
          </div>
        </DetailSection>
      </DetailPanel>
    );
  })() : null;

  const renderRow = (r: PayrollRun) => {
    const company = companies.find((c) => c.id === r.companyId);
    const grossSum = grossOfRun(r);
    const netSum = netOfRun(r);
    const paidCount = r.entries.filter((e) => e.paid).length;
    return (
      <tr key={r.id} onClick={() => setSelectedId(r.id)} className="group hover-row border-b border-border/40 last:border-0">
        <ListRowActions>
          {r.status === "draft" ? (
            <RowAction icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Validate run" tone="success" onClick={() => validate(r)} />
          ) : (
            <RowAction icon={<RotateCcw className="h-3.5 w-3.5" />} label="Reopen run" onClick={() => reopen(r)} />
          )}
          <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete run" tone="danger" onClick={() => remove(r)} />
        </ListRowActions>
        <ListTd title={r.month}>
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{format(new Date(`${r.month}-01T00:00:00`), "MMMM yyyy")}</span>
          </div>
        </ListTd>
        {cp.on("company") && <ListTd className="text-[11px] font-tnum text-muted-foreground" title={company?.name}>{companyCode(company)}</ListTd>}
        {cp.on("people") && <ListTd className="font-tnum">{r.entries.length}</ListTd>}
        {cp.on("paid") && <ListTd className="font-tnum">{paidCount}/{r.entries.length}</ListTd>}
        {cp.on("gross") && <ListTd align="right" className="font-tnum" title={fmtAmount(grossSum, r.currency)}>{fmtAmount(grossSum, r.currency)}</ListTd>}
        {cp.on("net") && <ListTd align="right" className="font-tnum text-success" title={fmtAmount(netSum, r.currency)}>{fmtAmount(netSum, r.currency)}</ListTd>}
        {cp.on("status") && <ListTd><StatusPill tone={r.status === "validated" ? "success" : "muted"}>{r.status}</StatusPill></ListTd>}
      </tr>
    );
  };

  const header = <>
    <ListActionsTh width="3.25rem" />
    <ListTh width="25%">Month</ListTh>
    {cp.on("company") && <ListTh width="10%">Company</ListTh>}
    {cp.on("people") && <ListTh width="9%">People</ListTh>}
    {cp.on("paid") && <ListTh width="9%">Paid</ListTh>}
    {cp.on("gross") && <ListTh width="16%" align="right">Gross</ListTh>}
    {cp.on("net") && <ListTh width="16%" align="right">Net</ListTh>}
    {cp.on("status") && <ListTh width="12%">Status</ListTh>}
  </>;

  return (
    <ProjectsStylePageShell
      detail={detail}
      toolbar={(
        <>
          <ProjectsStyleToolbarGroup>
            <Button size="sm" onClick={() => setCreating(true)} className="btn-new gap-1.5"><Plus className="h-4 w-4" /> New monthly run</Button>
            <RecordCountChip count={list.length} total={baseList.length} label="runs" filtered={list.length !== baseList.length} />
          </ProjectsStyleToolbarGroup>
          <ProjectsStyleToolbarGroup>
            <DataToolbar view={view} items={baseList} iconOnly />
            <ColumnPicker prefs={cp} iconOnly />
          </ProjectsStyleToolbarGroup>
        </>
      )}
      kpis={(
        <>
          <Kpi label="Runs" value={String(totals.runs)} />
          <Kpi label="People paid" value={String(totals.people)} />
          <Kpi label="Gross" value={fmtAmount(totals.gross, defaultCurrency)} accent="text-primary" />
          <Kpi label="Net" value={fmtAmount(totals.net, defaultCurrency)} accent="text-success" />
        </>
      )}
    >
      {baseList.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="mb-4 text-sm text-muted-foreground">No payroll runs yet.</p>
          <Button size="sm" onClick={() => setCreating(true)} className="btn-new gap-1.5"><Plus className="h-4 w-4" /> Create first run</Button>
        </div>
      ) : list.length === 0 ? (
        <div className="panel p-8 text-center text-sm text-muted-foreground">No payroll runs match the current filters.</div>
      ) : (
        <ListTableShell>
          <ListTable>
            <thead><ListHeadRow>{header}</ListHeadRow></thead>
            <tbody>
              {grouped ? groups.map((g) => (
                <Fragment key={g.key}>
                  <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />
                  {g.items.map(renderRow)}
                </Fragment>
              )) : groups[0].items.map(renderRow)}
            </tbody>
          </ListTable>
        </ListTableShell>
      )}
      {creating && <NewRunDialog onClose={() => setCreating(false)} register={register} />}
    </ProjectsStylePageShell>
  );
}

function NewRunDialog({ onClose, register }: { onClose: () => void; register: SalaryRegisterEntry[] }) {
  const { scope } = useCompany();
  const companies = useCompanies();
  const team = useTeamMembers();
  const [companyId, setCompanyId] = useState(scope.id === "company" ? scope.companyId : companies[0]?.id ?? "");
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));

  const eligible = register.filter((e) => e.active && e.companyId === companyId);
  const currency: Currency = eligible[0]?.currency ?? companies.find((c) => c.id === companyId)?.baseCurrency ?? "MGA";

  // Approved timesheets feed real worked hours into the run: overtime adds to
  // gross, unpaid leave is deducted.
  const [worked, setWorked] = useState<Record<string, { overtime: number; unpaid: number; regular: number }>>({});
  useEffect(() => {
    const dbId = companyId ? dbCompanyId(companyId) : undefined;
    if (!dbId || !month) { setWorked({}); return; }
    let cancelled = false;
    void (async () => {
      try {
        const sheets = await fetchApprovedTimesheets(dbId, month);
        if (cancelled) return;
        const acc: Record<string, { overtime: number; unpaid: number; regular: number }> = {};
        for (const s of sheets) {
          const cur = acc[s.employeeId] ?? { overtime: 0, unpaid: 0, regular: 0 };
          acc[s.employeeId] = {
            overtime: cur.overtime + s.overtimeMinutes,
            unpaid: cur.unpaid + s.unpaidLeaveMinutes,
            regular: cur.regular + s.regularMinutes,
          };
        }
        setWorked(acc);
      } catch { if (!cancelled) setWorked({}); }
    })();
    return () => { cancelled = true; };
  }, [companyId, month]);

  const hoursFor = (teamMemberId: string) => {
    const userId = team.find((t) => t.id === teamMemberId)?.userId;
    return (userId && worked[userId]) || null;
  };
  const timesheetPeople = eligible.filter((e) => hoursFor(e.teamMemberId)).length;

  useReconciledSelection({
    open: true,
    currentValue: companyId,
    options: companies,
    getId: (company) => company.id,
    onChange: setCompanyId,
  });

  const submit = () => {
    if (!companyId || !month || eligible.length === 0) return;
    const entries: PayrollEntry[] = eligible.map((s) => {
      const w = hoursFor(s.teamMemberId);
      // Madagascar legal monthly base: 173.33 hours.
      const hourly = s.gross / 173.33;
      const overtimeAmount = w ? Math.round((w.overtime / 60) * hourly * 1.3) : 0;
      const unpaidDeduction = w ? Math.round((w.unpaid / 60) * hourly) : 0;
      const gross = Math.max(0, s.gross + overtimeAmount - unpaidDeduction);
      const cnaps = gross * (s.cnapsRate / 100);
      const ostie = gross * (s.ostieRate / 100);
      const taxable = gross - cnaps - ostie;
      const irsa = Math.max(0, taxable * (s.irsaRate / 100));
      const net = gross - cnaps - ostie - irsa;
      return {
        teamMemberId: s.teamMemberId, gross, cnaps, ostie, irsa, net, paid: false,
        regularMinutes: w?.regular, overtimeMinutes: w?.overtime,
        overtimeAmount: overtimeAmount || undefined,
        unpaidLeaveMinutes: w?.unpaid,
        unpaidDeduction: unpaidDeduction || undefined,
      };
    });
    const run: PayrollRun = {
      id: newId("run"),
      companyId, month, status: "draft", currency, entries,
    };
    payrollRunsStore.add(run);
    onClose();
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New monthly payroll run</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{companyCode(c)} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface/50 p-3 text-xs">
            <div className="text-muted-foreground mb-1.5">
              {timesheetPeople > 0
                ? `Approved timesheets found for ${timesheetPeople} of ${eligible.length} people — overtime is added and unpaid leave deducted.`
                : "No approved timesheets for this month — base salaries are used as-is."}
            </div>
            <div className="text-muted-foreground mb-1.5">Will create a draft run for <span className="text-foreground font-medium">{eligible.length}</span> active register entr{eligible.length === 1 ? "y" : "ies"}.</div>
            {eligible.length === 0 ? (
              <div className="text-muted-foreground italic">No active salary register entries for this company.</div>
            ) : (
              <ul className="space-y-0.5">
                {eligible.map((e) => {
                  const member = team.find((t) => t.id === e.teamMemberId);
                  return <li key={e.id} className="font-tnum">{member?.name ?? "—"} — {fmtAmount(e.gross, e.currency)}</li>;
                })}
              </ul>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !companyId || !month || eligible.length === 0}>Create draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function cnapsAmount(entry: SalaryRegisterEntry) {
  return entry.gross * (entry.cnapsRate / 100);
}

function ostieAmount(entry: SalaryRegisterEntry) {
  return entry.gross * (entry.ostieRate / 100);
}

function irsaAmount(entry: SalaryRegisterEntry) {
  const taxable = entry.gross - cnapsAmount(entry) - ostieAmount(entry);
  return Math.max(0, taxable * (entry.irsaRate / 100));
}

function netSalary(entry: SalaryRegisterEntry) {
  return entry.gross - cnapsAmount(entry) - ostieAmount(entry) - irsaAmount(entry);
}

function grossOfRun(run: PayrollRun) {
  return run.entries.reduce((sum, entry) => sum + entry.gross, 0);
}

function netOfRun(run: PayrollRun) {
  return run.entries.reduce((sum, entry) => sum + entry.net, 0);
}

function StatusPill({ tone, children }: { tone: "success" | "muted"; children: ReactNode }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.04em]",
      tone === "success" ? "border-success/40 bg-success/10 text-success" : "border-border bg-muted/30 text-muted-foreground",
    )}>
      {children}
    </span>
  );
}

/** Thin wrapper so legacy call sites keep working on the shared dashboard card. */
function Kpi({ label, value, accent }: { label: string; value: string; accent?: string; mono?: boolean }) {
  const tone = accent?.includes("destructive") ? "danger" : accent?.includes("success") ? "success" : accent?.includes("warn") || accent?.includes("amber") ? "warning" : "default";
  return <KpiCard label={label} value={value} tone={tone} />;
}
