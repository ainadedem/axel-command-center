import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useRecurringBillings, useCompanies, useClients, useProjects, useInvoices,
  recurringBillingsStore, invoicesStore, companyCode,
  fmtAmount, type RecurringBilling, type BillingFrequency, type Currency, type Invoice,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { nextNumber } from "@/lib/numbering";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO, addMonths, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Repeat, Play, Pause, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/billing")({ component: BillingPage });

function addPeriod(iso: string, freq: BillingFrequency): string {
  const months = freq === "monthly" ? 1 : freq === "quarterly" ? 3 : 12;
  return format(addMonths(parseISO(iso), months), "yyyy-MM-dd");
}

function BillingPage() {
  return (
    <AppShell>
      <PageHeader title="Billing" description="Recurring invoice schedules — generate invoices on cadence." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const all = useRecurringBillings();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const invoices = useInvoices();
  const list = inScope(all, scope).sort((a, b) => a.nextRunDate.localeCompare(b.nextRunDate));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringBilling | null>(null);

  const openCreate = () => { setEditing(null); setOpen(true); };

  const remove = (b: RecurringBilling) => {
    if (!confirm(`Delete the schedule "${b.name}"?`)) return;
    recurringBillingsStore.remove(b.id);
  };

  const toggleActive = (b: RecurringBilling) => {
    recurringBillingsStore.update(b.id, { active: !b.active });
  };

  const generateNow = (b: RecurringBilling) => {
    const issueDate = b.nextRunDate;
    const terms = b.paymentTermsDays ?? 30;
    const dueDate = format(new Date(parseISO(issueDate).getTime() + terms * 86400000), "yyyy-MM-dd");
    const inv: Invoice = {
      id: newId("inv"),
      number: nextNumber("invoice", b.companyId),
      companyId: b.companyId,
      clientId: b.clientId,
      projectId: b.projectId,
      issueDate,
      dueDate,
      amount: b.amount,
      paid: 0,
      currency: b.currency,
      status: "draft",
      lines: [{
        id: newId("line"),
        description: b.notes || b.name,
        unit: "fixed",
        quantity: 1,
        rate: b.amount,
      }],
    };
    invoicesStore.add(inv);
    recurringBillingsStore.update(b.id, {
      lastGeneratedAt: new Date().toISOString(),
      nextRunDate: addPeriod(issueDate, b.frequency),
    });
  };

  const totals = useMemo(() => {
    let mrr = 0;
    let dueSoon = 0;
    for (const b of list) {
      if (!b.active) continue;
      const monthly = b.frequency === "monthly" ? b.amount : b.frequency === "quarterly" ? b.amount / 3 : b.amount / 12;
      mrr += monthly;
      const days = differenceInDays(parseISO(b.nextRunDate), new Date());
      if (days <= 7) dueSoon += 1;
    }
    return { mrr, dueSoon };
  }, [list]);

  const defaultCurrency: Currency = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId)?.baseCurrency ?? "MGA"
    : "MGA";

  return (
    <div className="p-8 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Kpi label="Active schedules" value={String(list.filter((b) => b.active).length)} mono />
        <Kpi label="MRR equivalent" value={fmtAmount(totals.mrr, defaultCurrency)} accent="text-primary" />
        <Kpi label="Due in 7 days" value={String(totals.dueSoon)} mono accent={totals.dueSoon > 0 ? "text-warning" : undefined} />
      </div>

      <CrudToolbar count={list.length} label="schedules" onCreate={openCreate} />

      {list.length === 0 ? (
        <EmptyState label="recurring schedules" onCreate={openCreate} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Client</div>
            <div className="col-span-1">Company</div>
            <div className="col-span-1">Cadence</div>
            <div className="col-span-1 text-right">Amount</div>
            <div className="col-span-1">Next run</div>
            <div className="col-span-1">Last</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">·</div>
          </div>
          {list.map((b) => {
            const client = clients.find((c) => c.id === b.clientId);
            const company = companies.find((c) => c.id === b.companyId);
            const project = b.projectId ? projects.find((p) => p.id === b.projectId) : undefined;
            const days = differenceInDays(parseISO(b.nextRunDate), new Date());
            const isDue = b.active && days <= 0;
            const generatedCount = invoices.filter((i) =>
              i.companyId === b.companyId && i.clientId === b.clientId && (i.lines?.[0]?.description === (b.notes || b.name))
            ).length;
            return (
              <div key={b.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated/60 transition group">
                <div className="col-span-3 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                    {b.name}
                  </div>
                  {project && <div className="text-[11px] text-muted-foreground truncate ml-5">{project.name}</div>}
                </div>
                <div className="col-span-2 text-sm truncate">{client?.name ?? "—"}</div>
                <div className="col-span-1 text-[11px] font-mono text-muted-foreground">{companyCode(company)}</div>
                <div className="col-span-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider border border-border/60 text-muted-foreground">{b.frequency}</span>
                </div>
                <div className="col-span-1 text-right text-sm font-tnum font-medium">{fmtAmount(b.amount, b.currency)}</div>
                <div className="col-span-1 text-xs font-tnum">
                  <div className={cn(isDue && "text-warning font-medium")}>{format(parseISO(b.nextRunDate), "MMM d")}</div>
                  <div className="text-[10px] text-muted-foreground">{days < 0 ? `${-days}d overdue` : days === 0 ? "today" : `in ${days}d`}</div>
                </div>
                <div className="col-span-1 text-[11px] text-muted-foreground">
                  {b.lastGeneratedAt ? format(parseISO(b.lastGeneratedAt), "MMM d") : "—"}
                  {generatedCount > 0 && <div className="text-[10px]">{generatedCount} inv.</div>}
                </div>
                <div className="col-span-1">
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider border inline-flex items-center gap-1",
                    b.active ? "border-success/40 text-success bg-success/10" : "border-muted text-muted-foreground bg-muted/30",
                  )}>
                    {b.active ? "Active" : "Paused"}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                  {b.active && (
                    <button onClick={() => generateNow(b)} title="Generate invoice now" className="h-7 w-7 grid place-items-center rounded hover:bg-primary/10 text-muted-foreground hover:text-primary"><Zap className="h-3.5 w-3.5" /></button>
                  )}
                  <button onClick={() => toggleActive(b)} title={b.active ? "Pause" : "Resume"} className="h-7 w-7 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground">
                    {b.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button onClick={() => { setEditing(b); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(b)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BillingDialog open={open} onOpenChange={setOpen} editing={editing} defaultCurrency={defaultCurrency} />
    </div>
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

function BillingDialog({
  open, onOpenChange, editing, defaultCurrency,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: RecurringBilling | null; defaultCurrency: Currency }) {
  const { scope } = useCompany();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();

  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [frequency, setFrequency] = useState<BillingFrequency>("monthly");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState("");
  const [paymentTermsDays, setPaymentTermsDays] = useState("30");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setCompanyId(editing.companyId);
      setClientId(editing.clientId);
      setProjectId(editing.projectId ?? "");
      setAmount(String(editing.amount));
      setCurrency(editing.currency);
      setFrequency(editing.frequency);
      setStartDate(editing.startDate);
      setEndDate(editing.endDate ?? "");
      setPaymentTermsDays(String(editing.paymentTermsDays ?? 30));
      setActive(editing.active);
      setNotes(editing.notes ?? "");
    } else {
      setName("");
      setCompanyId(scope.id === "company" ? scope.companyId : companies[0]?.id ?? "");
      setClientId(""); setProjectId(""); setAmount(""); setCurrency(defaultCurrency);
      setFrequency("monthly");
      setStartDate(format(new Date(), "yyyy-MM-dd"));
      setEndDate(""); setPaymentTermsDays("30"); setActive(true); setNotes("");
    }
  }, [open, editing, defaultCurrency, scope, companies]);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!name.trim() || !companyId || !clientId || !amt) return;
    const data: Omit<RecurringBilling, "id"> = {
      name: name.trim(), companyId, clientId,
      projectId: projectId || undefined,
      amount: amt, currency, frequency,
      startDate,
      nextRunDate: editing?.nextRunDate ?? startDate,
      endDate: endDate || undefined,
      paymentTermsDays: parseInt(paymentTermsDays, 10) || 30,
      active,
      lastGeneratedAt: editing?.lastGeneratedAt,
      notes: notes.trim() || undefined,
    };
    if (editing) recurringBillingsStore.update(editing.id, data);
    else recurringBillingsStore.add({ id: newId("bil"), ...data });
    onOpenChange(false);
  };

  const scopedClients = clients.filter((c) => !companyId || c.companyId === companyId || (c.companyIds ?? []).includes(companyId));
  const scopedProjects = projects.filter((p) => (!companyId || p.companyId === companyId) && (!clientId || p.clientId === clientId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit schedule" : "New billing schedule"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly retainer — Acme" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{companyCode(c)} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {scopedClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Project (opt.)</Label>
              <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {scopedProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Amount per cycle</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as BillingFrequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End date (opt.)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div>
              <Label>Payment terms (days)</Label>
              <Input type="number" min="0" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Notes / line description</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Used as the invoice line description." />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch checked={active} onCheckedChange={setActive} />
            <span>Active (generates invoices on next run)</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !companyId || !clientId || !amount}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
