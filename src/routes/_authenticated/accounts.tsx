import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useAccounts, useCompanies, accountsStore,
  fmtCompact, toMGA, type Account, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { Landmark, Smartphone, Banknote, Pencil, Trash2, Upload, History, CheckCircle2, AlertTriangle } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { StatementImportDialog } from "@/components/statement-import-dialog";
import { format, parseISO } from "date-fns";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel } from "@/components/form-ux";
import { useAccountBalances, openingOf } from "@/lib/account-balance";
import { fetchReconciliations, type BankReconciliation } from "@/lib/db-sync";
import { cn } from "@/lib/utils";

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

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CrudToolbar count={list.length} label="accounts" onCreate={openCreate} />
        <DataToolbar view={view} items={baseList} />
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

          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-5 py-3">Account</th>
                  <th className="text-left font-medium px-5 py-3">Company</th>
                  <th className="text-left font-medium px-5 py-3">Type</th>
                  <th className="text-left font-medium px-5 py-3">Last statement</th>
                  <th className="text-right font-medium px-5 py-3">Opening</th>
                  <th className="text-right font-medium px-5 py-3">Balance</th>
                  <th className="text-right font-medium px-5 py-3">MGA equiv.</th>
                  <th className="px-5 py-3 w-32" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={8} />}
                    {g.items.map((a) => {
                      const co = companies.find((c) => c.id === a.companyId);
                      const Icon = iconFor(a.type);
                      return (
                        <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/50 group">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-md bg-surface-elevated grid place-items-center text-muted-foreground"><Icon className="h-4 w-4" /></div>
                              <div>
                                <div className="font-medium">{a.name}</div>
                                <div className="text-xs text-muted-foreground uppercase">{a.currency}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {co ? <span className="inline-flex items-center gap-2 font-mono" title={co.name}><span className="h-2 w-2 rounded-full" style={{ background: co.color }} />{co.code || co.shortName}</span> : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-5 py-3.5 capitalize text-muted-foreground">{a.type}</td>
                          <td className="px-5 py-3.5 text-xs text-muted-foreground">
                            {a.statementUploadedAt ? (
                              <div className="flex flex-col">
                                <span className="font-tnum">{format(parseISO(a.statementUploadedAt), "MMM d, yyyy")}</span>
                                {a.statementName && <span className="text-[10px] text-muted-foreground/70 truncate max-w-[180px]">{a.statementName}</span>}
                              </div>
                            ) : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right font-tnum text-muted-foreground">
                            <div className="flex flex-col items-end">
                              <span>{fmtCompact(openingOf(a), a.currency)}</span>
                              {a.openingBalanceDate && <span className="text-[10px] text-muted-foreground/70">as of {format(parseISO(a.openingBalanceDate), "MMM d, yyyy")}</span>}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-tnum">
                            <div className="flex flex-col items-end">
                              <span>{fmtCompact(balanceOf(a), a.currency)}</span>
                              <span className="text-[10px] text-muted-foreground/70">{balances.get(a.id)?.txCount ?? 0} movements</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-tnum text-muted-foreground">{fmtCompact(toMGA(balanceOf(a), a.currency), "MGA")}</td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                              <button onClick={() => setHistoryFor(a)} title="Reconciliation history" className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><History className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setImporting(a)} title="Reconcile bank statement" className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Upload className="h-3.5 w-3.5" /></button>
                              <button onClick={() => openEdit(a)} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => confirm(`Delete ${a.name}?`) && accountsStore.remove(a.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
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
      setBalance(String(editing.openingBalance ?? editing.balance ?? 0));
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
      ...(editing ? {} : { balance: opening }),
    };
    if (editing) accountsStore.update(editing.id, data);
    else accountsStore.add({ id: newId("acc"), ...data });
    onOpenChange(false);
  };

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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReconciliationHistoryDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (v: boolean) => void; account: Account | null }) {
  const [rows, setRows] = useState<BankReconciliation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !account) return;
    setLoading(true);
    fetchReconciliations(account.id).then((r) => { setRows(r); setLoading(false); });
  }, [open, account]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Reconciliation history {account ? `· ${account.name}` : ""}</DialogTitle></DialogHeader>
        <div className="py-2">
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              This account has never been reconciled. Upload a bank statement to prove the balance is accurate.
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="text-left font-medium px-3 py-2">Period</th>
                    <th className="text-left font-medium px-3 py-2">Statement</th>
                    <th className="text-right font-medium px-3 py-2">Rows</th>
                    <th className="text-right font-medium px-3 py-2">Bank closing</th>
                    <th className="text-right font-medium px-3 py-2">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const ok = Math.abs(r.difference) < 1;
                    return (
                      <tr key={r.id} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2 font-tnum text-muted-foreground">
                          {r.periodStart ? format(parseISO(r.periodStart), "MMM d") : "—"} → {r.periodEnd ? format(parseISO(r.periodEnd), "MMM d, yyyy") : "—"}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[200px]">{r.statementName ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-tnum">{r.rowCount}</td>
                        <td className="px-3 py-2 text-right font-tnum">{account ? fmtCompact(r.statementClosingBalance, account.currency) : r.statementClosingBalance}</td>
                        <td className={cn("px-3 py-2 text-right font-tnum", ok ? "text-success" : "text-destructive")}>
                          <span className="inline-flex items-center gap-1 justify-end">
                            {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {ok ? "Balanced" : (account ? fmtCompact(r.difference, account.currency) : r.difference)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
