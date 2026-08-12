import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  usePurchaseOrders, useQuotes, useCompanies, useClients, useProjects, purchaseOrdersStore,
  fmtCompact, type PurchaseOrder, type POStatus, type Currency,
  contactBelongsTo,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { DOCUMENTS_BUCKET, uploadFile, openStoredFile } from "@/lib/storage";
import { dbCompanyId } from "@/lib/db-sync";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useState } from "react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Upload, FileText, X, History, RefreshCw, Eye, AlertTriangle } from "lucide-react";

import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { withSelected } from "@/lib/select-options";

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
      <PageHeader title="Purchase Orders" description="Step 2 — record the PO your client issued and upload their document." />
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
  const baseList = inScope(pos, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const openCreate = () => { setEditing(null); setOpen(true); };

  const fields: FieldDef<PurchaseOrder>[] = [
    { key: "number", label: "Number", type: "string", accessor: (p) => p.number, noGroup: true },
    { key: "clientRef", label: "Client ref", type: "string", accessor: (p) => p.clientReference ?? "", noGroup: true },
    { key: "client", label: "Client", type: "enum", accessor: (p) => clients.find((c) => c.id === p.clientId)?.name ?? "" },
    { key: "project", label: "Project", type: "enum", accessor: (p) => projects.find((pr) => pr.id === p.projectId)?.name ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (p) => companies.find((c) => c.id === p.companyId)?.shortName ?? "" },
    { key: "status", label: "Status", type: "enum", accessor: (p) => p.status },
    { key: "currency", label: "Currency", type: "enum", accessor: (p) => p.currency },
    { key: "issueDate", label: "Issued", type: "date", accessor: (p) => p.issueDate, noGroup: true },
    { key: "amount", label: "Amount", type: "number", accessor: (p) => p.amount, noGroup: true },
    { key: "hasDoc", label: "Has document", type: "boolean", accessor: (p) => !!p.documentUrl },
  ];
  const view = useDataView<PurchaseOrder>("purchase-orders", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CrudToolbar count={list.length} label="purchase orders" onCreate={openCreate} />
        <DataToolbar view={view} items={baseList} />
      </div>
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
              {groups.map((g) => (
                <Fragment key={g.key}>
                  {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={11} />}
                  {g.items.map((po) => {
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
                        <button type="button" onClick={() => openStoredFile(po.documentUrl)} className="inline-flex items-center gap-1.5 text-primary hover:underline max-w-[180px] truncate">
                          <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{po.documentName ?? "PO file"}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-warning/40 text-warning bg-warning/10" title="No client PO document uploaded">
                          <AlertTriangle className="h-2.5 w-2.5" /> File missing
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(po.amount, po.currency)}</td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                        {po.documentUrl && (
                          <button type="button" onClick={() => openStoredFile(po.documentUrl)} title="Open client PO document" className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Eye className="h-3.5 w-3.5" /></button>
                        )}

                        <button onClick={() => { setEditing(po); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm(`Delete PO ${po.number}?`) && purchaseOrdersStore.remove(po.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
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
  const [uploading, setUploading] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setNumber(editing.number); setClientReference(editing.clientReference ?? "");
      setCompanyId(editing.companyId); setClientId(editing.clientId);
      setProjectId(editing.projectId ?? ""); setQuoteId(editing.quoteId ?? "");
      setIssueDate(editing.issueDate); setAmount(String(editing.amount));
      setCurrency(editing.currency); setStatus(editing.status);
      setDocumentUrl(editing.documentUrl); setDocumentName(editing.documentName); setDocumentType(editing.documentType);
      setDocumentUploadedAt(editing.documentUploadedAt);
      setDocumentHistory(editing.documentHistory ?? []);
    } else {
      const cid = companies[0]?.id ?? "";
      setNumber(""); setClientReference("");
      setCompanyId(cid); setClientId(""); setProjectId(""); setQuoteId("");
      setIssueDate(today); setAmount("0"); setCurrency(companies[0]?.baseCurrency ?? "EUR"); setStatus("issued");
      setDocumentUrl(undefined); setDocumentName(undefined); setDocumentType(undefined);
      setDocumentUploadedAt(undefined); setDocumentHistory([]);
    }
    setUploadError("");
    setShowErrors(false);
    // Only re-initialise when the dialog opens (or switches record).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);



  const handleFile = async (file: File) => {
    setUploadError("");
    if (file.size > 10 * 1024 * 1024) { setUploadError("Max 10 MB"); return; }
    setUploading(true);
    try {
      const scope = dbCompanyId(companyId);
      if (!scope) throw new Error("Company is not synced yet — try again in a moment");
      const ref = await uploadFile(DOCUMENTS_BUCKET, `${scope}/purchase-orders`, file);
      // If replacing an existing doc, push the old one onto history.
      if (documentUrl) {
        setDocumentHistory((h) => [
          { url: documentUrl, name: documentName, type: documentType, uploadedAt: documentUploadedAt ?? new Date().toISOString() },
          ...h,
        ]);
      }
      setDocumentUrl(ref);
      setDocumentName(file.name);
      setDocumentType(file.type);
      setDocumentUploadedAt(new Date().toISOString());
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };


  const companyClients = withSelected(
    clients.filter((c) => contactBelongsTo(c, companyId)),
    editing ? clientId : undefined,
    clients,
  );
  const clientProjects = withSelected(
    projects.filter((p) => p.companyId === companyId && p.clientId === clientId),
    editing ? projectId : undefined,
    projects,
  );
  const clientQuotes = withSelected(
    quotes.filter((q) => q.companyId === companyId && q.clientId === clientId),
    editing ? quoteId : undefined,
    quotes,
  );


  useReconciledSelection({
    open,
    currentValue: companyId,
    options: companies,
    getId: (company) => company.id,
    loading: companies.length === 0,
    preserve: !!editing,
    onChange: setCompanyId,
  });

  useReconciledSelection({
    open,
    currentValue: clientId,
    options: companyClients,
    getId: (client) => client.id,
    loading: clients.length === 0,
    preserve: !!editing,
    onChange: setClientId,
  });

  useReconciledSelection({
    open,
    currentValue: quoteId,
    options: clientQuotes,
    getId: (quote) => quote.id,
    allowEmpty: true,
    loading: quotes.length === 0,
    preserve: !!editing,
    onChange: setQuoteId,
  });

  useReconciledSelection({
    open,
    currentValue: projectId,
    options: clientProjects,
    getId: (project) => project.id,
    allowEmpty: true,
    loading: projects.length === 0,
    preserve: !!editing,
    onChange: setProjectId,
  });

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
    const invalid = !number.trim() || !companyId || !clientId;
    if (invalid) {
      setShowErrors(true);
      return;
    }
    // Stamp upload time when a document is present but doesn't have one yet (e.g. legacy data).
    const uploadedAt = documentUrl ? (documentUploadedAt ?? new Date().toISOString()) : undefined;
    const data = { number, clientReference: clientReference || undefined, companyId, clientId, projectId: projectId || undefined, quoteId: quoteId || undefined, issueDate, amount: Number(amount) || 0, currency, status, documentUrl, documentName, documentType, documentUploadedAt: uploadedAt, documentHistory: documentHistory.length ? documentHistory : undefined };
    if (editing) purchaseOrdersStore.update(editing.id, data);
    else purchaseOrdersStore.add({ id: newId("po"), ...data });
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit client PO" : "Record client PO"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <p className="text-[11px] text-muted-foreground -mt-1">Enter the purchase order details exactly as issued by your client, then attach their document.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label><RequiredLabel>Client PO number</RequiredLabel></Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="As written on the client PO" className={invalidFieldClassName(showErrors && !number.trim())} aria-invalid={showErrors && !number.trim()} />
            </div>
            <div><Label>Client internal reference</Label><Input value={clientReference} onChange={(e) => setClientReference(e.target.value)} placeholder="Their internal #" /></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label><RequiredLabel>Company</RequiredLabel></Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); setQuoteId(""); }}>
                <SelectTrigger className={invalidFieldClassName(showErrors && !companyId)} aria-invalid={showErrors && !companyId}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label><RequiredLabel>Client</RequiredLabel></Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); setQuoteId(""); }}>
                <SelectTrigger className={invalidFieldClassName(showErrors && !clientId)} aria-invalid={showErrors && !clientId}><SelectValue placeholder={companyClients.length ? "Select" : "Create client first"} /></SelectTrigger>
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
            <div><Label>PO date (client)</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
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
            <Label><RequiredLabel>Client PO document</RequiredLabel></Label>
            {documentUrl ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 rounded-md border border-border bg-surface-elevated/40 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <button type="button" onClick={() => openStoredFile(documentUrl)} className="block w-full text-left truncate text-primary hover:underline">{documentName}</button>
                    {documentUploadedAt && (
                      <p className="text-[10px] text-muted-foreground font-tnum">Uploaded {format(parseISO(documentUploadedAt), "MMM d, yyyy · HH:mm")}{documentHistory.length > 0 && ` · v${documentHistory.length + 1}`}</p>
                    )}
                  </div>
                  <label className="h-7 px-2 inline-flex items-center gap-1 cursor-pointer rounded text-[11px] text-muted-foreground hover:text-foreground hover:bg-surface-elevated" title="Replace document">
                    <RefreshCw className="h-3.5 w-3.5" /> Replace
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                  </label>
                  <button type="button" onClick={() => { setDocumentUrl(undefined); setDocumentName(undefined); setDocumentType(undefined); setDocumentUploadedAt(undefined); }} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Remove current version"><X className="h-3.5 w-3.5" /></button>
                </div>
                {documentHistory.length > 0 && (
                  <details className="rounded-md border border-border/60 bg-surface-elevated/20 px-3 py-2 text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5" /> Version history ({documentHistory.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {documentHistory.map((v, i) => {
                        const versionNumber = documentHistory.length - i; // newest entry = highest prior version
                        return (
                          <li key={i} className="flex items-center gap-2 py-1 border-t border-border/40 first:border-0">
                            <span className="text-[10px] text-muted-foreground font-tnum w-8 shrink-0">v{versionNumber}</span>
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <button type="button" onClick={() => openStoredFile(v.url)} className="flex-1 truncate text-left text-primary hover:underline">{v.name ?? "PO file"}</button>
                            <span className="text-[10px] text-muted-foreground font-tnum">{format(parseISO(v.uploadedAt), "MMM d, yyyy · HH:mm")}</span>
                            <button type="button" onClick={() => setDocumentHistory((h) => h.filter((_, idx) => idx !== i))} className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Delete this version"><X className="h-3 w-3" /></button>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <>
                <label className={cn("flex items-center gap-2 rounded-md border border-dashed border-warning/50 bg-warning/5 hover:bg-warning/10 px-3 py-2.5 text-sm text-muted-foreground transition-colors", uploading ? "opacity-60 cursor-wait" : "cursor-pointer")}>
                  <Upload className="h-4 w-4" />
                  <span>{uploading ? "Uploading…" : "Upload the client's PO — PDF or image (max 10 MB)"}</span>
                  <input type="file" accept=".pdf,image/*" disabled={uploading} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
                </label>
                <p className="text-[11px] text-warning mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Without a file this PO stays flagged “File missing”.</p>
              </>
            )}
            {uploadError && <p className="text-[11px] text-destructive mt-1">{uploadError}</p>}

          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
