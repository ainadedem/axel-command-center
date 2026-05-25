import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  usePurchaseOrders, useQuotes, useCompanies, useClients, useProjects, purchaseOrdersStore,
  fmtCompact, type PurchaseOrder, type POStatus, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Upload, FileText, X, History, RefreshCw } from "lucide-react";

type DocVersion = { url: string; name?: string; type?: string; uploadedAt: string };

export const Route = createFileRoute("/_authenticated/purchase-orders")({ component: POPage });

const statusStyles: Record<POStatus, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  issued: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  fulfilled: "border-success/40 text-success bg-success/10",
  cancelled: "border-destructive/40 text-destructive bg-destructive/10",
};

function POPage() {
  return (
    <AppShell>
      <PageHeader title="Purchase Orders" description="Step 2 — client-issued PO required before invoicing." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const pos = usePurchaseOrders();
  const quotes = useQuotes();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const list = inScope(pos, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <div className="p-8 space-y-5">
      <CrudToolbar count={list.length} label="purchase orders" onCreate={openCreate} />
      {list.length === 0 ? (
        <EmptyState label="purchase orders" onCreate={openCreate} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-3">Number</th>
                <th className="text-left font-medium px-5 py-3">Client ref</th>
                <th className="text-left font-medium px-5 py-3">From quote</th>
                <th className="text-left font-medium px-5 py-3">Client</th>
                <th className="text-left font-medium px-5 py-3">Project</th>
                <th className="text-left font-medium px-5 py-3">Company</th>
                <th className="text-left font-medium px-5 py-3">Issued</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Document</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
                <th className="px-5 py-3 w-20" />
              </tr>

            </thead>
            <tbody>
              {list.map((po) => {
                const co = companies.find((c) => c.id === po.companyId);
                const cl = clients.find((c) => c.id === po.clientId);
                const proj = po.projectId ? projects.find((p) => p.id === po.projectId) : undefined;
                const q = po.quoteId ? quotes.find((x) => x.id === po.quoteId) : undefined;
                return (
                  <tr key={po.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 group">
                    <td className="px-5 py-3.5 font-tnum text-xs text-muted-foreground">{po.number}</td>
                    <td className="px-5 py-3.5 text-xs">{po.clientReference || <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{q?.number ?? <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="px-5 py-3.5 font-medium">{cl?.name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-xs">{proj ? <span className="inline-flex px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">{proj.name}</span> : <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="px-5 py-3.5">{co && <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: co.color }} />{co.shortName}</span>}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs font-tnum">{format(parseISO(po.issueDate), "MMM d, yyyy")}</td>
                    <td className="px-5 py-3.5"><span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", statusStyles[po.status])}>{po.status}</span></td>
                    <td className="px-5 py-3.5 text-xs">
                      {po.documentUrl ? (
                        <a href={po.documentUrl} download={po.documentName} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline max-w-[180px] truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{po.documentName ?? "PO file"}</span>
                        </a>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(po.amount, po.currency)}</td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                        <button onClick={() => { setEditing(po); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm(`Delete PO ${po.number}?`) && purchaseOrdersStore.remove(po.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PODialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function PODialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: PurchaseOrder | null }) {
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const quotes = useQuotes();
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState("");
  const [clientReference, setClientReference] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [quoteId, setQuoteId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(today);
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [status, setStatus] = useState<POStatus>("issued");
  const [documentUrl, setDocumentUrl] = useState<string | undefined>();
  const [documentName, setDocumentName] = useState<string | undefined>();
  const [documentType, setDocumentType] = useState<string | undefined>();
  const [documentUploadedAt, setDocumentUploadedAt] = useState<string | undefined>();
  const [documentHistory, setDocumentHistory] = useState<DocVersion[]>([]);
  const [uploadError, setUploadError] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumber(editing.number); setClientReference(editing.clientReference ?? "");
      setCompanyId(editing.companyId); setClientId(editing.clientId);
      setProjectId(editing.projectId ?? ""); setQuoteId(editing.quoteId ?? "");
      setIssueDate(editing.issueDate); setAmount(String(editing.amount));
      setCurrency(editing.currency); setStatus(editing.status);
      setDocumentUrl(editing.documentUrl); setDocumentName(editing.documentName); setDocumentType(editing.documentType);
    } else {
      setNumber(`PO-${Date.now().toString().slice(-6)}`); setClientReference("");
      setCompanyId(companies[0]?.id ?? ""); setClientId(""); setProjectId(""); setQuoteId("");
      setIssueDate(today); setAmount("0"); setCurrency(companies[0]?.baseCurrency ?? "EUR"); setStatus("issued");
      setDocumentUrl(undefined); setDocumentName(undefined); setDocumentType(undefined);
    }
    setUploadError("");
  }, [open, editing, companies, today]);

  const handleFile = (file: File) => {
    setUploadError("");
    if (file.size > 5 * 1024 * 1024) { setUploadError("Max 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentUrl(reader.result as string);
      setDocumentName(file.name);
      setDocumentType(file.type);
    };
    reader.readAsDataURL(file);
  };


  const companyClients = clients.filter((c) => c.companyId === companyId);
  const clientProjects = projects.filter((p) => p.companyId === companyId && p.clientId === clientId);
  const clientQuotes = quotes.filter((q) => q.companyId === companyId && q.clientId === clientId);

  // When a quote is selected, prefill amount/currency/project.
  useEffect(() => {
    if (!quoteId) return;
    const q = quotes.find((x) => x.id === quoteId);
    if (q) {
      setAmount(String(q.amount)); setCurrency(q.currency);
      if (q.projectId) setProjectId(q.projectId);
    }
  }, [quoteId, quotes]);

  const submit = () => {
    if (!number.trim() || !companyId || !clientId) return;
    const data = { number, clientReference: clientReference || undefined, companyId, clientId, projectId: projectId || undefined, quoteId: quoteId || undefined, issueDate, amount: Number(amount) || 0, currency, status, documentUrl, documentName, documentType };
    if (editing) purchaseOrdersStore.update(editing.id, data);
    else purchaseOrdersStore.add({ id: newId("po"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit PO" : "New purchase order"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>PO number</Label><Input value={number} onChange={(e) => setNumber(e.target.value)} /></div>
            <div><Label>Client reference</Label><Input value={clientReference} onChange={(e) => setClientReference(e.target.value)} placeholder="Their internal #" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); setQuoteId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); setQuoteId(""); }}>
                <SelectTrigger><SelectValue placeholder={companyClients.length ? "Select" : "Create client first"} /></SelectTrigger>
                <SelectContent>{companyClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>From quote</Label>
            <Select value={quoteId || "__none__"} onValueChange={(v) => setQuoteId(v === "__none__" ? "" : v)} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder={clientId ? (clientQuotes.length ? "Pick a quote" : "No quote yet (recommended)") : "Select client first"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {clientQuotes.map((q) => <SelectItem key={q.id} value={q.id}>{q.number} · {fmtCompact(q.amount, q.currency)} · {q.status}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">A PO should descend from an accepted quote.</p>
          </div>
          <div>
            <Label>Project</Label>
            <Select value={projectId || "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? "" : v)} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder={clientId ? (clientProjects.length ? "Select project" : "No projects yet") : "Select client first"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No project —</SelectItem>
                {clientProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
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
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as POStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Client PO document</Label>
            {documentUrl ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated/40 px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <a href={documentUrl} download={documentName} target="_blank" rel="noreferrer" className="flex-1 truncate text-primary hover:underline">{documentName}</a>
                <button type="button" onClick={() => { setDocumentUrl(undefined); setDocumentName(undefined); setDocumentType(undefined); }} className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer rounded-md border border-dashed border-border bg-surface-elevated/30 hover:bg-surface-elevated/60 px-3 py-2.5 text-sm text-muted-foreground transition-colors">
                <Upload className="h-4 w-4" />
                <span>Upload PDF or image (max 5 MB)</span>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
              </label>
            )}
            {uploadError && <p className="text-[11px] text-destructive mt-1">{uploadError}</p>}
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
