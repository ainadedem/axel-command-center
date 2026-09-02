import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { focusSearch, useFocusRow, useJumpToRecord } from "@/hooks/use-focus-row";
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
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { Pencil, Trash2, Receipt, FileText, BanknoteIcon, AlertTriangle, SendHorizonal } from "lucide-react";
import { toast } from "sonner";
import { paymentRequestsStore } from "@/lib/mock-data";
import { runDateFor, runLabel } from "@/lib/payment-approvals";
import { cn } from "@/lib/utils";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { MasterDetail, DetailPanel, DetailSection, DetailField } from "@/components/master-detail";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";

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

const EXPENSE_COLUMNS: ColumnDef[] = [
  { key: "type", label: "Type" },
  { key: "number", label: "Number" },
  { key: "company", label: "Company" },
  { key: "issued", label: "Issued" },
  { key: "due", label: "Due" },
  { key: "description", label: "Description", priority: "optional" },
  { key: "account", label: "Account", priority: "optional" },
  { key: "amount", label: "Amount" },
  { key: "status", label: "Status" },
];

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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Bucket + focused record live in the URL so aging drawer jumps are shareable.
  const search = Route.useSearch();
  const navigate = useNavigate();
  const jumpTo = useJumpToRecord();
  const urlBucket = (search.aging as AgingKey | undefined) ?? null;
  const [bucket, setBucket] = useState<AgingKey | null>(urlBucket);
  useEffect(() => {
    if (urlBucket && urlBucket !== bucket) setBucket(urlBucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBucket]);
  const setDrawerBucket = (key: AgingKey | null) => {
    if (key) setBucket(key);
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, aging: key ?? undefined }), replace: true } as never);
  };

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

  const bucketFiltered = useMemo(
    () =>
      bucket
        ? tabFiltered.filter(
            // The deep-linked record always survives the bucket filter.
            (e) => e.id === search.focus || (computeStatus(e) !== "paid" && inBucket(e.dueDate, bucket)),
          )
        : tabFiltered,
    [tabFiltered, bucket, search.focus],
  );

  const payeeName = (e: Expense) => suppliers.find((s) => s.id === e.supplierId)?.name || e.payee || "—";

  const fields = useMemo<FieldDef<Expense>[]>(() => [
    { key: "payee", label: "Payee", type: "string", accessor: payeeName },
    { key: "kind", label: "Type", type: "enum", accessor: (e) => (e.kind === "bill" ? "Bill" : "Ad-hoc") },
    { key: "number", label: "Number", type: "string", accessor: (e) => e.number ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (e) => companyCode(companies.find((c) => c.id === e.companyId)) },
    { key: "status", label: "Status", type: "enum", accessor: (e) => computeStatus(e) },
    { key: "issueDate", label: "Issued", type: "date", accessor: (e) => e.issueDate, noGroup: true },
    { key: "dueDate", label: "Due", type: "date", accessor: (e) => e.dueDate ?? "", noGroup: true },
    { key: "amount", label: "Amount", type: "number", accessor: (e) => e.amount, noGroup: true },
    { key: "category", label: "Category", type: "enum", accessor: (e) => e.category ?? "" },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [companies, suppliers]);

  const dataView = useDataView<Expense>("expenses", fields);
  const groups = useMemo(() => dataView.apply(bucketFiltered), [dataView, bucketFiltered]);
  const filtered = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const cp = useColumnPrefs("expenses", EXPENSE_COLUMNS);
  const colCount = 2 + cp.count;

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
    if (selectedId === e.id) setSelectedId(null);
  };

  const requestPayment = (e: Expense) => {
    const runDate = runDateFor();
    const outstanding = Math.max(0, e.amount - (e.paid ?? 0));
    paymentRequestsStore.add({
      id: newId("pay-req"),
      companyId: e.companyId,
      runId: runDate,
      kind: e.kind === "bill" ? "bill" : "other",
      expenseId: e.id,
      supplierId: e.supplierId,
      payee: e.payee,
      title: e.description || e.number || "Payment request",
      description: e.description,
      amount: outstanding || e.amount,
      currency: e.currency,
      projectId: e.projectId,
      neededBy: e.dueDate,
      status: "submitted",
      offCycle: false,
      requestedBy: user?.id,
      submittedAt: new Date().toISOString(),
    });
    toast.success(`Sent for review — ${runLabel(runDate)} run.`);
  };

  const markPaid = (e: Expense) => {
    expensesStore.update(e.id, { paid: e.amount, status: "paid" });
  };

  // Default currency = active company's base currency.
  const defaultCurrency: Currency = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId)?.baseCurrency ?? "MGA"
    : "MGA";

  const selected = selectedId ? filtered.find((e) => e.id === selectedId) ?? null : null;
  const detail = selected ? (
    <DetailPanel
      eyebrow={selected.kind === "bill" ? "Supplier bill" : "Ad-hoc expense"}
      title={payeeName(selected)}
      subtitle={selected.number || undefined}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditing(selected); setDefaultKind(selected.kind); setOpen(true); }}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          {computeStatus(selected) !== "paid" && computeStatus(selected) !== "cancelled" && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => markPaid(selected)}>
              <BanknoteIcon className="h-4 w-4" /> Mark paid
            </Button>
          )}
        </>
      }
    >
      <DetailSection>
        <DetailField label="Status" value={computeStatus(selected)} />
        <DetailField label="Amount" value={fmtAmount(selected.amount, selected.currency)} mono />
        <DetailField label="Paid" value={fmtAmount(selected.paid, selected.currency)} mono />
        <DetailField label="Remaining" value={fmtAmount(Math.max(0, selected.amount - selected.paid), selected.currency)} mono />
      </DetailSection>
      <DetailSection title="Dates">
        <DetailField label="Issued" value={format(parseISO(selected.issueDate), "d MMM yyyy")} mono />
        <DetailField label="Due" value={selected.dueDate ? format(parseISO(selected.dueDate), "d MMM yyyy") : undefined} mono />
      </DetailSection>
      <DetailSection title="Allocation">
        <DetailField label="Company" value={companies.find((c) => c.id === selected.companyId)?.name} />
        <DetailField label="Paid from" value={accounts.find((a) => a.id === selected.accountId)?.name} />
        <DetailField label="PCG account" value={selected.account} mono />
        <DetailField label="Category" value={selected.category} />
        <DetailField label="Description" value={selected.description} />
      </DetailSection>
    </DetailPanel>
  ) : null;

  return (
    <div className="p-5 sm:p-10 lg:p-12">
      <MasterDetail detail={detail}>
      <div className="space-y-6">
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
        storageKey="payables"
        tilesTitle="Payables aging — days past due"
        description="Open balance by days past due — follows the current tab. Click a bar to filter."
        itemsInBucket={(key) =>
          tabFiltered
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
        drawerBucket={urlBucket}
        onDrawerBucketChange={setDrawerBucket}
        onJump={(item) => jumpTo(item.id, bucket)}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
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
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnPicker prefs={cp} />
          <DataToolbar view={dataView} items={bucketFiltered} />
          <CrudToolbar createLabel="New expense" count={filtered.length} label={tab === "bill" ? "bills" : tab === "adhoc" ? "expenses" : "entries"} onCreate={openCreate} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState label={tab === "bill" ? "bills" : tab === "adhoc" ? "expenses" : "expenses"} onCreate={openCreate} />
      ) : (
        <ListTableShell>
          <ListTable>
            <thead>
              <ListHeadRow>
                <ListActionsTh />
                <ListTh width="20%">Payee / Supplier</ListTh>
                {cp.on("type") && <ListTh width="8%">Type</ListTh>}
                {cp.on("number") && <ListTh width="10%">Number</ListTh>}
                {cp.on("company") && <ListTh width="8%">Company</ListTh>}
                {cp.on("issued") && <ListTh width="9%">Issued</ListTh>}
                {cp.on("due") && <ListTh width="9%">Due</ListTh>}
                {cp.on("description") && <ListTh width="14%">Description</ListTh>}
                {cp.on("account") && <ListTh width="12%">Account</ListTh>}
                {cp.on("amount") && <ListTh width="12%" align="right">Amount</ListTh>}
                {cp.on("status") && <ListTh width="10%">Status</ListTh>}
              </ListHeadRow>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />}
                  {g.items.map((e) => {
                    const company = companies.find((c) => c.id === e.companyId);
                    const acc = e.accountId ? accounts.find((a) => a.id === e.accountId) : null;
                    const st = computeStatus(e);
                    return (
                      <tr
                        key={e.id}
                        data-focus-id={e.id}
                        data-selected={selectedId === e.id ? "true" : undefined}
                        onClick={() => setSelectedId(e.id)}
                        className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 data-[selected=true]:bg-[var(--primary-container)]/40 cursor-pointer transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                      >
                        <ListRowActions colSpan={colCount}>
                          {st !== "paid" && st !== "cancelled" && (
                            <RowAction icon={<BanknoteIcon className="h-3.5 w-3.5" />} label="Mark paid" tone="success" onClick={() => markPaid(e)} />
                          )}
                          <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { setEditing(e); setDefaultKind(e.kind); setOpen(true); }} />
                          <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => remove(e)} />
                        </ListRowActions>
                        <ListTd className="font-medium" title={payeeName(e)}>{payeeName(e)}</ListTd>
                        {cp.on("type") && (
                          <ListTd>
                            <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider border border-border/60 text-muted-foreground">
                              {e.kind === "bill" ? "Bill" : "Ad-hoc"}
                            </span>
                          </ListTd>
                        )}
                        {cp.on("number") && <ListTd className="text-xs font-tnum text-muted-foreground" title={e.number}>{e.number || <span className="text-muted-foreground/50">—</span>}</ListTd>}
                        {cp.on("company") && <ListTd className="text-[11px] font-mono text-muted-foreground" title={company?.name}>{companyCode(company)}</ListTd>}
                        {cp.on("issued") && <ListTd className="text-xs font-tnum">{format(parseISO(e.issueDate), "MMM d")}</ListTd>}
                        {cp.on("due") && (
                          <ListTd className="text-xs font-tnum">
                            {e.dueDate ? <span className={cn(st === "overdue" && "text-destructive font-medium")}>{format(parseISO(e.dueDate), "MMM d")}</span> : <span className="text-muted-foreground/50">—</span>}
                          </ListTd>
                        )}
                        {cp.on("description") && <ListTd className="text-xs text-muted-foreground" title={e.description || e.category}>{e.description || e.category || <span className="text-muted-foreground/50">—</span>}</ListTd>}
                        {cp.on("account") && (
                          <ListTd className="text-xs" title={acc?.name}>
                            {acc
                              ? <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 truncate max-w-full">{acc.name}</span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </ListTd>
                        )}
                        {cp.on("amount") && <ListTd align="right" className="font-tnum font-medium">{fmtAmount(e.amount, e.currency)}</ListTd>}
                        {cp.on("status") && (
                          <ListTd>
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider border inline-flex items-center gap-1", statusStyles[st])}>
                              {st === "overdue" && <AlertTriangle className="h-2.5 w-2.5" />} {st}
                            </span>
                          </ListTd>
                        )}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </ListTable>
        </ListTableShell>
      )}

      <ExpenseDialog open={open} onOpenChange={setOpen} editing={editing} defaultKind={defaultKind} defaultCurrency={defaultCurrency} />
      </div>
      </MasterDetail>
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
