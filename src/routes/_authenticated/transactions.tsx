import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTransactions, useCompanies, useAccounts, useClients, useSuppliers, useCategories, useProjects, useInvoices,
  transactionsStore, categoriesStore, invoicesStore, fmtCompact, type Transaction, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { ReconcileButton, type ReconcileCheck } from "@/components/reconcile-button";
import { format, parseISO } from "date-fns";
import { Fragment, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { ResizeHandle, useResizableColumns } from "@/components/resizable-columns";
import { Pencil, Trash2 } from "lucide-react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";

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
  const clients = useClients();
  const suppliers = useSuppliers();
  const projects = useProjects();
  const invoices = useInvoices();
  const { q } = Route.useSearch();
  const [filter, setFilter] = useState<(typeof types)[number]>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  let preList = inScope(transactions, scope);
  if (filter !== "all") preList = preList.filter((t) => t.type === filter);
  if (q) {
    const qq = q.toLowerCase();
    preList = preList.filter((t) =>
      t.description.toLowerCase().includes(qq) ||
      t.category.toLowerCase().includes(qq) ||
      String(t.amount).includes(qq),
    );
  }

  const fields: FieldDef<Transaction>[] = [
    { key: "date", label: "Date", type: "date", accessor: (t) => t.date },
    { key: "description", label: "Description", type: "string", accessor: (t) => t.description },
    { key: "company", label: "Company", type: "enum", accessor: (t) => companies.find((c) => c.id === t.companyId)?.shortName ?? "" },
    { key: "counterparty", label: "Counterparty", type: "string", accessor: (t) => clients.find((c) => c.id === t.clientId)?.name ?? suppliers.find((s) => s.id === t.supplierId)?.name ?? "" },
    { key: "project", label: "Project", type: "enum", accessor: (t) => projects.find((p) => p.id === t.projectId)?.name ?? "" },
    { key: "category", label: "Category", type: "enum", accessor: (t) => t.category },
    { key: "type", label: "Type", type: "enum", accessor: (t) => t.type },
    { key: "amount", label: "Amount", type: "number", accessor: (t) => t.amount, noGroup: true },
  ];
  const view = useDataView<Transaction>("transactions", fields);
  // Default to date desc if no sort chosen
  const defaultSorted = view.state.sort ? preList : [...preList].sort((a, b) => b.date.localeCompare(a.date));
  const groups = view.apply(defaultSorted);
  const list = groups.flatMap((g) => g.items);

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
        <div className="flex items-center gap-4">
          <ReconcileButton checks={(() => {
            const scoped = inScope(transactions, scope);
            const checks: ReconcileCheck[] = [
              {
                id: "tx-no-project",
                label: "Income transactions linked to a client but no project",
                description: "Infers the project from the matching invoice or first client project.",
                count: scoped.filter((t) => t.type === "income" && t.clientId && !t.projectId).length,
                fix: () => {
                  let n = 0;
                  scoped.forEach((t) => {
                    if (t.type !== "income" || !t.clientId || t.projectId) return;
                    const inv = t.invoiceId ? invoices.find((i) => i.id === t.invoiceId) : undefined;
                    const projId = inv?.projectId ?? projects.find((p) => p.companyId === t.companyId && p.clientId === t.clientId)?.id;
                    if (projId) { transactionsStore.update(t.id, { projectId: projId }); n++; }
                  });
                  return n;
                },
              },
              {
                id: "tx-unlinked-payment",
                label: "Income transactions matching an open invoice (not linked)",
                description: "Links the transaction to the invoice and marks the invoice paid.",
                count: scoped.filter((t) => t.type === "income" && t.clientId && !t.invoiceId &&
                  invoices.some((i) => i.clientId === t.clientId && i.companyId === t.companyId && i.status !== "paid" && i.status !== "cancelled" && Math.abs(i.amount - t.amount) < 0.01 && i.currency === t.currency)
                ).length,
                fix: () => {
                  let n = 0;
                  scoped.forEach((t) => {
                    if (t.type !== "income" || !t.clientId || t.invoiceId) return;
                    const inv = invoices.find((i) => i.clientId === t.clientId && i.companyId === t.companyId && i.status !== "paid" && i.status !== "cancelled" && Math.abs(i.amount - t.amount) < 0.01 && i.currency === t.currency);
                    if (inv) {
                      transactionsStore.update(t.id, { invoiceId: inv.id, projectId: t.projectId ?? inv.projectId });
                      invoicesStore.update(inv.id, { paid: inv.amount, status: "paid", paidDate: t.date });
                      n++;
                    }
                  });
                  return n;
                },
              },
              {
                id: "tx-income-no-counterparty",
                label: "Income transactions without a counterparty (client)",
                description: "Infers the client from a linked invoice or by matching the description against client names.",
                count: scoped.filter((t) => t.type === "income" && !t.clientId).length,
                fix: () => {
                  let n = 0;
                  scoped.forEach((t) => {
                    if (t.type !== "income" || t.clientId) return;
                    const inv = t.invoiceId ? invoices.find((i) => i.id === t.invoiceId) : undefined;
                    let cliId: string | undefined = inv?.clientId;
                    if (!cliId) {
                      const desc = t.description.toLowerCase();
                      const match = clients.find((c) => c.companyId === t.companyId && c.name && desc.includes(c.name.toLowerCase()));
                      cliId = match?.id;
                    }
                    if (cliId) { transactionsStore.update(t.id, { clientId: cliId }); n++; }
                  });
                  return n;
                },
              },
              {
                id: "tx-expense-no-counterparty",
                label: "Expense transactions without a counterparty (supplier)",
                description: "Infers the supplier by matching the transaction description against supplier names.",
                count: scoped.filter((t) => t.type === "expense" && !t.supplierId).length,
                fix: () => {
                  let n = 0;
                  scoped.forEach((t) => {
                    if (t.type !== "expense" || t.supplierId) return;
                    const desc = t.description.toLowerCase();
                    const match = suppliers.find((s) => s.companyId === t.companyId && s.name && desc.includes(s.name.toLowerCase()));
                    if (match) { transactionsStore.update(t.id, { supplierId: match.id }); n++; }
                  });
                  return n;
                },
              },
              {
                id: "tx-no-project-any",
                label: "Transactions without a project (inferable)",
                description: "Infers the project from a linked invoice, from the client's only project, or by matching the description against project names.",
                count: scoped.filter((t) => !t.projectId && (
                  (t.invoiceId && invoices.find((i) => i.id === t.invoiceId)?.projectId) ||
                  (t.clientId && projects.filter((p) => p.companyId === t.companyId && p.clientId === t.clientId).length === 1) ||
                  projects.some((p) => p.companyId === t.companyId && p.name && t.description.toLowerCase().includes(p.name.toLowerCase()))
                )).length,
                fix: () => {
                  let n = 0;
                  scoped.forEach((t) => {
                    if (t.projectId) return;
                    const inv = t.invoiceId ? invoices.find((i) => i.id === t.invoiceId) : undefined;
                    let projId: string | undefined = inv?.projectId;
                    if (!projId && t.clientId) {
                      const candidates = projects.filter((p) => p.companyId === t.companyId && p.clientId === t.clientId);
                      if (candidates.length === 1) projId = candidates[0].id;
                    }
                    if (!projId) {
                      const desc = t.description.toLowerCase();
                      projId = projects.find((p) => p.companyId === t.companyId && p.name && desc.includes(p.name.toLowerCase()))?.id;
                    }
                    if (projId) { transactionsStore.update(t.id, { projectId: projId }); n++; }
                  });
                  return n;
                },
              },
            ];
            return checks;
          })()} />
          <CrudToolbar count={list.length} label="transactions" onCreate={openCreate} />
        </div>
      </div>

      <DataToolbar view={view} items={preList} />

      {list.length === 0 ? (
        <EmptyState label="transactions" onCreate={openCreate} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-x-auto">
          <ResizableTable />
        </div>
      )}

      <TransactionDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );

  function ResizableTable() {
    const cols = [
      { key: "date", label: "Date", align: "left" as const, w: 140 },
      { key: "description", label: "Description", align: "left" as const, w: 260 },
      { key: "company", label: "Company", align: "left" as const, w: 130 },
      { key: "counterparty", label: "Counterparty", align: "left" as const, w: 180 },
      { key: "project", label: "Project", align: "left" as const, w: 160 },
      { key: "category", label: "Category", align: "left" as const, w: 160 },
      { key: "type", label: "Type", align: "left" as const, w: 120 },
      { key: "amount", label: "Amount", align: "right" as const, w: 160 },
      { key: "actions", label: "", align: "right" as const, w: 90 },
    ];
    const defaults = Object.fromEntries(cols.map((c) => [c.key, c.w]));
    const { widths, startResize, resetWidths } = useResizableColumns("tx-col-widths", defaults);
    const total = cols.reduce((s, c) => s + (widths[c.key] ?? c.w), 0);

    return (
      <table className="text-sm" style={{ width: total, tableLayout: "fixed" }}>
        <colgroup>
          {cols.map((c) => <col key={c.key} style={{ width: widths[c.key] ?? c.w }} />)}
        </colgroup>
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            {cols.map((c, i) => (
              <th key={c.key} className={cn("font-medium px-5 py-3 relative select-none", c.align === "right" ? "text-right" : "text-left")}>
                {c.key === "actions" ? (
                  <button
                    onClick={resetWidths}
                    title="Reset column widths"
                    className="text-[10px] text-muted-foreground/70 hover:text-foreground"
                  >
                    reset
                  </button>
                ) : c.label}
                {i < cols.length - 1 && <ResizeHandle onMouseDown={startResize(c.key)} />}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={cols.length} />}
              {g.items.map((t) => {
                const co = companies.find((c) => c.id === t.companyId);
                const cli = t.clientId ? clients.find((c) => c.id === t.clientId) : null;
                const sup = t.supplierId ? suppliers.find((s) => s.id === t.supplierId) : null;
                return (
                  <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 group">
                    <td className="px-5 py-3.5 text-muted-foreground font-tnum text-xs truncate">{format(parseISO(t.date), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3.5 font-medium truncate">{t.description}</td>
                    <td className="px-5 py-3.5 truncate">
                      {co && <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: co.color }} />{co.shortName}</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs truncate">
                      {cli ? <span className="text-success">↑ {cli.name}</span>
                        : sup ? <span className="text-muted-foreground">↓ {sup.name}</span>
                        : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-xs truncate">
                      {(() => {
                        const proj = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
                        return proj
                          ? <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 truncate max-w-full">{proj.name}</span>
                          : <span className="text-muted-foreground/50">—</span>;
                      })()}
                    </td>
                    <td className="px-5 py-3.5 text-muted-foreground truncate">{t.category}</td>
                    <td className="px-5 py-3.5 truncate">
                      <span className={cn(
                        "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
                        t.type === "income" && "border-success/40 text-success bg-success/10",
                        t.type === "expense" && "border-destructive/30 text-destructive bg-destructive/10",
                        t.type === "transfer" && "border-chart-2/30 text-chart-2 bg-chart-2/10",
                        t.type === "intercompany" && "border-chart-4/30 text-chart-4 bg-chart-4/10",
                      )}>{t.type}</span>
                    </td>
                    <td className={cn("px-5 py-3.5 text-right font-tnum font-medium truncate", t.type === "income" && "text-success", t.type === "expense" && "text-destructive")}>
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
            </Fragment>
          ))}
        </tbody>
      </table>
    );
  }
}


function TransactionDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Transaction | null }) {
  const companies = useCompanies();
  const accounts = useAccounts();
  const clients = useClients();
  const suppliers = useSuppliers();
  const categories = useCategories();
  const projects = useProjects();
  const [companyId, setCompanyId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<Transaction["type"]>("expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState<Currency>("MGA");
  const [clientId, setClientId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setAccountId(editing.accountId); setDate(editing.date);
      setType(editing.type); setCategoryId(editing.categoryId ?? ""); setCategoryName(editing.category);
      setDescription(editing.description);
      setAmount(String(editing.amount)); setCurrency(editing.currency);
      setClientId(editing.clientId ?? ""); setSupplierId(editing.supplierId ?? "");
      setProjectId(editing.projectId ?? "");
    } else {
      const c = companies[0]; setCompanyId(c?.id ?? ""); setAccountId(""); setDate(new Date().toISOString().slice(0, 10));
      setType("expense"); setCategoryId(""); setCategoryName(""); setDescription(""); setAmount("0");
      setCurrency(c?.baseCurrency ?? "MGA");
      setClientId(""); setSupplierId(""); setProjectId("");
    }
  }, [open, editing, companies]);

  const companyAccounts = accounts.filter((a) => a.companyId === companyId);
  const companyClients = clients.filter((c) => contactBelongsTo(c, companyId));
  const companySuppliers = suppliers.filter((s) => s.companyId === companyId);
  const kind: "income" | "expense" | null =
    type === "income" ? "income" : type === "expense" ? "expense" : null;
  const companyCategories = categories.filter(
    (c) => c.companyId === companyId && (kind ? c.kind === kind : true),
  );

  const submit = () => {
    if (!description.trim() || !companyId || !accountId) return;
    // Resolve category: explicit selection wins, otherwise create a new one
    // from the free-text name when provided.
    let resolvedId = categoryId || undefined;
    let resolvedName = categoryName.trim();
    if (!resolvedId && resolvedName && kind) {
      const existing = companyCategories.find(
        (c) => c.name.toLowerCase() === resolvedName.toLowerCase(),
      );
      if (existing) {
        resolvedId = existing.id;
      } else {
        const cat = { id: newId("cat"), companyId, name: resolvedName, kind };
        categoriesStore.add(cat);
        resolvedId = cat.id;
      }
    }
    if (resolvedId && !resolvedName) {
      resolvedName = categories.find((c) => c.id === resolvedId)?.name ?? "";
    }
    const data: Omit<Transaction, "id"> = {
      companyId, accountId, date, type,
      category: resolvedName,
      categoryId: resolvedId,
      description,
      amount: Number(amount) || 0, currency,
      clientId: type === "income" ? (clientId || undefined) : undefined,
      supplierId: type === "expense" ? (supplierId || undefined) : undefined,
      projectId: projectId || undefined,
    };
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
          <div>
            <Label>Category</Label>
            <Select
              value={categoryId || "__custom"}
              onValueChange={(v) => {
                if (v === "__custom") { setCategoryId(""); return; }
                setCategoryId(v);
                setCategoryName(companyCategories.find((c) => c.id === v)?.name ?? "");
              }}
              disabled={!kind}
            >
              <SelectTrigger>
                <SelectValue placeholder={kind ? "Pick or create" : "Only for income / expense"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom">— Type a new one —</SelectItem>
                {companyCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!categoryId && (
              <Input
                className="mt-2"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="New category name (Payroll, Services, …)"
              />
            )}
          </div>
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
          {type === "income" && (
            <div>
              <Label>Client</Label>
              <Select value={clientId || "none"} onValueChange={(v) => setClientId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={companyClients.length ? "Link a client" : "No clients for this company"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {companyClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {type === "expense" && (
            <div>
              <Label>Supplier</Label>
              <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={companySuppliers.length ? "Link a supplier" : "No suppliers for this company"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {companySuppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {(type === "income" || type === "expense") && (() => {
            const companyProjects = projects.filter((p) => p.companyId === companyId && (type === "expense" || !clientId || p.clientId === clientId));
            return (
              <div>
                <Label>Project</Label>
                <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={companyProjects.length ? "Link a project" : "No projects for this company"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {companyProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1">Used to track P&L per project (sales & expenses).</p>
              </div>
            );
          })()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
