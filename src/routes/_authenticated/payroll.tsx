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
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Avatar } from "@/components/avatar-upload";
import { Pencil, Trash2, Users, CalendarDays, CheckCircle2, BanknoteIcon, Plus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/payroll")({ component: PayrollPage });

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
    <div className="p-8 space-y-5">
      <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
        <button
          onClick={() => setTab("runs")}
          className={cn("px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition",
            tab === "runs" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          <CalendarDays className="h-3.5 w-3.5" /> Monthly runs
        </button>
        <button
          onClick={() => setTab("register")}
          className={cn("px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition",
            tab === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          <Users className="h-3.5 w-3.5" /> Salary register
        </button>
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
  const list = inScope(all, scope).sort((a, b) => {
    const an = team.find((t) => t.id === a.teamMemberId)?.name ?? "";
    const bn = team.find((t) => t.id === b.teamMemberId)?.name ?? "";
    return an.localeCompare(bn);
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryRegisterEntry | null>(null);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const remove = (e: SalaryRegisterEntry) => {
    if (!confirm("Remove this salary entry?")) return;
    salaryRegisterStore.remove(e.id);
  };

  const defaultCurrency: Currency = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId)?.baseCurrency ?? "MGA"
    : "MGA";

  const totalGross = list.filter((e) => e.active).reduce((s, e) => s + e.gross, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="People on register" value={String(list.filter((e) => e.active).length)} mono />
        <Kpi label="Monthly gross total" value={fmtAmount(totalGross, defaultCurrency)} accent="text-primary" />
        <Kpi label="Inactive entries" value={String(list.filter((e) => !e.active).length)} mono />
      </div>
      <CrudToolbar count={list.length} label="register entries" onCreate={openCreate} />
      {list.length === 0 ? (
        <EmptyState label="salary register entries" onCreate={openCreate} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-3">Person</div>
            <div className="col-span-1">Company</div>
            <div className="col-span-2 text-right">Gross</div>
            <div className="col-span-1 text-right">CNAPS</div>
            <div className="col-span-1 text-right">OSTIE</div>
            <div className="col-span-1 text-right">IRSA</div>
            <div className="col-span-1 text-right">Net est.</div>
            <div className="col-span-1">Since</div>
            <div className="col-span-1 text-right">·</div>
          </div>
          {list.map((e) => {
            const member = team.find((t) => t.id === e.teamMemberId);
            const company = companies.find((c) => c.id === e.companyId);
            const cnaps = e.gross * (e.cnapsRate / 100);
            const ostie = e.gross * (e.ostieRate / 100);
            const taxable = e.gross - cnaps - ostie;
            const irsa = Math.max(0, taxable * (e.irsaRate / 100));
            const net = e.gross - cnaps - ostie - irsa;
            return (
              <div key={e.id} className={cn("grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated/60 transition group", !e.active && "opacity-60")}>
                <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                  <Avatar src={member?.avatarUrl} name={member?.name ?? "?"} size={28} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{member?.name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{member?.jobTitle ?? ""}</div>
                  </div>
                </div>
                <div className="col-span-1 text-[11px] font-mono text-muted-foreground">{companyCode(company)}</div>
                <div className="col-span-2 text-right text-sm font-tnum font-medium">{fmtAmount(e.gross, e.currency)}</div>
                <div className="col-span-1 text-right text-xs font-tnum text-muted-foreground">{fmtAmount(cnaps, e.currency)}</div>
                <div className="col-span-1 text-right text-xs font-tnum text-muted-foreground">{fmtAmount(ostie, e.currency)}</div>
                <div className="col-span-1 text-right text-xs font-tnum text-muted-foreground">{fmtAmount(irsa, e.currency)}</div>
                <div className="col-span-1 text-right text-sm font-tnum text-success">{fmtAmount(net, e.currency)}</div>
                <div className="col-span-1 text-[11px] text-muted-foreground font-tnum">{format(parseISO(e.startDate), "MMM yyyy")}</div>
                <div className="col-span-1 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                  <button onClick={() => { setEditing(e); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(e)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <RegisterDialog open={open} onOpenChange={setOpen} editing={editing} defaultCurrency={defaultCurrency} />
    </div>
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit salary" : "Add salary entry"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Team member</Label>
              <Select value={teamMemberId} onValueChange={setTeamMemberId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {team.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-3 gap-3">
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
          <div className="grid grid-cols-2 gap-3 items-end">
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
          <Button onClick={submit} disabled={!teamMemberId || !companyId || !gross}>{editing ? "Save" : "Add"}</Button>
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
  const list = inScope(runs, scope).sort((a, b) => b.month.localeCompare(a.month));

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<PayrollRun | null>(null);

  const defaultCurrency: Currency = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId)?.baseCurrency ?? "MGA"
    : "MGA";

  const validate = (run: PayrollRun) => {
    if (run.status === "validated") return;
    if (!confirm(`Validate payroll for ${run.month}? This will post accounting entries.`)) return;
    const txIds: string[] = [];
    const company = companies.find((c) => c.id === run.companyId);
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
      // Gross salary expense → 641
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
  };

  const togglePaid = (run: PayrollRun, tmId: string) => {
    const entries = run.entries.map((e) => e.teamMemberId === tmId ? { ...e, paid: !e.paid } : e);
    payrollRunsStore.update(run.id, { entries });
  };

  const totals = useMemo(() => {
    let gross = 0, net = 0, runs = 0;
    for (const r of list) {
      runs += 1;
      for (const e of r.entries) { gross += e.gross; net += e.net; }
    }
    return { gross, net, runs };
  }, [list]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Runs" value={String(totals.runs)} mono />
        <Kpi label="Total gross paid" value={fmtAmount(totals.gross, defaultCurrency)} accent="text-primary" />
        <Kpi label="Total net paid" value={fmtAmount(totals.net, defaultCurrency)} accent="text-success" />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> New monthly run
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No payroll runs yet.</p>
          <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create first run
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const company = companies.find((c) => c.id === r.companyId);
            const grossSum = r.entries.reduce((s, e) => s + e.gross, 0);
            const netSum = r.entries.reduce((s, e) => s + e.net, 0);
            const paidCount = r.entries.filter((e) => e.paid).length;
            return (
              <div key={r.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-4 border-b border-border/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(`${r.month}-01T00:00:00`), "MMMM yyyy")}
                      <span className="text-[11px] font-mono text-muted-foreground">· {companyCode(company)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.entries.length} people · {paidCount} paid
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gross / Net</div>
                    <div className="text-sm font-tnum">{fmtAmount(grossSum, r.currency)} · <span className="text-success">{fmtAmount(netSum, r.currency)}</span></div>
                  </div>
                  <span className={cn(
                    "text-[10px] px-2 py-1 rounded uppercase tracking-wider border",
                    r.status === "validated" ? "border-success/40 text-success bg-success/10" : "border-muted text-muted-foreground bg-muted/30",
                  )}>{r.status}</span>
                  <button onClick={() => setViewing(viewing?.id === r.id ? null : r)} className="text-xs text-primary hover:underline">
                    {viewing?.id === r.id ? "Hide" : "Details"}
                  </button>
                  {r.status === "draft" ? (
                    <Button size="sm" onClick={() => validate(r)} className="gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Validate
                    </Button>
                  ) : (
                    <button onClick={() => reopen(r)} title="Reopen" className="h-8 w-8 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><RotateCcw className="h-4 w-4" /></button>
                  )}
                  <button onClick={() => remove(r)} className="h-8 w-8 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
                {viewing?.id === r.id && (
                  <div>
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <div className="col-span-3">Person</div>
                      <div className="col-span-2 text-right">Gross</div>
                      <div className="col-span-1 text-right">CNAPS</div>
                      <div className="col-span-1 text-right">OSTIE</div>
                      <div className="col-span-1 text-right">IRSA</div>
                      <div className="col-span-2 text-right">Net</div>
                      <div className="col-span-2 text-right">Paid?</div>
                    </div>
                    {r.entries.map((e) => {
                      const member = team.find((t) => t.id === e.teamMemberId);
                      return (
                        <div key={e.teamMemberId} className="grid grid-cols-12 gap-2 px-4 py-2 items-center border-b border-border/40 last:border-0 text-sm">
                          <div className="col-span-3 flex items-center gap-2.5 min-w-0">
                            <Avatar src={member?.avatarUrl} name={member?.name ?? "?"} size={24} />
                            <div className="truncate">{member?.name ?? "—"}</div>
                          </div>
                          <div className="col-span-2 text-right font-tnum">{fmtAmount(e.gross, r.currency)}</div>
                          <div className="col-span-1 text-right text-xs font-tnum text-muted-foreground">{fmtAmount(e.cnaps, r.currency)}</div>
                          <div className="col-span-1 text-right text-xs font-tnum text-muted-foreground">{fmtAmount(e.ostie, r.currency)}</div>
                          <div className="col-span-1 text-right text-xs font-tnum text-muted-foreground">{fmtAmount(e.irsa, r.currency)}</div>
                          <div className="col-span-2 text-right font-tnum text-success">{fmtAmount(e.net, r.currency)}</div>
                          <div className="col-span-2 text-right">
                            <button
                              onClick={() => togglePaid(r, e.teamMemberId)}
                              className={cn(
                                "text-[10px] px-2 py-1 rounded uppercase tracking-wider border inline-flex items-center gap-1",
                                e.paid ? "border-success/40 text-success bg-success/10" : "border-muted text-muted-foreground bg-muted/30 hover:bg-muted/50",
                              )}
                            >
                              <BanknoteIcon className="h-2.5 w-2.5" /> {e.paid ? "Paid" : "Pending"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {creating && <NewRunDialog onClose={() => setCreating(false)} register={register} />}
    </div>
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

  const submit = () => {
    if (!companyId || !month || eligible.length === 0) return;
    const entries: PayrollEntry[] = eligible.map((s) => {
      const cnaps = s.gross * (s.cnapsRate / 100);
      const ostie = s.gross * (s.ostieRate / 100);
      const taxable = s.gross - cnaps - ostie;
      const irsa = Math.max(0, taxable * (s.irsaRate / 100));
      const net = s.gross - cnaps - ostie - irsa;
      return { teamMemberId: s.teamMemberId, gross: s.gross, cnaps, ostie, irsa, net, paid: false };
    });
    const run: PayrollRun = {
      id: newId("run"),
      companyId, month, status: "draft", currency, entries,
    };
    payrollRunsStore.add(run);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>New monthly payroll run</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
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
          <Button onClick={submit} disabled={!companyId || !month || eligible.length === 0}>Create draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Kpi({ label, value, accent, mono }: { label: string; value: string; accent?: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-display font-semibold", mono && "font-tnum", accent)}>{value}</div>
    </div>
  );
}
