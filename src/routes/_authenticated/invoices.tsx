import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useInvoices, useCompanies, useClients, useProjects, usePurchaseOrders, useQuotes, invoicesStore,
  fmtCompact, toMGA, type Invoice, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Eye, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { InvoicePreview } from "@/components/invoice-preview";

export const Route = createFileRoute("/_authenticated/invoices")({ component: InvoicesPage });

const statusStyles: Record<string, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  sent: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  partial: "border-warning/40 text-warning bg-warning/10",
  paid: "border-success/40 text-success bg-success/10",
  overdue: "border-destructive/40 text-destructive bg-destructive/10",
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
  const list = inScope(invoices, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [previewing, setPreviewing] = useState<Invoice | null>(null);

  const totalOpen = list.filter((i) => i.status !== "paid").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalOverdue = list.filter((i) => i.status === "overdue").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalPaid = list.filter((i) => i.status === "paid").reduce((s, i) => s + toMGA(i.amount, i.currency), 0);
  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <div className="p-8 space-y-5">
      <CrudToolbar count={list.length} label="invoices" onCreate={openCreate} />

      {list.length === 0 ? (
        <EmptyState label="invoices" onCreate={openCreate} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="Open receivables" value={fmtCompact(totalOpen, "MGA")} />
            <Stat label="Overdue" value={fmtCompact(totalOverdue, "MGA")} danger />
            <Stat label="Collected (period)" value={fmtCompact(totalPaid, "MGA")} good />
          </div>

          <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-5 py-3">Number</th>
                  <th className="text-left font-medium px-5 py-3">Client</th>
                  <th className="text-left font-medium px-5 py-3">Project</th>
                  <th className="text-left font-medium px-5 py-3">Sales rep</th>
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
                {list.map((inv) => {
                  const co = companies.find((c) => c.id === inv.companyId);
                  const cl = clients.find((c) => c.id === inv.clientId);
                  const proj = inv.projectId ? projects.find((p) => p.id === inv.projectId) : undefined;
                  const salesRep = cl?.acquisition;
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
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{salesRep ?? <span className="text-muted-foreground/50">—</span>}</td>
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
                        <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", statusStyles[inv.status])}>{inv.status}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(inv.amount, inv.currency)}</td>
                      <td className="px-5 py-3.5 text-right font-tnum font-medium">
                        {balance > 0 ? fmtCompact(balance, inv.currency) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                          <button onClick={() => setPreviewing(inv)} title="Preview & export PDF" className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                          <button onClick={() => { setEditing(inv); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => confirm(`Delete invoice ${inv.number}?`) && invoicesStore.remove(inv.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
      />
    </div>
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
      setNumber(`INV-${Date.now().toString().slice(-6)}`); setCompanyId(companies[0]?.id ?? ""); setClientId("");
      setProjectId(""); setPoId("");
      setIssueDate(today); setDueDate(today); setAmount("0"); setPaid("0");
      setCurrency(companies[0]?.baseCurrency ?? "EUR"); setStatus("draft");
    }
  }, [open, editing, companies, today]);

  const companyClients = clients.filter((c) => c.companyId === companyId);
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
    const data = {
      number, companyId, clientId,
      projectId: projectId || undefined,
      poId: poId || undefined,
      quoteId: linkedQuote?.id,
      issueDate, dueDate, amount: a, paid: p, currency, status: finalStatus,
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
                {clientPOs.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} · {fmtCompact(p.amount, p.currency)} · {p.status}</SelectItem>)}
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
            <div><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label>Paid</Label><Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} /></div>
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
