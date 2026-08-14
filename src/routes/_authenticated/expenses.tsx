import { createFileRoute } from "@tanstack/react-router";
import { focusSearch, useFocusRow, focusRowById } from "@/hooks/use-focus-row";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useExpenses, useCompanies, useSuppliers, useAccounts,
  expensesStore, companyCode,
  fmtAmount, type Expense, type ExpenseKind, type ExpenseStatus, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useAuth } from "@/lib/auth-context";
import { inScope, useCompany } from "@/lib/company-context";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { buildAging, inBucket, type AgingKey } from "@/lib/aging";
import { AgingPanel } from "@/components/aging-panel";
import { KpiCard } from "@/components/kpi-card";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Receipt, FileText, BanknoteIcon, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";

export const Route = createFileRoute("/_authenticated/expenses")({ component: ExpensesPage, validateSearch: focusSearch });

const statusStyles: Record<ExpenseStatus, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  unpaid: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  partial: "border-warning/40 text-warning bg-warning/10",
  paid: "border-success/40 text-success bg-success/10",
  overdue: "border-destructive/40 text-destructive bg-destructive/10",
  cancelled: "border-muted-foreground/30 text-muted-foreground bg-muted/20 line-through",
};

function computeStatus(e: Expense): ExpenseStatus {
  if (e.status === "draft" || e.status === "cancelled") return e.status;
  if (e.paid >= e.amount) return "paid";
  if (e.paid > 0) return "partial";
  if (e.dueDate && differenceInDays(new Date(), parseISO(e.dueDate)) > 0) return "overdue";
  return "unpaid";
}

function ExpensesPage() {
  useFocusRow(Route.useSearch().focus);
  return (
    <AppShell>
      <PageHeader title="Expenses" description="Supplier bills and ad-hoc expense entries." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const allExpenses = useExpenses();
  const companies = useCompanies();
  const suppliers = useSuppliers();
  const accounts = useAccounts();
  const list = inScope(allExpenses, scope);

  const [tab, setTab] = useState<"all" | ExpenseKind>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [defaultKind, setDefaultKind] = useState<ExpenseKind>("bill");

  const [bucket, setBucket] = useState<AgingKey | null>(null);

  const tabFiltered = useMemo(
    () => list.filter((e) => tab === "all" || e.kind === tab).sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    [list, tab],
  );

  // Payables aging shares the exact bucket definitions used by receivables.
  const aging = useMemo(
    () =>
      buildAging(tabFiltered, {
        due: (e) => e.dueDate,
        balance: (e) => Math.max(0, e.amount - e.paid),
        include: (e) => computeStatus(e) !== "paid",
      }),
    [tabFiltered],
  );

  const filtered = useMemo(
    () =>
      bucket
        ? tabFiltered.filter((e) => computeStatus(e) !== "paid" && inBucket(e.dueDate, bucket))
        : tabFiltered,
    [tabFiltered, bucket],
  );

  const totals = useMemo(() => {
    const t = { count: filtered.length, unpaid: 0, overdue: 0, paid: 0 };
    for (const e of filtered) {
      const st = computeStatus(e);
      const remaining = Math.max(0, e.amount - e.paid);
      if (st === "paid") t.paid += e.paid;
      else if (st === "overdue") t.overdue += remaining;
      else if (st === "unpaid" || st === "partial") t.unpaid += remaining;
    }
    return t;
  }, [filtered]);

  const openCreate = () => { setEditing(null); setDefaultKind(tab === "adhoc" ? "adhoc" : "bill"); setOpen(true); };

  const remove = (e: Expense) => {
    if (!confirm(`Delete this ${e.kind === "bill" ? "bill" : "expense"}?`)) return;
    expensesStore.remove(e.id);
  };

  const markPaid = (e: Expense) => {
    expensesStore.update(e.id, { paid: e.amount, status: "paid" });
  };

  // Default currency = active company's base currency.
  const defaultCurrency: Currency = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId)?.baseCurrency ?? "MGA"
    : "MGA";

  return (
    <div className="p-4 sm:p-8 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard label="Entries" value={String(totals.count)} />
        <KpiCard label="Outstanding" value={fmtAmount(totals.unpaid, defaultCurrency)} />
        <KpiCard label="Overdue" value={fmtAmount(totals.overdue, defaultCurrency)} tone={totals.overdue > 0 ? "danger" : "default"} />
        <KpiCard label="Paid (period)" value={fmtAmount(totals.paid, defaultCurrency)} tone="success" />
      </div>

      <AgingPanel
        aging={aging}
        selected={bucket}
        onSelect={setBucket}
        format={(v) => fmtAmount(v, defaultCurrency)}
        noun="bill"
        title="Payables aging"
        tilesTitle="Payables aging — days past due"
        description="Open balance by days past due — follows the current tab. Click a bar to filter."
        itemsInBucket={(key) =>
          filtered
            .filter((e) => computeStatus(e) !== "paid" && e.amount - e.paid > 0 && inBucket(e.dueDate, key))
            .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
            .map((e) => ({
              id: e.id,
              title: e.number || (e.kind === "bill" ? "Bill" : "Expense"),
              subtitle: e.payee || e.description || undefined,
              amount: e.amount - e.paid,
              due: e.dueDate,
              status: computeStatus(e),
            }))
        }
        onJump={(item) => focusRowById(item.id)}
      />


      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
          {([
            { id: "all" as const, label: "All", icon: Receipt },
            { id: "bill" as const, label: "Bills", icon: FileText },
            { id: "adhoc" as const, label: "Ad-hoc", icon: BanknoteIcon },
          ]).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded inline-flex items-center gap-1.5 transition",
                  tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
        <CrudToolbar createLabel="New expense" count={filtered.length} label={tab === "bill" ? "bills" : tab === "adhoc" ? "expenses" : "entries"} onCreate={openCreate} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState label={tab === "bill" ? "bills" : tab === "adhoc" ? "expenses" : "expenses"} onCreate={openCreate} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-1">Type</div>
            <div className="col-span-2">Payee / Supplier</div>
            <div className="col-span-1">Number</div>
            <div className="col-span-1">Company</div>
            <div className="col-span-1">Issued</div>
            <div className="col-span-1">Due</div>
            <div className="col-span-1">Description</div>
            <div className="col-span-1">Account</div>
            <div className="col-span-1 text-right">Amount</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">·</div>
          </div>
          {filtered.map((e) => {
            const supplier = suppliers.find((s) => s.id === e.supplierId);
            const company = companies.find((c) => c.id === e.companyId);
            const st = computeStatus(e);
            return (
              <div key={e.id} data-focus-id={e.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated/60 transition group">
                <div className="col-span-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider border border-border/60 text-muted-foreground">
                    {e.kind === "bill" ? "Bill" : "Ad-hoc"}
                  </span>
                </div>
                <div className="col-span-2 text-sm truncate font-medium">{supplier?.name || e.payee || "—"}</div>
                <div className="col-span-1 text-xs font-tnum text-muted-foreground truncate">{e.number || "—"}</div>
                <div className="col-span-1 text-[11px] font-mono text-muted-foreground">{companyCode(company)}</div>
                <div className="col-span-1 text-xs font-tnum">{format(parseISO(e.issueDate), "MMM d")}</div>
                <div className="col-span-1 text-xs font-tnum">
                  {e.dueDate ? (
                    <span className={cn(st === "overdue" && "text-destructive font-medium")}>
                      {format(parseISO(e.dueDate), "MMM d")}
                    </span>
                  ) : "—"}
                </div>
                <div className="col-span-1 text-xs text-muted-foreground truncate">{e.description || e.category || "—"}</div>
                <div className="col-span-1 text-xs truncate">
                  {(() => {
                    const acc = e.accountId ? accounts.find((a) => a.id === e.accountId) : null;
                    return acc
                      ? <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 truncate max-w-full">{acc.name}</span>
                      : <span className="text-muted-foreground/50">—</span>;
                  })()}
                </div>
                <div className="col-span-1 text-right text-sm font-tnum font-medium">{fmtAmount(e.amount, e.currency)}</div>
                <div className="col-span-1">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider border inline-flex items-center gap-1", statusStyles[st])}>
                    {st === "overdue" && <AlertTriangle className="h-2.5 w-2.5" />} {st}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end gap-0.5 opacity-0 group-hover:opacity-100">
                  {st !== "paid" && st !== "cancelled" && (
                    <button onClick={() => markPaid(e)} title="Mark paid" className="h-7 w-7 grid place-items-center rounded hover:bg-success/10 text-muted-foreground hover:text-success"><BanknoteIcon className="h-3.5 w-3.5" /></button>
                  )}
                  <button onClick={() => { setEditing(e); setDefaultKind(e.kind); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => remove(e)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ExpenseDialog open={open} onOpenChange={setOpen} editing={editing} defaultKind={defaultKind} defaultCurrency={defaultCurrency} />
    </div>
  );
}


function ExpenseDialog({
  open, onOpenChange, editing, defaultKind, defaultCurrency,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  editing: Expense | null; defaultKind: ExpenseKind; defaultCurrency: Currency;
}) {
  const { scope } = useCompany();
  const { user } = useAuth();
  const companies = useCompanies();
  const suppliers = useSuppliers();
  const accounts = useAccounts();

  const [kind, setKind] = useState<ExpenseKind>("bill");
  const [companyId, setCompanyId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [payee, setPayee] = useState("");
  const [number, setNumber] = useState("");
  const [issueDate, setIssueDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [paid, setPaid] = useState("0");
  const [currency, setCurrency] = useState<Currency>(defaultCurrency);
  const [account, setAccount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setKind(editing.kind);
      setCompanyId(editing.companyId);
      setSupplierId(editing.supplierId ?? "");
      setPayee(editing.payee ?? "");
      setNumber(editing.number ?? "");
      setIssueDate(editing.issueDate);
      setDueDate(editing.dueDate ?? "");
      setAmount(String(editing.amount));
      setPaid(String(editing.paid));
      setCurrency(editing.currency);
      setAccount(editing.account ?? "");
      setAccountId(editing.accountId ?? "");
      setCategory(editing.category ?? "");
      setDescription(editing.description ?? "");
    } else {
      setKind(defaultKind);
      setCompanyId(scope.id === "company" ? scope.companyId : companies[0]?.id ?? "");
      setSupplierId(""); setPayee(""); setNumber("");
      setIssueDate(format(new Date(), "yyyy-MM-dd"));
      setDueDate(defaultKind === "bill" ? format(new Date(Date.now() + 30 * 86400000), "yyyy-MM-dd") : "");
      setAmount(""); setPaid("0"); setCurrency(defaultCurrency);
      setAccount(""); setAccountId(""); setCategory(""); setDescription("");
    }
    setShowErrors(false);
  }, [open, editing, defaultKind, defaultCurrency, scope, companies]);

  const submit = () => {
    const amt = parseFloat(amount);
    const invalid = !companyId || !amt || isNaN(amt);
    if (invalid) {
      setShowErrors(true);
      return;
    }
    const pd = Math.max(0, parseFloat(paid) || 0);
    const data: Omit<Expense, "id"> = {
      companyId, kind,
      supplierId: supplierId || undefined,
      payee: payee.trim() || undefined,
      number: number.trim() || undefined,
      issueDate,
      dueDate: kind === "bill" ? (dueDate || issueDate) : (dueDate || undefined),
      amount: amt,
      paid: pd,
      currency,
      status: pd >= amt ? "paid" : pd > 0 ? "partial" : "unpaid",
      account: account.trim() || undefined,
      accountId: accountId || undefined,
      category: category.trim() || undefined,
      description: description.trim() || undefined,
    };
    if (editing) expensesStore.update(editing.id, data);
    else expensesStore.add({ id: newId("exp"), ...data, createdBy: user?.id });
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  const companyAccounts = accounts.filter((a) => !companyId || a.companyId === companyId);

  const scopedSuppliers = suppliers.filter((s) => !companyId || s.companyId === companyId || (s.companyIds ?? []).includes(companyId));

  useReconciledSelection({
    open,
    currentValue: companyId,
    options: companies,
    getId: (company) => company.id,
    onChange: setCompanyId,
  });

  useReconciledSelection({
    open,
    currentValue: supplierId,
    options: scopedSuppliers,
    getId: (supplier) => supplier.id,
    allowEmpty: true,
    onChange: setSupplierId,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit expense" : kind === "bill" ? "New bill" : "New expense"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ExpenseKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bill">Supplier bill</SelectItem>
                  <SelectItem value="adhoc">Ad-hoc / receipt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label><RequiredLabel>Company</RequiredLabel></Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className={invalidFieldClassName(showErrors && !companyId)} aria-invalid={showErrors && !companyId}><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {companies.map((c) => <SelectItem key={c.id} value={c.id}>{companyCode(c)} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Supplier</Label>
              <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {scopedSuppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payee (if no supplier)</Label>
              <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="e.g. Jovenna gas station" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Document number</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="optional" />
            </div>
            <div>
              <Label>Issue date</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>Due date {kind === "adhoc" && <span className="text-muted-foreground">(opt.)</span>}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label><RequiredLabel>Amount</RequiredLabel></Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={invalidFieldClassName(showErrors && !(parseFloat(amount) > 0))} aria-invalid={showErrors && !(parseFloat(amount) > 0)} />
            </div>
            <div>
              <Label>Paid so far</Label>
              <Input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
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

          <div>
            <Label>Paid from account</Label>
            <Select value={accountId || "none"} onValueChange={(v) => setAccountId(v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {companyAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name} · {a.currency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>PCG account</Label>
              <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="e.g. 622600" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Honoraires" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !companyId || !amount}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
