import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useInvoices, useCompanies, useClients, useProjects, usePurchaseOrders, useQuotes, useAccounts,
  invoicesStore, transactionsStore, projectsStore, purchaseOrdersStore, quotesStore,
  fmtAmount, toMGA, FX, type Invoice, type Project, type Currency,
  getNumberFormat, setNumberFormat, type NumberFormatMode,
, contactBelongsTo } from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { ReconcileButton, type ReconcileCheck } from "@/components/reconcile-button";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useState, useCallback } from "react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Eye, Pencil, Trash2, AlertTriangle, CheckCircle2, Ban, BadgeCheck, ToggleLeft, ToggleRight } from "lucide-react";
import { InvoicePreview } from "@/components/invoice-preview";
import { RecordPaymentDialog } from "@/components/statement-import-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Wallet } from "lucide-react";
import { nextNumber } from "@/lib/numbering";

export const Route = createFileRoute("/_authenticated/invoices")({ component: InvoicesPage });

const statusStyles: Record<string, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  sent: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  partial: "border-warning/40 text-warning bg-warning/10",
  paid: "border-success/40 text-success bg-success/10",
  overdue: "border-destructive/40 text-destructive bg-destructive/10",
  cancelled: "border-muted-foreground/30 text-muted-foreground bg-muted/20 line-through",
};

function InvoicesPage() {
  return (
    <AppShell>
      <PageHeader title="Invoices" description="What's owed and when it lands." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const invoices = useInvoices();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const baseList = inScope(invoices, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [previewing, setPreviewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState<Invoice | null>(null);
  const [marking, setMarking] = useState<Invoice | null>(null);
  const [numMode, setNumMode] = useState<NumberFormatMode>(getNumberFormat());

  const toggleMode = useCallback(() => {
    const next: NumberFormatMode = numMode === "compact" ? "full" : "compact";
    setNumMode(next);
    setNumberFormat(next);
  }, [numMode]);

  const quarterOf = (iso: string) => {
    const d = parseISO(iso);
    return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
  };
  const monthOf = (iso: string) => format(parseISO(iso), "MMM yyyy");
  const dayOf = (iso: string) => format(parseISO(iso), "MMM d, yyyy");

  const fields: FieldDef<Invoice>[] = [
    { key: "number", label: "Number", type: "string", accessor: (i) => i.number, noGroup: true },
    { key: "client", label: "Client", type: "enum", accessor: (i) => clients.find((c) => c.id === i.clientId)?.name ?? "" },
    { key: "project", label: "Project", type: "enum", accessor: (i) => projects.find((p) => p.id === i.projectId)?.name ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (i) => companies.find((c) => c.id === i.companyId)?.shortName ?? "" },
    { key: "status", label: "Status", type: "enum", accessor: (i) => i.status },
    { key: "currency", label: "Currency", type: "enum", accessor: (i) => i.currency },
    { key: "issueDate", label: "Issued", type: "date", accessor: (i) => i.issueDate, noGroup: true },
    { key: "dueDate", label: "Due", type: "date", accessor: (i) => i.dueDate, noGroup: true },
    { key: "issuedDay", label: "Issued (day)", type: "string", accessor: (i) => dayOf(i.issueDate), noSort: true, noFilter: true },
    { key: "issuedMonth", label: "Issued (month)", type: "string", accessor: (i) => monthOf(i.issueDate), noSort: true, noFilter: true },
    { key: "issuedQuarter", label: "Issued (quarter)", type: "string", accessor: (i) => quarterOf(i.issueDate), noSort: true, noFilter: true },
    { key: "amount", label: "Amount", type: "number", accessor: (i) => i.amount, noGroup: true },
    { key: "balance", label: "Balance", type: "number", accessor: (i) => i.amount - i.paid, noGroup: true },
  ];
  const view = useDataView<Invoice>("invoices", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);

  const active = list.filter((i) => i.status !== "cancelled");
  const totalOpen = active.filter((i) => i.status !== "paid").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalOverdue = active.filter((i) => i.status === "overdue").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalPaid = active.filter((i) => i.status === "paid").reduce((s, i) => s + toMGA(i.amount, i.currency), 0);
  const openCreate = () => { setEditing(null); setOpen(true); };


  const scopedInvoices = baseList;
  const scopedTx = transactionsStore.items; // raw for matching
  const checks: ReconcileCheck[] = [
    {
      id: "no-project",
      label: "Invoices without a project",
      description: "Auto-create one project per (company, client) and link orphans.",
      count: scopedInvoices.filter((i) => !i.projectId).length,
      fix: () => {
        const orphans = invoicesStore.items.filter((i) => !i.projectId && inScope([i], scope).length);
        const groups = new Map<string, Invoice[]>();
        orphans.forEach((inv) => {
          const k = `${inv.companyId}::${inv.clientId}`;
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k)!.push(inv);
        });
        let linked = 0;
        groups.forEach((invs, k) => {
          const [companyId, clientId] = k.split("::");
          const cl = clients.find((c) => c.id === clientId);
          let proj = projects.find((p) => p.companyId === companyId && p.clientId === clientId);
          if (!proj) {
            const newProj: Project = {
              id: newId("prj"), companyId, clientId,
              name: cl ? `${cl.name} — engagement` : "Untitled engagement",
              revenue: invs.reduce((s, i) => s + i.amount, 0), cost: 0, currency: invs[0].currency,
            };
            projectsStore.add(newProj); proj = newProj;
          }
          invs.forEach((inv) => { invoicesStore.update(inv.id, { projectId: proj!.id }); linked++; });
        });
        return linked;
      },
    },
    {
      id: "should-be-paid",
      label: "Invoices fully covered by payments but not marked paid",
      description: "Sets status to paid when balance is zero.",
      count: scopedInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.paid >= i.amount && i.amount > 0).length,
      fix: () => {
        let n = 0;
        scopedInvoices.forEach((i) => {
          if (i.status !== "paid" && i.status !== "cancelled" && i.paid >= i.amount && i.amount > 0) {
            invoicesStore.update(i.id, { status: "paid", paidDate: i.paidDate ?? new Date().toISOString().slice(0, 10) });
            n++;
          }
        });
        return n;
      },
    },
    {
      id: "should-be-partial",
      label: "Invoices with partial payment not marked partial",
      count: scopedInvoices.filter((i) => i.paid > 0 && i.paid < i.amount && i.status !== "partial" && i.status !== "cancelled").length,
      fix: () => {
        let n = 0;
        scopedInvoices.forEach((i) => {
          if (i.paid > 0 && i.paid < i.amount && i.status !== "partial" && i.status !== "cancelled") {
            invoicesStore.update(i.id, { status: "partial" }); n++;
          }
        });
        return n;
      },
    },
    {
      id: "paid-no-tx",
      label: "Invoices marked paid with no matching transaction",
      description: "Creates an income transaction so the cashflow ties out.",
      count: scopedInvoices.filter((i) => i.status === "paid" && !scopedTx.some((t) => t.invoiceId === i.id)).length,
      fix: () => {
        let n = 0;
        scopedInvoices.forEach((i) => {
          if (i.status !== "paid") return;
          if (scopedTx.some((t) => t.invoiceId === i.id)) return;
          transactionsStore.add({
            id: newId("tx"), companyId: i.companyId, accountId: "",
            date: i.paidDate ?? new Date().toISOString().slice(0, 10),
            type: "income", category: "Sales", description: `Payment ${i.number}`,
            amount: i.amount, currency: i.currency, clientId: i.clientId,
            projectId: i.projectId, invoiceId: i.id, source: "manual",
          });
          n++;
        });
        return n;
      },
    },
  ];

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <CrudToolbar count={list.length} label="invoices" onCreate={openCreate} />
        <div className="flex items-center gap-4">
          <ReconcileButton checks={checks} />
          <button
            onClick={toggleMode}
            className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title={numMode === "compact" ? "Switch to full numbers" : "Switch to compact numbers"}
          >
            {numMode === "compact" ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
            <span className="hidden sm:inline">{numMode === "compact" ? "Compact" : "Full"}</span>
          </button>
        </div>
      </div>

      <DataToolbar view={view} items={baseList} />

      {list.length === 0 ? (
        <EmptyState label="invoices" onCreate={openCreate} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="Open receivables" value={fmtAmount(totalOpen, "MGA")} />
            <Stat label="Overdue" value={fmtAmount(totalOverdue, "MGA")} danger />
            <Stat label="Collected (period)" value={fmtAmount(totalPaid, "MGA")} good />
          </div>

          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-5 py-3">Number</th>
                  <th className="text-left font-medium px-5 py-3">Client</th>
                  <th className="text-left font-medium px-5 py-3">Project</th>

                  <th className="text-left font-medium px-5 py-3">Company</th>
                  <th className="text-left font-medium px-5 py-3">Issued</th>
                  <th className="text-left font-medium px-5 py-3">Due</th>
                  <th className="text-left font-medium px-5 py-3">Paid on</th>
                  <th className="text-left font-medium px-5 py-3">Timing</th>
                  <th className="text-left font-medium px-5 py-3">Status</th>
                  <th className="text-right font-medium px-5 py-3">Amount</th>
                  <th className="text-right font-medium px-5 py-3">Balance</th>
                  <th className="px-5 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={12} />}
                    {g.items.map((inv) => {
                  const co = companies.find((c) => c.id === inv.companyId);
                  const cl = clients.find((c) => c.id === inv.clientId);
                  const proj = inv.projectId ? projects.find((p) => p.id === inv.projectId) : undefined;
                  
                  const days = differenceInDays(parseISO(inv.dueDate), new Date());
                  const balance = inv.amount - inv.paid;
                  const timing = inv.paidDate
                    ? differenceInDays(parseISO(inv.paidDate), parseISO(inv.dueDate))
                    : null;
                  return (
                    <tr key={inv.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 group">
                      <td className="px-5 py-3.5 font-tnum text-xs text-muted-foreground">{inv.number}</td>
                      <td className="px-5 py-3.5 font-medium">{cl?.name ?? "—"}</td>
                      <td className="px-5 py-3.5 text-xs">
                        {proj ? <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">{proj.name}</span> : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-5 py-3.5">

                        {co && <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: co.color }} />{co.shortName}</span>}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-tnum">{format(parseISO(inv.issueDate), "MMM d, yyyy")}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-tnum">
                        {format(parseISO(inv.dueDate), "MMM d, yyyy")}
                        {!inv.paidDate && days < 0 && <span className="ml-2 text-destructive">{Math.abs(days)}d late</span>}
                        {!inv.paidDate && days >= 0 && days < 14 && <span className="ml-2 text-warning">in {days}d</span>}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs font-tnum">
                        {inv.paidDate ? format(parseISO(inv.paidDate), "MMM d, yyyy") : <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {timing === null ? (
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Pending</span>
                        ) : timing <= 0 ? (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-success/40 text-success bg-success/10">
                            {timing === 0 ? "On due day" : `Early ${Math.abs(timing)}d`}
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-destructive/40 text-destructive bg-destructive/10">
                            Late {timing}d
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", statusStyles[inv.status])} title={inv.status === "cancelled" && inv.cancellationReason ? `Cancelled: ${inv.cancellationReason}` : undefined}>{inv.status}</span>
                        {inv.status === "cancelled" && inv.cancellationReason && (
                          <div className="text-[10px] text-muted-foreground mt-1 max-w-[180px] truncate italic" title={inv.cancellationReason}>“{inv.cancellationReason}”</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-tnum">{fmtAmount(inv.amount, inv.currency)}</td>
                      <td className="px-5 py-3.5 text-right font-tnum font-medium">
                        {inv.status === "cancelled" ? <span className="text-muted-foreground">—</span> : balance > 0 ? fmtAmount(balance, inv.currency) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                          <button onClick={() => setPreviewing(inv)} title="Preview & export PDF" className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                          {inv.status !== "paid" && inv.status !== "cancelled" && (
                            <>
                              <button onClick={() => setPaying(inv)} title="Add payment" className="h-7 w-7 grid place-items-center rounded hover:bg-success/10 text-muted-foreground hover:text-success"><Wallet className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setMarking(inv)} title="Mark as paid" className="h-7 w-7 grid place-items-center rounded hover:bg-success/10 text-muted-foreground hover:text-success"><BadgeCheck className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setCancelling(inv)} title="Cancel invoice" className="h-7 w-7 grid place-items-center rounded hover:bg-warning/10 text-muted-foreground hover:text-warning"><Ban className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                          <button onClick={() => { setEditing(inv); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => confirm(`Delete invoice ${inv.number}?`) && invoicesStore.remove(inv.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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

      <InvoiceDialog open={open} onOpenChange={setOpen} editing={editing} />
      <InvoicePreview
        open={!!previewing}
        onOpenChange={(v) => { if (!v) setPreviewing(null); }}
        invoice={previewing}
        company={previewing ? companies.find((c) => c.id === previewing.companyId) : undefined}
        client={previewing ? clients.find((c) => c.id === previewing.clientId) : undefined}
        project={previewing?.projectId ? projects.find((p) => p.id === previewing.projectId) : undefined}
        po={previewing?.poId ? purchaseOrdersStore.items.find((p) => p.id === previewing.poId) : undefined}
        quote={previewing?.quoteId ? quotesStore.items.find((q) => q.id === previewing.quoteId) : undefined}
      />
      <RecordPaymentDialog open={!!paying} onOpenChange={(v) => { if (!v) setPaying(null); }} invoice={paying} />
      <CancelInvoiceDialog open={!!cancelling} onOpenChange={(v) => { if (!v) setCancelling(null); }} invoice={cancelling} />
      <MarkPaidDialog open={!!marking} onOpenChange={(v) => { if (!v) setMarking(null); }} invoice={marking} />
    </div>
  );
}

function CancelInvoiceDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (v: boolean) => void; invoice: Invoice | null }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!invoice) return null;
  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    invoicesStore.update(invoice.id, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancellationReason: trimmed,
    });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cancel invoice {invoice.number}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            The invoice will remain in the CRM with a <span className="text-foreground font-medium">cancelled</span> status. This action cannot be undone from this dialog.
          </p>
          <div>
            <Label>Reason <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this invoice being cancelled?"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep invoice</Button>
          <Button variant="destructive" onClick={submit} disabled={!reason.trim()}>
            <Ban className="h-3.5 w-3.5 mr-1.5" /> Cancel invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function deriveStatus(amount: number, paid: number, dueDate: string): Invoice["status"] {
  if (paid >= amount && amount > 0) return "paid";
  if (paid > 0 && paid < amount) return "partial";
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return "overdue";
  return "sent";
}

function InvoiceDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Invoice | null }) {
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const pos = usePurchaseOrders();
  const quotes = useQuotes();
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [poId, setPoId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [amount, setAmount] = useState("0");
  const [paid, setPaid] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [status, setStatus] = useState<Invoice["status"]>("draft");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumber(editing.number); setCompanyId(editing.companyId); setClientId(editing.clientId);
      setProjectId(editing.projectId ?? ""); setPoId(editing.poId ?? "");
      setIssueDate(editing.issueDate); setDueDate(editing.dueDate);
      setAmount(String(editing.amount)); setPaid(String(editing.paid));
      setCurrency(editing.currency); setStatus(editing.status);
    } else {
      const cid = companies[0]?.id ?? "";
      setNumber(cid ? nextNumber("invoice", cid) : ""); setCompanyId(cid); setClientId("");
      setProjectId(""); setPoId("");
      setIssueDate(today); setDueDate(today); setAmount("0"); setPaid("0");
      setCurrency(companies[0]?.baseCurrency ?? "EUR"); setStatus("draft");
    }
  }, [open, editing, companies, today]);

  // Re-derive the number when the user switches company on a NEW invoice.
  useEffect(() => {
    if (!open || editing || !companyId) return;
    setNumber(nextNumber("invoice", companyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const companyClients = clients.filter((c) => contactBelongsTo(c, companyId));
  const clientProjects = projects.filter((p) => p.companyId === companyId && p.clientId === clientId);
  const clientPOs = pos.filter((p) => p.companyId === companyId && p.clientId === clientId && p.status !== "cancelled");
  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedPO = pos.find((p) => p.id === poId);
  const linkedQuote = selectedPO?.quoteId ? quotes.find((q) => q.id === selectedPO.quoteId) : undefined;

  // When PO is picked, prefill amount/currency/project from it.
  useEffect(() => {
    if (!poId) return;
    const po = pos.find((x) => x.id === poId);
    if (po) {
      setAmount(String(po.amount)); setCurrency(po.currency);
      if (po.projectId) setProjectId(po.projectId);
    }
  }, [poId, pos]);

  const processOk = Boolean(poId);
  const blocked = !processOk && status !== "draft";

  const submit = () => {
    if (!number.trim() || !companyId || !clientId) return;
    if (blocked) return;
    const a = Number(amount) || 0;
    const p = Number(paid) || 0;
    const finalStatus = status === "draft" ? "draft" : deriveStatus(a, p, dueDate);
    // Inherit lines from PO (preferred) or directly from the linked quote.
    const inheritedLines = selectedPO?.lines ?? linkedQuote?.lines;
    const data = {
      number, companyId, clientId,
      projectId: projectId || undefined,
      poId: poId || undefined,
      quoteId: linkedQuote?.id,
      issueDate, dueDate, amount: a, paid: p, currency, status: finalStatus,
      lines: inheritedLines ? inheritedLines.map((l) => ({ ...l })) : (editing?.lines ?? undefined),
    };
    if (editing) invoicesStore.update(editing.id, data);
    else invoicesStore.add({ id: newId("inv"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>

        {/* Process strip */}
        <ProcessStrip hasQuote={Boolean(linkedQuote)} hasPO={Boolean(selectedPO)} />

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Number</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as Invoice["status"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent" disabled={!processOk}>Sent {!processOk && "(needs PO)"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); setPoId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); setPoId(""); }}>
                <SelectTrigger><SelectValue placeholder={companyClients.length ? "Select" : "Create client first"} /></SelectTrigger>
                <SelectContent>{companyClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {selectedClient?.acquisition && (
                <p className="text-[11px] text-muted-foreground mt-1">Sales rep: <span className="text-foreground">{selectedClient.acquisition}</span></p>
              )}
            </div>
          </div>

          <div>
            <Label>Purchase order <span className="text-destructive">*</span></Label>
            <Select value={poId || "__none__"} onValueChange={(v) => setPoId(v === "__none__" ? "" : v)} disabled={!clientId}>
              <SelectTrigger className={cn(!processOk && status !== "draft" && "border-destructive")}>
                <SelectValue placeholder={clientId ? (clientPOs.length ? "Select PO" : "No PO for this client") : "Select client first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No PO —</SelectItem>
                {clientPOs.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} · {fmtAmount(p.amount, p.currency)} · {p.status}</SelectItem>)}
              </SelectContent>
            </Select>
            {blocked && (
              <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Process: link an accepted PO before sending the invoice.</p>
            )}
            {!blocked && processOk && (
              <p className="text-[11px] text-success mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Quote → PO → Invoice process complete.</p>
            )}
          </div>

          <div>
            <Label>Project</Label>
            <Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? "" : v)} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder={clientId ? (clientProjects.length ? "Select project" : "No projects for this client") : "Select client first"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No project —</SelectItem>
                {clientProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Amount</Label>
              <div className="relative">
                <Input type="number" className="pr-10" value={amount} onChange={(e) => setAmount(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                  {currency === "EUR" ? "€" : currency === "USD" ? "$" : "Ar"}
                </span>
              </div>
            </div>
            <div>
              <Label>Paid</Label>
              <div className="relative">
                <Input type="number" className="pr-10" value={paid} onChange={(e) => setPaid(e.target.value)} />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                  {currency === "EUR" ? "€" : currency === "USD" ? "$" : "Ar"}
                </span>
              </div>
            </div>
            <div>
              <Label>Currency</Label>
              <div className="mt-1 inline-flex rounded-md border border-border overflow-hidden text-xs">
                {(["EUR", "USD", "MGA"] as Currency[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={cn(
                      "px-3 py-1.5 font-tnum",
                      currency === c ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-surface-elevated",
                      c !== "EUR" && "border-l border-border"
                    )}
                  >
                    {c === "EUR" ? "€ EUR" : c === "USD" ? "$ USD" : "Ar MGA"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={blocked}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProcessStrip({ hasQuote, hasPO }: { hasQuote: boolean; hasPO: boolean }) {
  const Step = ({ n, label, done, current }: { n: number; label: string; done: boolean; current?: boolean }) => (
    <div className="flex items-center gap-2">
      <div className={cn("h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold border",
        done ? "bg-success/15 border-success/40 text-success" : current ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/30 border-border text-muted-foreground")}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={cn("text-xs", done ? "text-success" : current ? "text-foreground" : "text-muted-foreground")}>{label}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface/40 p-2.5">
      <Step n={1} label="Quote" done={hasQuote} current={!hasQuote} />
      <div className="h-px flex-1 bg-border" />
      <Step n={2} label="PO" done={hasPO} current={hasQuote && !hasPO} />
      <div className="h-px flex-1 bg-border" />
      <Step n={3} label="Invoice" done={false} current={hasPO} />
    </div>
  );
}

function Stat({ label, value, danger, good }: { label: string; value: string; danger?: boolean; good?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("font-display text-2xl font-bold mt-2 font-tnum", danger && "text-destructive", good && "text-success")}>{value}</div>
    </div>
  );
}

function MarkPaidDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (v: boolean) => void; invoice: Invoice | null }) {
  const accounts = useAccounts();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState<string>("");
  const [receivedMga, setReceivedMga] = useState<string>("");

  const coAccounts = invoice ? accounts.filter((a) => a.companyId === invoice.companyId) : [];
  const expectedMga = invoice ? Math.round(toMGA(invoice.amount - invoice.paid, invoice.currency)) : 0;
  const isForeign = !!invoice && invoice.currency !== "MGA";

  useEffect(() => {
    if (open && invoice) {
      setDate(new Date().toISOString().slice(0, 10));
      setReceivedMga(String(expectedMga));
      // Prefer first MGA account of the same company
      const mgaAcc = coAccounts.find((a) => a.currency === "MGA") ?? coAccounts[0];
      setAccountId(mgaAcc?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice]);

  if (!invoice) return null;

  const account = coAccounts.find((a) => a.id === accountId);
  const remaining = invoice.amount - invoice.paid;
  const receivedNum = Number(receivedMga) || 0;
  // FX delta in MGA: positive = gain, negative = loss (perte de change)
  const fxDelta = isForeign ? receivedNum - expectedMga : 0;

  const submit = () => {
    if (invoice.status === "cancelled") return;
    invoicesStore.update(invoice.id, {
      paid: invoice.amount,
      paidDate: date,
      status: "paid",
    });
    // Payment transaction (in invoice currency, for ledger consistency)
    if (account && remaining > 0) {
      transactionsStore.add({
        id: newId("tx"),
        companyId: invoice.companyId,
        accountId: account.id,
        date,
        type: "income",
        category: "Encaissements clients",
        description: `Payment · ${invoice.number}`,
        amount: remaining,
        currency: invoice.currency,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        invoiceId: invoice.id,
        source: "manual",
      });
    }
    // FX gain/loss (in MGA — the difference between what was expected and what landed)
    if (isForeign && Math.abs(fxDelta) >= 1 && account) {
      const isGain = fxDelta > 0;
      transactionsStore.add({
        id: newId("tx"),
        companyId: invoice.companyId,
        accountId: account.id,
        date,
        type: isGain ? "income" : "expense",
        category: isGain ? "Gain de change" : "Perte de change",
        description: `FX ${isGain ? "gain" : "loss"} · ${invoice.number} (${invoice.currency} → MGA)`,
        amount: Math.abs(fxDelta),
        currency: "MGA",
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        invoiceId: invoice.id,
        source: "manual",
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark as paid · {invoice.number}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-surface/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice total</span><span className="font-tnum">{invoice.amount.toLocaleString()} {invoice.currency}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remaining</span><span className="font-tnum">{remaining.toLocaleString()} {invoice.currency}</span></div>
            {isForeign && (
              <div className="flex justify-between"><span className="text-muted-foreground">Expected in MGA (rate {FX[invoice.currency].toLocaleString()})</span><span className="font-tnum">{expectedMga.toLocaleString()} MGA</span></div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Payment date</Label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div>
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {coAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isForeign && (
            <div>
              <Label>Actual MGA received</Label>
              <input type="number" value={receivedMga} onChange={(e) => setReceivedMga(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-tnum" />
              {Math.abs(fxDelta) >= 1 && (
                <div className={cn("mt-1.5 text-[11px] font-tnum", fxDelta > 0 ? "text-success" : "text-destructive")}>
                  {fxDelta > 0 ? "Gain" : "Perte"} de change: {fxDelta > 0 ? "+" : "−"}{Math.abs(fxDelta).toLocaleString()} MGA
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Mark paid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
