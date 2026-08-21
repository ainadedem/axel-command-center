import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useTransactions, useCompanies, useAccounts, useClients, useSuppliers, useCategories, useProjects, useInvoices,
  transactionsStore, categoriesStore, invoicesStore, fmtCompact, type Transaction, type Currency,
  contactBelongsTo,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { ReconcileButton, type ReconcileCheck } from "@/components/reconcile-button";
import { format, parseISO } from "date-fns";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Link2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { VerifiedBadge } from "@/components/status-badge";
import { PaymentMatchDialog } from "@/components/payment-match-dialog";
import { buildPaymentProof, badgeState, type ProofInvoice, type ProofTransaction } from "@/lib/payment-proof";
import { useQuotes, usePurchaseOrders } from "@/lib/mock-data";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";
import { useRowWindow, SpacerRow, useScrollRef } from "@/components/virtual-rows";
import { LiveAmount, RowSaveState } from "@/components/save-state";

const TX_COLUMNS: ColumnDef[] = [
  { key: "date", label: "Date", priority: "always" },
  { key: "description", label: "Description", priority: "always" },
  { key: "company", label: "Company" },
  { key: "counterparty", label: "Counterparty" },
  { key: "project", label: "Project", priority: "optional" },
  { key: "account", label: "Account" },
  { key: "category", label: "Category", priority: "optional" },
  { key: "type", label: "Type" },
  { key: "linked", label: "Linked to" },
  { key: "amount", label: "Amount", priority: "always" },
];

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
  const accounts = useAccounts();
  const clients = useClients();
  const suppliers = useSuppliers();
  const projects = useProjects();
  const invoices = useInvoices();
  const quotes = useQuotes();
  const pos = usePurchaseOrders();
  const { q } = Route.useSearch();
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  const [linking, setLinking] = useState<Transaction | null>(null);
  const [unlinking, setUnlinking] = useState<Transaction | null>(null);

  /** Invoice + quotation a receipt points at, with the shared payment verdict. */
  const linkOf = useCallback((t: Transaction) => {
    const inv = t.invoiceId ? invoices.find((i) => i.id === t.invoiceId) : undefined;
    if (!inv) return null;
    const proof = buildPaymentProof(
      inv as unknown as ProofInvoice, transactions as never, quotes as never, pos as never,
    );
    return { invoice: inv, quote: proof.quote, verification: proof.verification };
  }, [invoices, transactions, quotes, pos]);
  const [filter, setFilter] = useState<(typeof types)[number]>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  let preList = inScope(transactions, scope);
  if (filter !== "all") preList = preList.filter((t) => t.type === filter);
  if (unlinkedOnly) preList = preList.filter((t) => t.type === "income" && !t.invoiceId);
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
    { key: "account", label: "Account", type: "enum", accessor: (t) => accounts.find((a) => a.id === t.accountId)?.name ?? "" },
    { key: "category", label: "Category", type: "enum", accessor: (t) => t.category },
    { key: "type", label: "Type", type: "enum", accessor: (t) => t.type },
    { key: "linked", label: "Linked to", type: "string", accessor: (t) => (t.invoiceId ? invoices.find((i) => i.id === t.invoiceId)?.number ?? "" : "") },
    { key: "amount", label: "Amount", type: "number", accessor: (t) => t.amount, noGroup: true },
  ];
  const view = useDataView<Transaction>("transactions", fields);
  // Default to date desc if no sort chosen
  const defaultSorted = view.state.sort ? preList : [...preList].sort((a, b) => b.date.localeCompare(a.date));
  const groups = view.apply(defaultSorted);
  const list = groups.flatMap((g) => g.items);

  const cp = useColumnPrefs("transactions", TX_COLUMNS);

  // Flatten groups so long ledgers can render only the rows in view.
  const flatRows = useMemo(() => {
    const rows: ({ kind: "group"; key: string; label: string; count: number } | { kind: "item"; key: string; tx: Transaction })[] = [];
    groups.forEach((g) => {
      if (groups.length > 1) rows.push({ kind: "group", key: `g:${g.key}`, label: g.label, count: g.items.length });
      g.items.forEach((t) => rows.push({ kind: "item", key: t.id, tx: t }));
    });
    return rows;
  }, [groups]);

  const scrollRef = useScrollRef();
  const windowed = useRowWindow({ rows: flatRows, scrollRef });


  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
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
          <button
            onClick={() => setUnlinkedOnly((v) => !v)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition border",
              unlinkedOnly
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-surface hover:bg-surface-elevated text-muted-foreground hover:text-foreground",
            )}
          >
            Unlinked receipts
          </button>
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
          <CrudToolbar createLabel="New transaction" count={list.length} label="transactions" onCreate={openCreate} />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <ColumnPicker prefs={cp} />
        <DataToolbar view={view} items={preList} />
      </div>

      {list.length === 0 ? (
        <EmptyState label="transactions" onCreate={openCreate} />
      ) : (
        <ListTableShell
          stickyHeader={windowed.active}
          scrollRef={windowed.active ? scrollRef : undefined}
          maxHeight={windowed.active ? "calc(100dvh - 22rem)" : undefined}
        >
          <ListTable>
            <thead>
              <ListHeadRow>
                <ListActionsTh />
<ListTh width="11%">Date</ListTh>
                <ListTh width="20%">Description</ListTh>
                {cp.on("company") && <ListTh width="9%">Company</ListTh>}
                {cp.on("counterparty") && <ListTh width="14%">Counterparty</ListTh>}
                {cp.on("project") && <ListTh width="12%">Project</ListTh>}
                {cp.on("account") && <ListTh width="12%">Account</ListTh>}
                {cp.on("category") && <ListTh width="12%">Category</ListTh>}
                {cp.on("type") && <ListTh width="9%">Type</ListTh>}
                {cp.on("linked") && <ListTh width="16%">Linked to</ListTh>}
                <ListTh width="13%" align="right">Amount</ListTh>
              </ListHeadRow>
            </thead>
            <tbody>
              <SpacerRow height={windowed.padTop} colSpan={cp.count + 1} />
              {windowed.items.map((row) => {
                if (row.kind === "group") {
                  return <GroupHeaderRow key={row.key} label={row.label} count={row.count} colSpan={cp.count + 1} />;
                }
                const t = row.tx;
                {
                    const co = companies.find((c) => c.id === t.companyId);
                    const cli = t.clientId ? clients.find((c) => c.id === t.clientId) : null;
                    const sup = t.supplierId ? suppliers.find((s) => s.id === t.supplierId) : null;
                    const proj = t.projectId ? projects.find((p) => p.id === t.projectId) : null;
                    const acc = accounts.find((a) => a.id === t.accountId);
                    return (
                      <Fragment key={t.id}>
                      <tr className="hover:bg-surface-elevated/40" data-row-id={t.id}>
<ListRowActions colSpan={cp.count}>
                        <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { setEditing(t); setOpen(true); }} />
                        {t.type === "income" && !t.invoiceId && (
                          <RowAction icon={<Link2 className="h-3.5 w-3.5" />} label="Link to invoice" onClick={() => setLinking(t)} />
                        )}
                        {t.invoiceId && linkOf(t) && (
                          <RowAction icon={<Unlink className="h-3.5 w-3.5" />} label="Unlink payment" onClick={() => setUnlinking(t)} />
                        )}
                        <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => { if (confirm("Delete this transaction?")) transactionsStore.remove(t.id); }} />
                      </ListRowActions>

                        <ListTd className="text-muted-foreground font-tnum text-xs">{format(parseISO(t.date), "MMM d, yyyy")}</ListTd>
                        <ListTd className="font-medium" title={t.description}>
                          <span className="inline-flex items-center gap-1.5 max-w-full">
                            <span className="truncate">{t.description}</span>
                            <RowSaveState collection="transactions" id={t.id} />
                          </span>
                        </ListTd>
                        {cp.on("company") && (
                          <ListTd title={co?.name}>
                            {co && <span className="inline-flex items-center gap-2 text-xs max-w-full"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: co.color }} /><span className="truncate">{co.shortName}</span></span>}
                          </ListTd>
                        )}
                        {cp.on("counterparty") && (
                          <ListTd className="text-xs" title={cli?.name ?? sup?.name}>
                            {cli ? <span className="text-success">↑ {cli.name}</span>
                              : sup ? <span className="text-muted-foreground">↓ {sup.name}</span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </ListTd>
                        )}
                        {cp.on("project") && (
                          <ListTd className="text-xs" title={proj?.name}>
                            {proj
                              ? <span className="inline-block max-w-full truncate px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 align-middle">{proj.name}</span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </ListTd>
                        )}
                        {cp.on("account") && (
                          <ListTd className="text-xs" title={acc?.name}>
                            {acc
                              ? <span className="inline-block max-w-full truncate px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 align-middle">{acc.name}</span>
                              : <span className="text-muted-foreground/50">—</span>}
                          </ListTd>
                        )}
                        {cp.on("category") && <ListTd className="text-muted-foreground" title={t.category}>{t.category}</ListTd>}
                        {cp.on("type") && (
                          <ListTd>
                            <span className={cn(
                              "inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
                              t.type === "income" && "border-success/40 text-success bg-success/10",
                              t.type === "expense" && "border-destructive/30 text-destructive bg-destructive/10",
                              t.type === "transfer" && "border-chart-2/30 text-chart-2 bg-chart-2/10",
                              t.type === "intercompany" && "border-chart-4/30 text-chart-4 bg-chart-4/10",
                            )}>{t.type}</span>
                          </ListTd>
                        )}
                        {cp.on("linked") && (
                          <ListTd className="text-xs">
                            {(() => {
                              const link = linkOf(t);
                              if (!link) {
                                return t.type === "income"
                                  ? <span className="text-muted-foreground/60">Not linked</span>
                                  : <span className="text-muted-foreground/50">—</span>;
                              }
                              return (
                                <span className="inline-flex max-w-full items-center gap-1.5">
                                  <Link
                                    to="/invoices"
                                    search={{ focus: link.invoice.id } as never}
                                    className="truncate text-primary hover:underline"
                                    title={`Invoice ${link.invoice.number}`}
                                  >
                                    {link.invoice.number}
                                  </Link>
                                  {link.quote && (
                                    <Link
                                      to="/quotations"
                                      search={{ focus: link.quote.id } as never}
                                      className="truncate text-muted-foreground hover:underline"
                                      title={`Quotation ${link.quote.number}`}
                                    >
                                      {link.quote.number}
                                    </Link>
                                  )}
                                  {link.verification !== "n/a" && (
                                    <VerifiedBadge state={badgeState(link.verification)} />
                                  )}
                                </span>
                              );
                            })()}
                          </ListTd>
                        )}
                        <ListTd align="right" className={cn("font-tnum font-medium", t.type === "income" && "text-success", t.type === "expense" && "text-destructive")}>
                          <LiveAmount collection="transactions" id={t.id}>
                            {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{fmtCompact(t.amount, t.currency)}
                          </LiveAmount>
                        </ListTd>
                      </tr>
                      </Fragment>
                    );
                }
              })}
              <SpacerRow height={windowed.padBottom} colSpan={cp.count + 1} />
            </tbody>
          </ListTable>
        </ListTableShell>
      )}

      <TransactionDialog open={open} onOpenChange={setOpen} editing={editing} />

      <PaymentMatchDialog
        open={!!linking}
        onOpenChange={(v) => { if (!v) setLinking(null); }}
        invoices={[]}
        transaction={(linking as unknown as ProofTransaction) ?? undefined}
      />
    </div>
  );
}



function TransactionDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Transaction | null }) {
  const { dataLoading, scopedCompanies } = useCompany();
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
  const [showErrors, setShowErrors] = useState(false);

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
      const c = scopedCompanies[0] ?? companies[0];
      setCompanyId(c?.id ?? "");
      setAccountId("");
      setDate(new Date().toISOString().slice(0, 10));
      setType("expense"); setCategoryId(""); setCategoryName(""); setDescription(""); setAmount("0");
      setCurrency(c?.baseCurrency ?? "MGA");
      setClientId(""); setSupplierId(""); setProjectId("");
    }
    setShowErrors(false);
  }, [open, editing, companies, scopedCompanies]);

  const companyAccounts = accounts.filter((a) => a.companyId === companyId);
  const accountsLoading = dataLoading && !!companyId && companyAccounts.length === 0;
  const companyClients = clients.filter((c) => contactBelongsTo(c, companyId));
  const companySuppliers = suppliers.filter((s) => s.companyId === companyId);
  const kind: "income" | "expense" | null =
    type === "income" ? "income" : type === "expense" ? "expense" : null;
  const companyCategories = categories.filter(
    (c) => c.companyId === companyId && (kind ? c.kind === kind : true),
  );
  const companyProjects = projects.filter(
    (project) => project.companyId === companyId && (type === "expense" || !clientId || project.clientId === clientId),
  );

  useReconciledSelection({
    open,
    currentValue: companyId,
    options: scopedCompanies,
    getId: (company) => company.id,
    onChange: setCompanyId,
  });

  useEffect(() => {
    if (!open || !companyId) return;
    const currentStillAvailable = companyAccounts.some((account) => account.id === accountId);
    if (currentStillAvailable) return;
    if (companyAccounts.length > 0) {
      setAccountId(companyAccounts[0].id);
      return;
    }
    if (!accountsLoading) setAccountId("");
  }, [open, companyId, accountId, companyAccounts, accountsLoading]);

  useReconciledSelection({
    open,
    currentValue: accountId,
    options: companyAccounts,
    getId: (account) => account.id,
    loading: accountsLoading,
    onChange: setAccountId,
  });

  useReconciledSelection({
    open,
    currentValue: clientId,
    options: companyClients,
    getId: (client) => client.id,
    allowEmpty: true,
    onChange: setClientId,
  });

  useReconciledSelection({
    open,
    currentValue: supplierId,
    options: companySuppliers,
    getId: (supplier) => supplier.id,
    allowEmpty: true,
    onChange: setSupplierId,
  });

  useReconciledSelection({
    open,
    currentValue: categoryId,
    options: companyCategories,
    getId: (category) => category.id,
    allowEmpty: true,
    onChange: setCategoryId,
  });

  useReconciledSelection({
    open,
    currentValue: projectId,
    options: companyProjects,
    getId: (project) => project.id,
    allowEmpty: true,
    onChange: setProjectId,
  });

  const submit = () => {
    const invalid = !description.trim() || !companyId || !accountId;
    if (invalid) {
      setShowErrors(true);
      return;
    }
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
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit transaction" : "New transaction"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label><RequiredLabel>Company</RequiredLabel></Label>
                <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setAccountId(""); }}>
                  <SelectTrigger className={invalidFieldClassName(showErrors && !companyId)} aria-invalid={showErrors && !companyId}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{scopedCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label><RequiredLabel>Account</RequiredLabel></Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={accountsLoading || companyAccounts.length === 0}>
                <SelectTrigger className={invalidFieldClassName(showErrors && !accountId)} aria-invalid={showErrors && !accountId}><SelectValue placeholder={accountsLoading ? "Loading accounts..." : companyAccounts.length ? "Select" : "Create account first"} /></SelectTrigger>
                <SelectContent>{companyAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div><Label><RequiredLabel>Description</RequiredLabel></Label><Input value={description} onChange={(e) => setDescription(e.target.value)} className={invalidFieldClassName(showErrors && !description.trim())} aria-invalid={showErrors && !description.trim()} /></div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
