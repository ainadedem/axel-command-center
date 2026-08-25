import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useAccounts, useCompanies, accountsStore,
  fmtCompact, toMGA, type Account, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { Landmark, Smartphone, Banknote, Pencil, Trash2, Upload, History, CheckCircle2, AlertTriangle, Search, Download, FileDown, Info } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { StatementImportDialog } from "@/components/statement-import-dialog";
import { format, parseISO } from "date-fns";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useAccountBalances, openingOf } from "@/lib/account-balance";
import { fetchReconciliations, type BankReconciliation } from "@/lib/db-sync";
import {
  exportReconciliationCsv, exportReconciliationPdf, type ReconciliationSummary,
} from "@/lib/reconciliation-export";
import { cn } from "@/lib/utils";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";

const ACCOUNT_COLUMNS: ColumnDef[] = [
  { key: "account", label: "Account", priority: "always" },
  { key: "company", label: "Company", priority: "always" },
  { key: "type", label: "Type" },
  { key: "statement", label: "Last statement" },
  { key: "opening", label: "Opening" },
  { key: "balance", label: "Balance", priority: "always" },
  { key: "mga", label: "MGA equiv." },
];


function TooltipHint({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-center">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export const Route = createFileRoute("/_authenticated/accounts")({ component: AccountsPage });

const iconFor = (t: string) => t === "bank" ? Landmark : t === "mobile" ? Smartphone : Banknote;

function AccountsPage() {
  return (
    <AppShell>
      <PageHeader title="Accounts" description="Bank, mobile and cash accounts across all companies." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const accounts = useAccounts();
  const companies = useCompanies();
  const baseList = inScope(accounts, scope);
  const balances = useAccountBalances(baseList);
  const balanceOf = (a: Account) => balances.get(a.id)?.computed ?? openingOf(a);
  const totalMGA = baseList.reduce((s, a) => s + toMGA(balanceOf(a), a.currency), 0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [importing, setImporting] = useState<Account | null>(null);
  const [historyFor, setHistoryFor] = useState<Account | null>(null);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (a: Account) => { setEditing(a); setOpen(true); };

  const fields: FieldDef<Account>[] = [
    { key: "name", label: "Name", type: "string", accessor: (a) => a.name, noGroup: true },
    { key: "company", label: "Company", type: "enum", accessor: (a) => companies.find((c) => c.id === a.companyId)?.shortName ?? "" },
    { key: "type", label: "Type", type: "enum", accessor: (a) => a.type },
    { key: "currency", label: "Currency", type: "enum", accessor: (a) => a.currency },
    { key: "openingBalance", label: "Opening balance", type: "number", accessor: (a) => openingOf(a), noGroup: true },
    { key: "balance", label: "Balance", type: "number", accessor: (a) => balanceOf(a), noGroup: true },
    { key: "balanceMGA", label: "Balance (MGA)", type: "number", accessor: (a) => toMGA(balanceOf(a), a.currency), noGroup: true },
    { key: "statementUploadedAt", label: "Last statement", type: "date", accessor: (a) => a.statementUploadedAt ?? "", noGroup: true },
  ];
  const view = useDataView<Account>("accounts", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);
  const cp = useColumnPrefs("accounts", ACCOUNT_COLUMNS);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? list.find((a) => a.id === selectedId) ?? null : null;
  const selectedCo = selected ? companies.find((c) => c.id === selected.companyId) : null;
  const detail = selected ? (
    <DetailPanel
      eyebrow={selected.type === "bank" ? "Bank account" : selected.type === "mobile" ? "Mobile money" : "Cash account"}
      title={selected.name}
      subtitle={selectedCo?.name}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          <Button size="sm" className="gap-1.5" onClick={() => openEdit(selected)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImporting(selected)}><Upload className="h-4 w-4" /> Reconcile</Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setHistoryFor(selected)}><History className="h-4 w-4" /> History</Button>
        </>
      }
    >
      <DetailSection>
        <DetailField label="Balance" value={fmtCompact(balanceOf(selected), selected.currency)} mono />
        <DetailField label="MGA equivalent" value={fmtCompact(toMGA(balanceOf(selected), selected.currency), "MGA")} mono />
        <DetailField label="Movements" value={String(balances.get(selected.id)?.txCount ?? 0)} mono />
        <DetailField label="Currency" value={selected.currency} />
      </DetailSection>
      <DetailSection title="Opening">
        <DetailField label="Opening balance" value={fmtCompact(openingOf(selected), selected.currency)} mono />
        <DetailField label="As of" value={selected.openingBalanceDate ? format(parseISO(selected.openingBalanceDate), "d MMM yyyy") : undefined} mono />
      </DetailSection>
      <DetailSection title="Reconciliation">
        <DetailField label="Last statement" value={selected.statementUploadedAt ? format(parseISO(selected.statementUploadedAt), "d MMM yyyy") : "Never reconciled"} mono />
        <DetailField label="File" value={selected.statementName} />
      </DetailSection>
    </DetailPanel>
  ) : null;

  return (
    <div className="p-5 sm:p-10 lg:p-12">
      <MasterDetail detail={detail}>
      <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">

        <CrudToolbar createLabel="New account" count={list.length} label="accounts" onCreate={openCreate} />
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnPicker prefs={cp} />
          <DataToolbar view={view} items={baseList} />
        </div>

      </div>

      <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <span>
          Hover a row to reveal its actions. The{" "}
          <Upload className="inline h-3 w-3 text-primary align-[-2px]" /> <span className="text-foreground font-medium">upload</span> icon opens the
          guided <span className="text-foreground font-medium">Reconcile bank statement</span> wizard (CSV or Excel), and the{" "}
          <History className="inline h-3 w-3 text-primary align-[-2px] " /> <span className="text-foreground font-medium">history</span> icon lists past
          reconciliations with CSV/PDF export.
        </span>
      </div>

      {list.length === 0 ? (
        <EmptyState label="accounts" onCreate={openCreate} />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Total liquidity</div>
              <div className="font-display text-3xl font-bold mt-1 font-tnum">{fmtCompact(totalMGA, "MGA")}</div>
            </div>
            <div className="text-xs text-muted-foreground">{baseList.length} accounts</div>
          </div>

          <ListTableShell>
            <ListTable>
              <thead>
                <ListHeadRow>
                  <ListActionsTh />
<ListTh width="26%">Account</ListTh>
                  <ListTh width="11%">Company</ListTh>
                  {cp.on("type") && <ListTh width="10%">Type</ListTh>}
                  {cp.on("statement") && <ListTh width="15%">Last statement</ListTh>}
                  {cp.on("opening") && <ListTh width="13%" align="right">Opening</ListTh>}
                  <ListTh width="13%" align="right">Balance</ListTh>
                  {cp.on("mga") && <ListTh width="12%" align="right">MGA equiv.</ListTh>}
                </ListHeadRow>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={cp.count + 1} />}
                    {g.items.map((a) => {
                      const co = companies.find((c) => c.id === a.companyId);
                      const Icon = iconFor(a.type);
                      return (
                        <Fragment key={a.id}>
                        <tr className="hover:bg-surface-elevated/50">
<ListRowActions colSpan={cp.count}>
                          <RowAction icon={<History className="h-3.5 w-3.5" />} label="History" title="Reconciliation history — past statement checks, with CSV/PDF export" onClick={() => setHistoryFor(a)} />
                          <RowAction icon={<Upload className="h-3.5 w-3.5" />} label="Reconcile" title="Reconcile bank statement — upload a CSV or Excel statement" onClick={() => setImporting(a)} />
                          <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => openEdit(a)} />
                          <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => { if (confirm(`Delete ${a.name}?`)) accountsStore.remove(a.id); }} />
                        </ListRowActions>

                          <ListTd title={a.name}>
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-8 w-8 shrink-0 rounded-md bg-surface-elevated grid place-items-center text-muted-foreground"><Icon className="h-4 w-4" /></div>
                              <div className="min-w-0">
                                <div className="font-medium truncate">{a.name}</div>
                                <div className="text-xs text-muted-foreground uppercase">{a.currency}</div>
                              </div>
                            </div>
                          </ListTd>
                          <ListTd title={co?.name}>
                            {co ? <span className="inline-flex items-center gap-2 font-mono max-w-full"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: co.color }} /><span className="truncate">{co.code || co.shortName}</span></span> : <span className="text-muted-foreground">—</span>}
                          </ListTd>
                          {cp.on("type") && <ListTd className="capitalize text-muted-foreground">{a.type}</ListTd>}
                          {cp.on("statement") && (
                            <ListTd className="text-xs text-muted-foreground" title={a.statementName}>
                              {a.statementUploadedAt ? (
                                <div className="flex flex-col min-w-0">
                                  <span className="font-tnum">{format(parseISO(a.statementUploadedAt), "MMM d, yyyy")}</span>
                                  {a.statementName && <span className="text-[10px] text-muted-foreground/70 truncate">{a.statementName}</span>}
                                </div>
                              ) : <span className="text-muted-foreground/40">—</span>}
                            </ListTd>
                          )}
                          {cp.on("opening") && (
                            <ListTd align="right" className="font-tnum text-muted-foreground">
                              <div className="flex flex-col items-end">
                                <span>{fmtCompact(openingOf(a), a.currency)}</span>
                                {a.openingBalanceDate && <span className="text-[10px] text-muted-foreground/70">as of {format(parseISO(a.openingBalanceDate), "MMM d, yyyy")}</span>}
                              </div>
                            </ListTd>
                          )}
                          <ListTd align="right" className="font-tnum">
                            <div className="flex flex-col items-end">
                              <span>{fmtCompact(balanceOf(a), a.currency)}</span>
                              <span className="text-[10px] text-muted-foreground/70">{balances.get(a.id)?.txCount ?? 0} movements</span>
                            </div>
                          </ListTd>
                          {cp.on("mga") && <ListTd align="right" className="font-tnum text-muted-foreground">{fmtCompact(toMGA(balanceOf(a), a.currency), "MGA")}</ListTd>}
                        </tr>
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </ListTable>
          </ListTableShell>

        </>
      )}

      <AccountDialog open={open} onOpenChange={setOpen} editing={editing} />
      <StatementImportDialog open={!!importing} onOpenChange={(v) => { if (!v) setImporting(null); }} account={importing} />
      <ReconciliationHistoryDialog open={!!historyFor} onOpenChange={(v) => { if (!v) setHistoryFor(null); }} account={historyFor} />
    </div>
  );
}

function AccountDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Account | null }) {
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<Account["type"]>("bank");
  const [currency, setCurrency] = useState<Currency>("MGA");
  const [balance, setBalance] = useState("0");
  const [openingDate, setOpeningDate] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name); setType(editing.type); setCurrency(editing.currency);
      setBalance(String(openingOf(editing)));
      setOpeningDate(editing.openingBalanceDate ?? "");
    } else {
      setCompanyId(companies[0]?.id ?? ""); setName(""); setType("bank"); setCurrency("MGA"); setBalance("0");
      setOpeningDate(new Date().toISOString().slice(0, 10));
    }
    setShowErrors(false);
  }, [open, editing, companies]);

  const submit = () => {
    const invalid = !name.trim() || !companyId;
    if (invalid) {
      setShowErrors(true);
      return;
    }
    const opening = Number(balance) || 0;
    const data = {
      companyId, name, type, currency,
      openingBalance: opening,
      openingBalanceDate: openingDate || undefined,
    };
    if (editing) accountsStore.update(editing.id, data);
    else accountsStore.add({ id: newId("acc"), balance: opening, ...data });
    onOpenChange(false);
    return;
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div>
            <Label><RequiredLabel>Company</RequiredLabel></Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className={invalidFieldClassName(showErrors && !companyId)} aria-invalid={showErrors && !companyId}><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label><RequiredLabel>Account name</RequiredLabel></Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BNI Madagascar" className={invalidFieldClassName(showErrors && !name.trim())} aria-invalid={showErrors && !name.trim()} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as Account["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="mobile">Mobile money</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Opening balance</Label><Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} /></div>
            <div><Label>Opening balance date</Label><Input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            The displayed balance is computed: opening balance plus every transaction recorded on this account from the opening date onwards.
            Reconcile it against a bank statement to confirm it is accurate.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ReconStatus = "all" | "balanced" | "difference" | "adjusted";

function statusOf(r: BankReconciliation): Exclude<ReconStatus, "all"> {
  if (Math.abs(r.difference) < 1) return r.adjustmentAmount ? "adjusted" : "balanced";
  return r.adjustmentAmount ? "adjusted" : "difference";
}

function ReconciliationHistoryDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (v: boolean) => void; account: Account | null }) {
  const companies = useCompanies();
  const [rows, setRows] = useState<BankReconciliation[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<ReconStatus>("all");

  useEffect(() => {
    if (!open || !account) return;
    setQ(""); setFrom(""); setTo(""); setStatus("all");
    setLoading(true);
    fetchReconciliations(account.id).then((r) => { setRows(r); setLoading(false); });
  }, [open, account]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (needle && !(r.statementName ?? "").toLowerCase().includes(needle)) return false;
        const day = r.createdAt.slice(0, 10);
        const start = r.periodStart ?? day;
        const end = r.periodEnd ?? day;
        if (from && end < from && day < from) return false;
        if (to && start > to && day > to) return false;
        if (status !== "all" && statusOf(r) !== status) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [rows, q, from, to, status]);

  const summaryOf = (r: BankReconciliation): ReconciliationSummary => ({
    companyName: account ? companies.find((c) => c.id === account.companyId)?.name : undefined,
    accountName: account?.name ?? "",
    currency: account?.currency ?? "MGA",
    statementName: r.statementName,
    createdAt: r.createdAt,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    openingBalance: r.openingBalance,
    openingBalanceDate: account?.openingBalanceDate,
    expectedClosing: r.computedClosingBalance,
    statementClosing: r.statementClosingBalance,
    difference: r.difference,
    adjustmentAmount: r.adjustmentAmount,
    rowCount: r.rowCount,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Reconciliation history {account ? `· ${account.name}` : ""}</DialogTitle></DialogHeader>

        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search file name…" className="h-8 pl-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-muted-foreground">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-xs" />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as ReconStatus)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="balanced">Balanced</SelectItem>
              <SelectItem value="difference">Difference</SelectItem>
              <SelectItem value="adjusted">Adjusted</SelectItem>
            </SelectContent>
          </Select>
          {(q || from || to || status !== "all") && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setQ(""); setFrom(""); setTo(""); setStatus("all"); }}>Clear</Button>
          )}
        </div>

        <div className="py-1">
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              This account has never been reconciled. Upload a bank statement to prove the balance is accurate.
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">No reconciliation matches these filters.</div>
          ) : (
            <>
              <div className="text-[11px] text-muted-foreground mb-2">{filtered.length} of {rows.length} reconciliations</div>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto stacked-table">
                <table className="w-full min-w-[720px] text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-3 py-2">Period</th>
                      <th className="text-left font-medium px-3 py-2">Statement</th>
                      <th className="text-right font-medium px-3 py-2">Rows</th>
                      <th className="text-right font-medium px-3 py-2">Bank closing</th>
                      <th className="text-right font-medium px-3 py-2">Difference</th>
                      <th className="px-3 py-2 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const ok = Math.abs(r.difference) < 1;
                      return (
                        <tr key={r.id} className="border-b border-border/40 last:border-0 group">
                          <td className="px-3 py-2 font-tnum text-muted-foreground">
                            {r.periodStart ? format(parseISO(r.periodStart), "MMM d") : "—"} → {r.periodEnd ? format(parseISO(r.periodEnd), "MMM d, yyyy") : "—"}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[200px]">
                            {r.statementName ?? "—"}
                            {r.adjustmentAmount ? <span className="ml-2 text-[10px] uppercase tracking-wider text-warning">adjusted</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right font-tnum">{r.rowCount}</td>
                          <td className="px-3 py-2 text-right font-tnum">{account ? fmtCompact(r.statementClosingBalance, account.currency) : r.statementClosingBalance}</td>
                          <td className={cn("px-3 py-2 text-right font-tnum", ok ? "text-success" : "text-destructive")}>
                            <span className="inline-flex items-center gap-1 justify-end">
                              {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                              {ok ? "Balanced" : (account ? fmtCompact(r.difference, account.currency) : r.difference)}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100">
                              <TooltipHint label="Export summary as CSV">
                                <button onClick={() => exportReconciliationCsv(summaryOf(r))} className="h-6 w-6 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Download className="h-3.5 w-3.5" /></button>
                              </TooltipHint>
                              <TooltipHint label="Export summary as PDF">
                                <button onClick={() => exportReconciliationPdf(summaryOf(r))} className="h-6 w-6 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><FileDown className="h-3.5 w-3.5" /></button>
                              </TooltipHint>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
