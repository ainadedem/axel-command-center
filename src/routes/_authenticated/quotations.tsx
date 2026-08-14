import { createFileRoute } from "@tanstack/react-router";
import { BankAccountSelect } from "@/components/bank-account-select";
import { defaultBankAccount } from "@/lib/payment-details";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useQuotes, useCompanies, useClients, useProjects, quotesStore, purchaseOrdersStore,
  fmt, fmtCompact, FX, type Quote, type QuoteLine, type QuoteStatus, type QuoteMode, type Currency,
  contactBelongsTo, MAX_QUOTE_ASSIGNEES,
} from "@/lib/mock-data";
import { capabilities, levels, getRate, type Capability, type Level, type Unit } from "@/lib/rate-card";
import { useLineReorder, DragHandle, moveItem } from "@/components/sortable-row";
import { newId } from "@/lib/data-store";
import { defaultTaxRate } from "@/lib/vat";
import { docTotals, lineNet } from "@/lib/discounts";
import { inScope, useCompany } from "@/lib/company-context";
import { useAuth } from "@/lib/auth-context";
import { format, parseISO, addDays } from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { Fragment, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { useOwnerNames } from "@/hooks/use-owner-names";
import { logActivity, diffDocument } from "@/lib/document-activity";
import { DocumentActivityPanel } from "@/components/document-activity-panel";

import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RICH_TEXT_HINT } from "@/lib/rich-text";
import { RichTextField } from "@/components/rich-text-field";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, FileCheck2, Plus, X, Eye, Copy, Send, Loader2, CheckCircle2, History } from "lucide-react";
import { DocumentPreview, buildPrintableDocument, type DocumentData } from "@/components/document-preview";
import { resolveFileUrl } from "@/lib/storage";
import { nextNumber, nextNumberAsync, isNumberTaken, primeNumbering } from "@/lib/numbering";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { canWriteCompany, dbCompanyId } from "@/lib/db-sync";
import { refreshStampsAndSignatures } from "@/lib/stamp-refresh";
import { useCompanySalesUsers } from "@/hooks/use-company-users";
import { useBulkSelection, SelectAllHeaderCell, SelectRowCell, BulkActionBar } from "@/components/bulk-select";
import { BulkEditDocDialog } from "@/components/bulk-edit-doc-dialog";
import { bulkUpdateDocuments, type BulkPatch } from "@/lib/bulk-edit";
import html2pdf from "html2pdf.js";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { withSelected } from "@/lib/select-options";
import { useSingleFlightSubmit } from "@/components/form-ux";
import { QuoteAssigneePicker, AssigneeStack } from "@/components/quote-assignee-picker";
import { QuoteFollowupPanel, followUpTone, followUpToneClass } from "@/components/quote-followup-panel";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, RowAction, ColumnPicker } from "@/components/list-table";

const QUOTE_COLUMNS: ColumnDef[] = [
  { key: "number", label: "Number", priority: "always" },
  { key: "client", label: "Client", priority: "always" },
  { key: "project", label: "Project" },
  { key: "company", label: "Company" },
  { key: "owner", label: "Owner", priority: "optional" },
  { key: "followup", label: "Follow-up" },
  { key: "issued", label: "Issued", priority: "optional" },
  { key: "validUntil", label: "Valid until" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount", priority: "always" },
];


export const Route = createFileRoute("/_authenticated/quotations")({ component: QuotationsPage });

const statusStyles: Record<QuoteStatus, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  sent: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  accepted: "border-success/40 text-success bg-success/10",
  rejected: "border-destructive/40 text-destructive bg-destructive/10",
  expired: "border-warning/40 text-warning bg-warning/10",
};

/** FX snapshot is captured inline in the dialog submit, only while still in draft. */


function computeTotals(subtotal: number, taxRate: number) {
  const tax = Math.round((subtotal * (taxRate || 0)) / 100);
  return { taxAmount: tax, totalAmount: subtotal + tax };
}

function QuotationsPage() {
  return (
    <AppShell>
      <PageHeader title="Quotations" description="Step 1 of the sales process — quote → PO → invoice." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const quotes = useQuotes();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const baseList = inScope(quotes, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [previewing, setPreviewing] = useState<Quote | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [historyOf, setHistoryOf] = useState<Quote | null>(null);
  const [followingUp, setFollowingUp] = useState<Quote | null>(null);
  const { user } = useAuth();
  const openCreate = () => { setEditing(null); setOpen(true); };

  // Resolve quotation owners to readable names (colleagues sharing a company).
  const { ownerName: nameOf } = useOwnerNames(baseList.map((q) => q.createdBy));
  const ownerName = (q: Quote) => nameOf(q.createdBy);


  const sendToClient = async (q: Quote) => {
    const cl = clients.find((c) => c.id === q.clientId);
    const co = companies.find((c) => c.id === q.companyId);
    const proj = q.projectId ? projects.find((p) => p.id === q.projectId) : undefined;
    if (!cl?.email) { toast.error("This client has no email on file."); return; }
    setSendingId(q.id);
    try {
      const logoUrl = await resolveFileUrl(co?.logoUrl);
      const html = buildPrintableDocument({ doc: quoteToDoc(q), company: co, client: cl, project: proj, showStatus: true, logoUrl });
      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-10000px;top:0;width:210mm;background:white;";
      container.innerHTML = html;
      document.body.appendChild(container);
      let pdfBase64: string;
      try {
        const blob: Blob = await (html2pdf as unknown as (...a: unknown[]) => { set: (o: unknown) => { from: (el: HTMLElement) => { outputPdf: (t: string) => Promise<Blob> } } })()
          .set({ margin: 10, filename: `${q.number}.pdf`, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" } })
          .from(container)
          .outputPdf("blob");
        const buf = await blob.arrayBuffer();
        let bin = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        pdfBase64 = btoa(bin);
      } finally {
        container.remove();
      }
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: { quote_id: q.id, recipient_email: cl.email, pdf_base64: pdfBase64 },
      });
      if (error) throw error;
      const res = data as { ok?: boolean; error?: string; pdf_url?: string; sent_at?: string };
      if (!res?.ok) throw new Error(res?.error ?? "send_failed");
      quotesStore.update(q.id, {
        status: "sent",
        sentAt: res.sent_at ?? new Date().toISOString(),
        sentTo: cl.email,
        pdfUrl: res.pdf_url ?? undefined,
      });
      logActivity({ docType: "quote", docId: q.id, docNumber: q.number, companyId: q.companyId, action: "sent", summary: `Emailed to ${cl.email}` });
      toast.success(`Quote ${q.number} sent to ${cl.email}`);
    } catch (e) {
      toast.error(`Failed to send quote: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSendingId(null);
    }
  };


  const fields: FieldDef<Quote>[] = [
    { key: "number", label: "Number", type: "string", accessor: (q) => q.number, noGroup: true },
    { key: "client", label: "Client", type: "enum", accessor: (q) => clients.find((c) => c.id === q.clientId)?.name ?? "" },
    { key: "project", label: "Project", type: "enum", accessor: (q) => projects.find((p) => p.id === q.projectId)?.name ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (q) => companies.find((c) => c.id === q.companyId)?.shortName ?? "" },
    { key: "status", label: "Status", type: "enum", accessor: (q) => q.status },
    { key: "currency", label: "Currency", type: "enum", accessor: (q) => q.currency },
    { key: "issueDate", label: "Issued", type: "date", accessor: (q) => q.issueDate, noGroup: true },
    { key: "validUntil", label: "Valid until", type: "date", accessor: (q) => q.validUntil, noGroup: true },
    { key: "amount", label: "Amount", type: "number", accessor: (q) => q.amount, noGroup: true },
    { key: "owner", label: "Owner", type: "enum", accessor: (q) => ownerName(q) },
  ];
  const view = useDataView<Quote>("quotations", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);
  const cp = useColumnPrefs("quotations", QUOTE_COLUMNS);
  const colCount = 1 + cp.count;


  const isWritable = useCallback(
    (q: Quote) => canWriteCompany(dbCompanyId(q.companyId) ?? q.companyId),
    [],
  );
  const selection = useBulkSelection(list, isWritable);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { users: previewSigners } = useCompanySalesUsers(previewing?.companyId);

  const applyBulk = async (patch: BulkPatch) => {
    const rows = selection.selectedRows;
    const n = await bulkUpdateDocuments({
      collection: quotesStore,
      docType: "quote",
      rows,
      patch,
      userId: user?.id,
      label: `bulk edit ${rows.length} quote${rows.length !== 1 ? "s" : ""}`,
      clientName: (id) => clients.find((c) => c.id === id)?.name ?? id,
      projectName: (id) => projects.find((p) => p.id === id)?.name ?? id,
    });
    selection.clear();
    toast.success(`Updated ${n} quote${n !== 1 ? "s" : ""}`);
  };

  const convertToPO = async (q: Quote) => {
    await primeNumbering("po", q.companyId);
    purchaseOrdersStore.add({
      id: newId("po"),
      number: nextNumber("po", q.companyId),
      companyId: q.companyId,
      clientId: q.clientId,
      projectId: q.projectId,
      quoteId: q.id,
      issueDate: new Date().toISOString().slice(0, 10),
      amount: q.amount,
      currency: q.currency,
      status: "issued",
      lines: q.lines ? q.lines.map((l) => ({ ...l })) : undefined,
    });
    quotesStore.update(q.id, { status: "accepted", updatedBy: user?.id, updatedAt: new Date().toISOString() });
    logActivity({
      docType: "quote", docId: q.id, docNumber: q.number, companyId: q.companyId,
      action: "status_changed", summary: `From ${q.status} to accepted (converted to PO)`,
      details: { from: q.status, to: "accepted" },
    });
  };

  const duplicateQuote = async (q: Quote) => {
    await primeNumbering("quote", q.companyId);
    quotesStore.add({
      id: newId("q"),
      number: nextNumber("quote", q.companyId),
      companyId: q.companyId,
      clientId: q.clientId,
      projectId: q.projectId,
      issueDate: new Date().toISOString().slice(0, 10),
      validUntil: addDays(new Date(), 30).toISOString().slice(0, 10),
      amount: q.amount,
      currency: q.currency,
      status: "draft",
      mode: q.mode ?? "rate-card",
      lines: q.lines ? q.lines.map((l) => ({ ...l, id: newId("ql") })) : undefined,
      notes: q.notes,
      createdBy: user?.id,
    });
  };

  return (
    <div className="p-4 sm:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CrudToolbar createLabel="New quote" count={list.length} label="quotations" onCreate={openCreate} />
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnPicker prefs={cp} />
          <DataToolbar view={view} items={baseList} />
        </div>

      </div>
      {list.length === 0 ? (
        <EmptyState label="quotations" onCreate={openCreate} />
      ) : (
        <ListTableShell>
          <ListTable>
            <thead>
              <ListHeadRow>
                <SelectAllHeaderCell checked={selection.allSelected} onToggle={selection.toggleAll} />
                <ListTh width="11%">Number</ListTh>
                <ListTh width="17%">Client</ListTh>
                {cp.on("project") && <ListTh width="13%">Project</ListTh>}
                {cp.on("company") && <ListTh width="9%">Company</ListTh>}
                {cp.on("owner") && <ListTh width="12%">Owner</ListTh>}
                {cp.on("followup") && <ListTh width="12%">Follow-up</ListTh>}
                {cp.on("issued") && <ListTh width="11%">Issued</ListTh>}
                {cp.on("validUntil") && <ListTh width="11%">Valid until</ListTh>}
                {cp.on("status") && <ListTh width="12%">Status</ListTh>}
                <ListTh width="12%" align="right">Amount</ListTh>
              </ListHeadRow>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />}
                  {g.items.map((q) => {
                const co = companies.find((c) => c.id === q.companyId);
                const cl = clients.find((c) => c.id === q.clientId);
                const proj = q.projectId ? projects.find((p) => p.id === q.projectId) : undefined;
                return (
                  <Fragment key={q.id}>
                  <tr className="hover:bg-surface-elevated/40">
                    <SelectRowCell
                      checked={selection.isSelected(q.id)}
                      onToggle={() => selection.toggle(q.id)}
                      disabled={!isWritable(q)}
                      label={`Select quote ${q.number}`}
                    />
                    <ListTd className="font-tnum text-xs text-muted-foreground" title={q.number}>{q.number}</ListTd>
                    <ListTd className="font-medium" title={cl?.name}>{cl?.name ?? "—"}</ListTd>
                    {cp.on("project") && (
                      <ListTd className="text-xs" title={proj?.name}>{proj ? <span className="inline-block max-w-full truncate px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 align-middle">{proj.name}</span> : <span className="text-muted-foreground/50">—</span>}</ListTd>
                    )}
                    {cp.on("company") && (
                      <ListTd title={co?.name}>{co && <span className="inline-flex items-center gap-2 text-xs max-w-full"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: co.color }} /><span className="truncate">{co.shortName}</span></span>}</ListTd>
                    )}
                    {cp.on("owner") && <ListTd className="text-xs text-muted-foreground" title={ownerName(q)}>{ownerName(q)}</ListTd>}
                    {cp.on("followup") && (
                      <ListTd wrap>
                        <button
                          onClick={() => setFollowingUp(q)}
                          title="Assigned sales & follow-ups"
                          className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-surface-elevated transition"
                        >
                          <AssigneeStack companyId={q.companyId} ids={q.assignedTo ?? []} />
                          {q.nextFollowUpAt && (
                            <span className={cn("text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border font-tnum", followUpToneClass[followUpTone(q.nextFollowUpAt)])}>
                              {format(parseISO(q.nextFollowUpAt), "MMM d")}
                            </span>
                          )}
                        </button>
                      </ListTd>
                    )}
                    {cp.on("issued") && <ListTd className="text-muted-foreground text-xs font-tnum">{format(parseISO(q.issueDate), "MMM d, yyyy")}</ListTd>}
                    {cp.on("validUntil") && <ListTd className="text-muted-foreground text-xs font-tnum">{format(parseISO(q.validUntil), "MMM d, yyyy")}</ListTd>}
                    {cp.on("status") && (
                      <ListTd>
                        {q.sentAt ? (
                          <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", statusStyles.sent)} title={`Sent ${format(parseISO(q.sentAt), "MMM d, yyyy HH:mm")}${q.sentTo ? ` to ${q.sentTo}` : ""}`}>
                            <CheckCircle2 className="h-3 w-3" />
                            Sent · {format(parseISO(q.sentAt), "MMM d")}
                          </span>
                        ) : (
                          <StatusBadge status={q.status} />
                        )}
                      </ListTd>
                    )}
                    <ListTd align="right" className="font-tnum">{fmtCompact(q.totalAmount ?? q.amount, q.currency)}</ListTd>
                  </tr>
                  <ListRowActions colSpan={colCount}>
                    {!q.sentAt && (
                      <RowAction
                        icon={sendingId === q.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        label="Send"
                        onClick={() => sendToClient(q)}
                        disabled={!cl?.email || sendingId === q.id}
                        title={cl?.email ? `Send to ${cl.email}` : "Client has no email on file"}
                      />
                    )}
                    {q.status !== "accepted" && q.status !== "rejected" && (
                      <RowAction icon={<FileCheck2 className="h-3.5 w-3.5" />} label="To PO" tone="success" onClick={() => convertToPO(q)} title="Convert to PO" />
                    )}
                    <RowAction icon={<History className="h-3.5 w-3.5" />} label="History" onClick={() => setHistoryOf(q)} title="Activity history" />
                    <RowAction icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate" onClick={() => duplicateQuote(q)} title="Duplicate quote" />
                    <RowAction icon={<Eye className="h-3.5 w-3.5" />} label="Preview" onClick={() => setPreviewing(q)} title="Preview & export PDF" />
                    <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { setEditing(q); setOpen(true); }} />
                    <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => { if (confirm(`Delete quote ${q.number}?`)) quotesStore.remove(q.id); }} />
                  </ListRowActions>
                  </Fragment>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </ListTable>
        </ListTableShell>

      )}
      <BulkActionBar count={selection.count} noun="quote" onClear={selection.clear}>
        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => setBulkOpen(true)}>
          Edit client / project
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 px-3 text-xs"
          onClick={async () => {
            const n = await refreshStampsAndSignatures({
              collection: quotesStore, docType: "quote", rows: selection.selectedRows,
            });
            selection.clear();
            toast.success(`Stamp & signature refreshed on ${n} quote${n > 1 ? "s" : ""}`);
          }}
        >
          Refresh stamp &amp; signature
        </Button>
      </BulkActionBar>
      <BulkEditDocDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        rows={selection.selectedRows}
        noun="quote"
        onApply={applyBulk}
      />

      <QuoteDialog open={open} onOpenChange={setOpen} editing={editing} />
      <Dialog open={!!followingUp} onOpenChange={(v) => { if (!v) setFollowingUp(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Follow-up · {followingUp?.number}</DialogTitle></DialogHeader>
          {followingUp && (
            <div className="space-y-4">
              <div>
                <Label className="text-[11px]">Assigned sales (max 3)</Label>
                <QuoteAssigneePicker
                  companyId={followingUp.companyId}
                  value={followingUp.assignedTo ?? []}
                  onChange={(next) => {
                    quotesStore.update(followingUp.id, { assignedTo: next });
                    setFollowingUp({ ...followingUp, assignedTo: next });
                  }}
                />
              </div>
              <QuoteFollowupPanel quote={quotes.find((x) => x.id === followingUp.id) ?? followingUp} />
            </div>
          )}
        </DialogContent>
      </Dialog>
      <DocumentActivityPanel
        open={!!historyOf}
        onOpenChange={(v) => { if (!v) setHistoryOf(null); }}
        docType="quote"
        docId={historyOf?.id}
        docNumber={historyOf?.number}
      />
      <DocumentPreview
        open={!!previewing}
        onOpenChange={(v) => { if (!v) setPreviewing(null); }}
        doc={previewing ? quoteToDoc(previewing) : null}
        company={previewing ? companies.find((c) => c.id === previewing.companyId) : undefined}
        client={previewing ? clients.find((c) => c.id === previewing.clientId) : undefined}
        project={previewing?.projectId ? projects.find((p) => p.id === previewing.projectId) : undefined}
        signers={previewSigners.map((u) => ({ userId: u.userId, name: u.name }))}
        onDocChange={(patch) => { if (previewing) quotesStore.update(previewing.id, patch); }}
        audit={previewing ? { docType: "quote", docId: previewing.id, companyId: previewing.companyId } : undefined}
      />
    </div>
  );
}

function quoteToDoc(q: Quote): DocumentData {
  const subtotal = q.amount;
  const taxRate = q.taxRate ?? 0;
  const { taxAmount, totalAmount } = computeTotals(subtotal, taxRate);
  return {
    kind: "quote",
    number: q.number,
    status: q.status,
    issueDate: q.issueDate,
    dueDate: q.validUntil,
    amount: subtotal,
    currency: q.currency,
    lines: q.lines,
    subject: q.subject,
    bankAccountId: q.bankAccountId,
    notes: q.notes,
    discountPct: q.discountPct,
    taxRate,
    taxAmount: q.taxAmount ?? taxAmount,
    totalAmount: q.totalAmount ?? totalAmount,
    signerId: q.signerId ?? q.updatedBy ?? q.createdBy,
    stampX: q.stampX,
    stampY: q.stampY,
    stampScale: q.stampScale,
  };
}


function QuoteDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Quote | null }) {
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState("");
  // True once the user edits the number by hand, so async resolution stops overriding it.
  const numberTouched = useRef(false);
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [issueDate, setIssueDate] = useState(today);
  const [validUntil, setValidUntil] = useState(addDays(new Date(), 30).toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [status, setStatus] = useState<QuoteStatus>("draft");
  const [mode, setMode] = useState<QuoteMode>("rate-card");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [assignedTo, setAssignedTo] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      numberTouched.current = false;
      setNumber(editing.number); setCompanyId(editing.companyId); setClientId(editing.clientId);
      setProjectId(editing.projectId ?? "");
      setIssueDate(editing.issueDate); setValidUntil(editing.validUntil);
      setCurrency(editing.currency); setStatus(editing.status);
      setMode(editing.mode ?? "rate-card");
      setLines(editing.lines ?? []);
      setNotes(editing.notes ?? "");
      setSubject(editing.subject ?? "");
      setBankAccountId(editing.bankAccountId ?? "");
      setTaxRate(editing.taxRate ?? 0);
      setDiscountPct(editing.discountPct ?? 0);
      setAssignedTo(editing.assignedTo ?? []);
    } else {
      const cid = companies[0]?.id ?? "";
      numberTouched.current = false; setNumber(cid ? nextNumber("quote", cid, today) : ""); setCompanyId(cid); setClientId("");
      setProjectId(""); setIssueDate(today); setValidUntil(addDays(new Date(), 30).toISOString().slice(0, 10));
      setCurrency(companies[0]?.baseCurrency ?? "EUR"); setStatus("draft");
      setMode("rate-card");
      setAssignedTo([]);
      setLines([]); setNotes(""); setSubject(""); setBankAccountId(""); setTaxRate(defaultTaxRate(companies[0], today)); setDiscountPct(0);
    }
    // Only re-initialise when the dialog opens (or switches record) — background
    // data refreshes must never overwrite in-progress edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const { user } = useAuth();

  // Re-apply the default tax rate when the company or issue date changes on a new quote.
  useEffect(() => {
    if (!open || editing || !companyId) return;
    const c = companies.find((x) => x.id === companyId);
    setTaxRate(defaultTaxRate(c, issueDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, issueDate]);

  useEffect(() => {
    if (!open || editing || !companyId) return;
    let cancelled = false;
    // Sales users only see their own quotations, so the next number is resolved
    // against every quotation of the company, not just the visible ones.
    void nextNumberAsync("quote", companyId, issueDate).then((n) => {
      // Never clobber a number the user typed by hand.
      if (!cancelled && !numberTouched.current) setNumber(n);
    });
    return () => {
      cancelled = true;
    };
    // Re-resolved on every open: the synchronous fallback only knows the rows
    // this user can see, which is a subset for sales-scoped accounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, companyId, issueDate]);

  const companyClients = useMemo(
    () => withSelected(
      clients.filter((c) => contactBelongsTo(c, companyId)).sort((a, b) => a.name.localeCompare(b.name)),
      editing ? clientId : undefined,
      clients,
    ),
    [clients, companyId, clientId, editing],
  );
  const clientProjects = withSelected(
    projects.filter((p) => p.companyId === companyId && p.clientId === clientId),
    editing ? projectId : undefined,
    projects,
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
    currentValue: projectId,
    options: clientProjects,
    getId: (project) => project.id,
    allowEmpty: true,
    loading: projects.length === 0,
    preserve: !!editing,
    onChange: setProjectId,
  });

  const totals = useMemo(
    () => docTotals(lines, Number(discountPct) || 0, Number(taxRate) || 0),
    [lines, discountPct, taxRate],
  );
  const subtotal = totals.subtotal;
  const { taxAmount, totalAmount } = { taxAmount: totals.taxAmount, totalAmount: totals.total };

  const addLine = () => {
    // Row-level ownership: remember who added each line and when.
    const stamp = { createdBy: user?.id, createdAt: new Date().toISOString() };
    if (mode === "standard") {
      setLines((prev) => [...prev, {
        id: newId("ql"),
        description: "",
        unit: "fixed", quantity: 1, rate: 0,
        ...stamp,
      }]);
      return;
    }
    const cap: Capability = "CREATIVE";
    const lvl: Level = "P7";
    setLines((prev) => [...prev, {
      id: newId("ql"),
      description: `${cap} — ${levels.find((l) => l.code === lvl)?.title ?? lvl}`,
      capability: cap, level: lvl, unit: "day", quantity: 1,
      rate: getRate(lvl, "day", currency),
      ...stamp,
    }]);
  };


  const updateLine = (id: string, patch: Partial<QuoteLine>) => {
    setLines((prev) => prev.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...patch };
      if (patch.capability === "PROJECT") {
        next.level = undefined;
        next.unit = "fixed" as Unit;
        next.description = next.description || "PROJECT — Fixed fee";
      }
      // Recompute rate when capability/level/unit/currency drivers change.
      if ((patch.level || patch.unit || patch.capability) && next.level && next.unit !== "fixed") {
        next.rate = getRate(next.level as Level, next.unit as Unit, currency);
        if (patch.capability || patch.level) {
          const title = levels.find((x) => x.code === next.level)?.title ?? next.level;
          next.description = `${next.capability} — ${title}`;
        }
      }
      return next;
    }));
  };

  // When currency changes, re-price every rate-card line.
  useEffect(() => {
    setLines((prev) => prev.map((l) => l.level ? { ...l, rate: getRate(l.level as Level, l.unit, currency) } : l));
  }, [currency]);

  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));
  const moveLine = (from: number, to: number) => setLines((prev) => moveItem(prev, from, to));
  const lineDnd = useLineReorder(moveLine);

  const duplicateNumber = Boolean(number.trim()) && Boolean(companyId)
    && isNumberTaken("quote", companyId, number, editing?.id);

  const submit = () => {
    if (!number.trim() || !companyId || !clientId || duplicateNumber) return;
    const taxRateNum = Number(taxRate) || 0;
    const discountNum = Number(discountPct) || 0;
    const computed = docTotals(lines, discountNum, taxRateNum);
    const amountInt = computed.subtotal;
    // FX snapshot is captured/refreshed only while the quote is still a draft and has never been sent.
    const isDraft = status === "draft" && !editing?.sentAt;
    const fxFields = isDraft
      ? { fxRate: FX[currency], fxBaseCurrency: "MGA" as Currency }
      : {};
    const data = {
      number, companyId, clientId, projectId: projectId || undefined,
      issueDate, validUntil,
      amount: amountInt,
      discountPct: discountNum || undefined,
      taxRate: taxRateNum,
      taxAmount: computed.taxAmount,
      totalAmount: computed.total,
      currency, status, mode, lines, notes: notes || undefined, subject: subject.trim() || undefined,
      bankAccountId: bankAccountId || defaultBankAccount(companies.find((c) => c.id === companyId))?.id,
      assignedTo: assignedTo.slice(0, MAX_QUOTE_ASSIGNEES),
      ...fxFields,
    };
    if (editing) {
      quotesStore.update(editing.id, { ...data, updatedBy: user?.id, updatedAt: new Date().toISOString() });
      const summary = diffDocument(editing as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
      if (editing.status !== status) {
        logActivity({
          docType: "quote", docId: editing.id, docNumber: number, companyId,
          action: "status_changed", summary: `From ${editing.status} to ${status}`,
          details: { from: editing.status, to: status },
        });
      }
      if (summary) {
        logActivity({ docType: "quote", docId: editing.id, docNumber: number, companyId, action: "updated", summary });
      }
    } else {
      const id = newId("q");
      quotesStore.add(
        { id, ...data, createdBy: user?.id, updatedBy: user?.id, updatedAt: new Date().toISOString() },
        { onSynced: (dbId) => logActivity({ docType: "quote", docId: dbId, docNumber: number, companyId, action: "created", summary: `Quotation ${number} created` }) },
      );
    }
    onOpenChange(false);
  };

  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit quote" : "New quote"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Number</Label>
              <Input value={number} onChange={(e) => { numberTouched.current = true; setNumber(e.target.value); }} aria-invalid={duplicateNumber} />
              {duplicateNumber && <p className="text-[11px] text-destructive mt-1">This number is already used by another quote.</p>}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as QuoteStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Company</Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}{companyId && !companies.some((c) => c.id === companyId) && <SelectItem value={companyId}>Current company</SelectItem>}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); }}>
                <SelectTrigger><SelectValue placeholder={companyClients.length ? "Select" : "Create client first"} /></SelectTrigger>
                <SelectContent>{companyClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div><Label>Valid until</Label><Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></div>
          </div>

          {/* Pricing mode */}
          <div className="pt-2">
            <Label>Quotation type</Label>
            <div className="mt-1 inline-flex rounded-md border border-border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setMode("rate-card")}
                className={cn("px-3 py-1.5", mode === "rate-card" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-surface-elevated")}
              >Rate card</button>
              <button
                type="button"
                onClick={() => setMode("standard")}
                className={cn("px-3 py-1.5 border-l border-border", mode === "standard" ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-surface-elevated")}
              >Standard</button>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label>{mode === "rate-card" ? "Line items (priced from rate card)" : "Line items"}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add line</Button>
            </div>
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md py-6 text-center">{mode === "rate-card" ? "No lines yet — add roles from the rate card." : "No lines yet — add a free-form item."}</p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="overflow-x-auto stacked-table">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-surface-elevated/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-10" />
                      <th className="text-left font-medium px-2 py-2">Description</th>
                      {mode === "rate-card" && <th className="text-left font-medium px-2 py-2 w-28">Capability</th>}
                      {mode === "rate-card" && <th className="text-left font-medium px-2 py-2 w-20">Level</th>}
                      <th className="text-left font-medium px-2 py-2 w-20">Unit</th>
                      <th className="text-right font-medium px-2 py-2 w-20">Qty</th>
                      <th className="text-right font-medium px-2 py-2 w-28">Rate ({currency})</th>
                      <th className="text-right font-medium px-2 py-2 w-20">Disc %</th>
                      <th className="text-right font-medium px-2 py-2 w-28">Amount ({currency})</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, li) => {
                      const rp = lineDnd.rowProps(li);
                      return (
                      <tr key={l.id} {...rp} className={cn("border-t border-border/40 align-top", rp.className)}>
                        <td className="px-1 py-1.5">
                          <DragHandle index={li} total={lines.length} handleProps={lineDnd.handleProps(li)} onMove={moveLine} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-xs" value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} placeholder="Description" />
                          <RichTextField compact className="mt-1" value={l.details ?? ""} onChange={(v) => updateLine(l.id, { details: v })} placeholder="Details (optional)" rows={2} />

                        </td>
                        {mode === "rate-card" && (
                          <td className="px-2 py-1.5">
                            <Select value={l.capability ?? "CREATIVE"} onValueChange={(v) => updateLine(l.id, { capability: v })}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{capabilities.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                        )}
                        {mode === "rate-card" && (
                          <td className="px-2 py-1.5">
                            {l.capability === "PROJECT" ? (
                              <span className="text-xs text-muted-foreground px-2 py-1.5 block">—</span>
                            ) : (
                              <Select value={l.level ?? "P7"} onValueChange={(v) => updateLine(l.id, { level: v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{levels.map((lv) => <SelectItem key={lv.code} value={lv.code}>{lv.code} · {lv.title}</SelectItem>)}</SelectContent>
                              </Select>
                            )}
                          </td>
                        )}
                        <td className="px-2 py-1.5">
                          <Select value={l.unit} onValueChange={(v) => updateLine(l.id, { unit: v as Unit })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hour">Hour</SelectItem>
                              <SelectItem value="day">Day</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5"><Input type="number" className="h-8 text-xs text-right" value={l.quantity} onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <Input type="number" className="h-8 text-xs text-right pr-8" value={l.rate} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value), level: undefined })} />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                              {currency === "EUR" ? "€" : currency === "USD" ? "$" : "Ar"}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="relative">
                            <Input
                              type="number" min={0} max={100} step={0.5}
                              className="h-8 text-xs text-right pr-6"
                              value={l.discountPct ?? 0}
                              onChange={(e) => updateLine(l.id, { discountPct: Number(e.target.value) })}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-right font-tnum">{fmt(lineNet(l), currency)}</td>
                        <td className="px-2 py-1.5"><button type="button" onClick={() => removeLine(l.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button></td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {totals.lineDiscount > 0 && (
                      <tr className="border-t border-border bg-surface-elevated/30">
                        <td colSpan={mode === "rate-card" ? 8 : 6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">Line discounts</td>
                        <td className="px-2 py-2 text-right font-tnum text-muted-foreground">−{fmt(totals.lineDiscount, currency)}</td>
                        <td />
                      </tr>
                    )}
                    <tr className="border-t border-border bg-surface-elevated/30">
                      <td colSpan={mode === "rate-card" ? 8 : 6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <span>Global discount</span>
                          <div className="relative">
                            <Input
                              type="number" min={0} max={100} step={0.5}
                              className="h-7 w-20 text-xs text-right pr-6"
                              value={discountPct}
                              onChange={(e) => setDiscountPct(Number(e.target.value))}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-tnum text-muted-foreground">{totals.globalDiscount > 0 ? `−${fmt(totals.globalDiscount, currency)}` : fmt(0, currency)}</td>
                      <td />
                    </tr>
                    <tr className="border-t border-border bg-surface-elevated/30">
                      <td colSpan={mode === "rate-card" ? 8 : 6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">Subtotal</td>
                      <td className="px-2 py-2 text-right font-tnum">{fmt(subtotal, currency)}</td>
                      <td />
                    </tr>
                    <tr className="bg-surface-elevated/30">
                      <td colSpan={mode === "rate-card" ? 8 : 6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <span>Tax</span>
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              className="h-7 w-20 text-xs text-right pr-6"
                              value={taxRate}
                              onChange={(e) => setTaxRate(Number(e.target.value))}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-tnum">{fmt(taxAmount, currency)}</td>
                      <td />
                    </tr>
                    <tr className="border-t border-border bg-surface-elevated/40">
                      <td colSpan={mode === "rate-card" ? 8 : 6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-foreground font-semibold">Total</td>
                      <td className="px-2 py-2 text-right font-tnum font-semibold">{fmt(totalAmount, currency)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                </div>
              </div>
            )}
            {mode === "rate-card" ? (
              <p className="text-[11px] text-muted-foreground">Rates auto-fill from the rate card (benefits 35%, OH 70%, margin 15%, 1760h / 218d per year). Override by editing the Rate cell — that detaches the line from the card.</p>
            ) : (
              <p className="text-[11px] text-muted-foreground">Standard quotation — enter description, quantity and unit price freely. Nothing is auto-priced.</p>
            )}
            {lines.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{RICH_TEXT_HINT}</p>
            )}
          </div>

          <div>
            <Label>Object</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Brand campaign production — Q3 2026" />
          </div>

          <BankAccountSelect company={companies.find((c) => c.id === companyId)} value={bankAccountId} onChange={setBankAccountId} />

          <div>
            <Label>Assigned sales (max {MAX_QUOTE_ASSIGNEES})</Label>
            <QuoteAssigneePicker companyId={companyId} value={assignedTo} onChange={setAssignedTo} />
          </div>

          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes for the client" />
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
