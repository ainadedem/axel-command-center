import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTransactions, useCompanies, useAccounts, transactionsStore,
  fmtCompact, type Transaction, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/transactions")({
  component: TransactionsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
});

const types = ["all", "income", "expense", "transfer", "intercompany"] as const;

function TransactionsPage() {
  return (
    <AppShell>
      <PageHeader title="Transactions" description="Every flow of money — income, expense, transfer, intercompany." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const transactions = useTransactions();
  const companies = useCompanies();
  const { q } = Route.useSearch();
  const [filter, setFilter] = useState<(typeof types)[number]>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  let list = inScope(transactions, scope);
  if (filter !== "all") list = list.filter((t) => t.type === filter);
  if (q) {
    const qq = q.toLowerCase();
    list = list.filter((t) =>
      t.description.toLowerCase().includes(qq) ||
      t.category.toLowerCase().includes(qq) ||
      String(t.amount).includes(qq),
    );
  }
  list = [...list].sort((a, b) => b.date.localeCompare(a.date));

  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <div className="p-8 space-y-5">
      {q && (
        <div className="text-xs text-muted-foreground">
          Filtered by <span className="text-foreground font-medium">"{q}"</span> · {list.length} match{list.length === 1 ? "" : "es"}
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm capitalize transition border",
                filter === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-surface hover:bg-surface-elevated text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <CrudToolbar count={list.length} label="transactions" onCreate={openCreate} />
      </div>

      {list.length === 0 ? (
        <EmptyState label="transactions" onCreate={openCreate} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-3">Date</th>
                <th className="text-left font-medium px-5 py-3">Description</th>
                <th className="text-left font-medium px-5 py-3">Company</th>
                <th className="text-left font-medium px-5 py-3">Category</th>
                <th className="text-left font-medium px-5 py-3">Type</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
                <th className="px-5 py-3 w-20" />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => {
                const co = companies.find((c) => c.id === t.companyId);
                return (
                  <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 group">
                    <td className="px-5 py-3.5 text-muted-foreground font-tnum text-xs">{format(parseISO(t.date), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3.5 font-medium">{t.description}</td>
                    <td className="px-5 py-3.5">
                      {co && <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: co.color }} />{co.shortName}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground">{t.category}</td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        t.type === "income" && "border-success/40 text-success bg-success/10",
                        t.type === "expense" && "border-destructive/30 text-destructive bg-destructive/10",
                        t.type === "transfer" && "border-chart-2/30 text-chart-2 bg-chart-2/10",
                        t.type === "intercompany" && "border-chart-4/30 text-chart-4 bg-chart-4/10",
                      )}>{t.type}</span>
                    </td>
                    <td className={cn("px-5 py-3.5 text-right font-tnum font-medium", t.type === "income" && "text-success")}>
                      {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{fmtCompact(t.amount, t.currency)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                        <button onClick={() => { setEditing(t); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm("Delete this transaction?") && transactionsStore.remove(t.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <TransactionDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function TransactionDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Transaction | null }) {
  const companies = useCompanies();
  const accounts = useAccounts();
  const [companyId, setCompanyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<Transaction["type"]>("expense");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState<Currency>("MGA");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setAccountId(editing.accountId); setDate(editing.date);
      setType(editing.type); setCategory(editing.category); setDescription(editing.description);
      setAmount(String(editing.amount)); setCurrency(editing.currency);
    } else {
      const c = companies[0]; setCompanyId(c?.id ?? ""); setAccountId(""); setDate(new Date().toISOString().slice(0, 10));
      setType("expense"); setCategory(""); setDescription(""); setAmount("0"); setCurrency(c?.baseCurrency ?? "MGA");
    }
  }, [open, editing, companies]);

  const companyAccounts = accounts.filter((a) => a.companyId === companyId);

  const submit = () => {
    if (!description.trim() || !companyId || !accountId) return;
    const data = { companyId, accountId, date, type, category, description, amount: Number(amount) || 0, currency };
    if (editing) transactionsStore.update(editing.id, data);
    else transactionsStore.add({ id: newId("tx"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit transaction" : "New transaction"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setAccountId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder={companyAccounts.length ? "Select" : "Create account first"} /></SelectTrigger>
                <SelectContent>{companyAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as Transaction["type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="intercompany">Intercompany</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Payroll, Services, …" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
