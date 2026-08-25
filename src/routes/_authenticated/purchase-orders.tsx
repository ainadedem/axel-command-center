import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PoNextStepHint } from "@/components/next-step-hint";
import { focusSearch, useFocusRow } from "@/hooks/use-focus-row";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  usePurchaseOrders, useQuotes, useCompanies, useClients, useProjects, useInvoices, purchaseOrdersStore,
  fmtCompact, type PurchaseOrder, type POStatus, type Currency,
  contactBelongsTo,
} from "@/lib/mock-data";

import { newId } from "@/lib/data-store";
import { DOCUMENTS_BUCKET, uploadFile, openStoredFile } from "@/lib/storage";
import { dbCompanyId } from "@/lib/db-sync";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO } from "date-fns";
import { StatusBadge } from "@/components/status-badge";
import { StatusMenu } from "@/components/status-menu";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { useOwnerNames } from "@/hooks/use-owner-names";
import { logActivity, diffDocument } from "@/lib/document-activity";
import { DocumentActivityPanel } from "@/components/document-activity-panel";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Upload, FileText, X, History, RefreshCw, Eye, AlertTriangle, FileCheck2, FileX2, Plus } from "lucide-react";
import { StatusFilterBar } from "@/components/status-filter-bar";
import { FilterPresetBar } from "@/components/filter-presets";
import { useFilterPresets } from "@/lib/filter-presets";
import { useIsMobile } from "@/hooks/use-mobile";

import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { withSelected } from "@/lib/select-options";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { DetailPanel, DetailSection, DetailField } from "@/components/master-detail";
import { ProjectsStylePageShell, ProjectsStyleToolbarGroup, RecordCountChip } from "@/components/projects-style-page-shell";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";

const PO_COLUMNS: ColumnDef[] = [
  { key: "number", label: "Number", priority: "always" },
  { key: "clientRef", label: "Client ref" },
  { key: "fromQuote", label: "From quote", priority: "optional" },
  { key: "client", label: "Client", priority: "always" },
  { key: "project", label: "Project" },
  { key: "company", label: "Company" },
  { key: "issued", label: "Issued", priority: "optional" },
  { key: "status", label: "Status" },
  { key: "document", label: "Document" },
  { key: "amount", label: "Amount", priority: "always" },
  { key: "owner", label: "Owner", priority: "optional" },
];


type DocVersion = { url: string; name?: string; type?: string; uploadedAt: string };

export const Route = createFileRoute("/_authenticated/purchase-orders")({ component: POPage, validateSearch: focusSearch });

const PO_STATUSES = ["draft", "issued", "fulfilled", "cancelled"];

/** Document-on-file chips — the PO page equivalent of the invoice PO chips. */
const DOC_CHIPS = [
  { key: "has", label: "Document on file", hint: "Client PO document uploaded", icon: <FileCheck2 className="h-3.5 w-3.5" />, tone: "success" as const },
  { key: "missing", label: "Missing document", hint: "No client PO document uploaded", icon: <FileX2 className="h-3.5 w-3.5" />, tone: "danger" as const },
];

/** Starter presets seeded once per user — renameable and deletable afterwards. */
const PO_PRESETS = [
  { id: "seed-issued", name: "Issued", statuses: ["issued"], po: [] },
  { id: "seed-fulfilled", name: "Fulfilled", statuses: ["fulfilled"], po: [] },
  { id: "seed-missing-doc", name: "Missing document", statuses: [], po: ["missing"] },
];

const statusStyles: Record<POStatus, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  issued: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  fulfilled: "border-success/40 text-success bg-success/10",
  cancelled: "border-destructive/40 text-destructive bg-destructive/10",
};

function POPage() {
  useFocusRow(Route.useSearch().focus);
  return (
    <AppShell>
      <PageHeader title="Purchase Orders" description="Step 2 — record the PO your client issued and upload their document." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const { user } = useAuth();
  const pos = usePurchaseOrders();
  const invoices = useInvoices();
  const navigate = useNavigate();
  const quotes = useQuotes();

  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const baseList = inScope(pos, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [historyOf, setHistoryOf] = useState<PurchaseOrder | null>(null);
  const openCreate = () => { setEditing(null); setOpen(true); };
  const { ownerName } = useOwnerNames(baseList.map((p) => p.createdBy));

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
    { key: "owner", label: "Owner", type: "enum", accessor: (p) => ownerName(p.createdBy) },
  ];
  const view = useDataView<PurchaseOrder>("purchase-orders", fields);
  // Quick status / document chips layered on top of the saved view filters.
  const [chipStatuses, setChipStatuses] = useState<string[]>([]);
  const [chipDoc, setChipDoc] = useState<string[]>([]);
  const presets = useFilterPresets("purchase-orders", PO_PRESETS);
  const isMobile = useIsMobile();
  const docStateOf = (p: PurchaseOrder) => (p.documentUrl ? "has" : "missing");
  const chipFiltered = useMemo(
    () =>
      baseList.filter(
        (p) =>
          (chipStatuses.length === 0 || chipStatuses.includes(p.status)) &&
          (chipDoc.length === 0 || chipDoc.includes(p.documentUrl ? "has" : "missing")),
      ),
    [baseList, chipStatuses, chipDoc],
  );
  const filtersActive =
    chipStatuses.length > 0 ||
    chipDoc.length > 0 ||
    Boolean(view.state.q.trim()) ||
    Object.values(view.state.filters).some(Boolean) ||
    Boolean(view.state.sort) ||
    Boolean(view.state.group);
  const clearAllFilters = () => {
    setChipStatuses([]);
    setChipDoc([]);
    view.reset();
  };
  const groups = view.apply(chipFiltered);
  const list = groups.flatMap((g) => g.items);
  const cp = useColumnPrefs("purchase-orders", PO_COLUMNS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** One-click status change from the list or detail panel (no full edit). */
  const changeStatus = (po: PurchaseOrder, next: POStatus) => {
    if (po.status === next) return;
    const previous = po.status;
    purchaseOrdersStore.update(po.id, { status: next, updatedBy: user?.id, updatedAt: new Date().toISOString() });
    void logActivity({
      docType: "po", docId: po.id, docNumber: po.number, companyId: po.companyId,
      action: "status_changed", summary: `From ${previous} to ${next}`,
      details: { from: previous, to: next },
    });
    toast.success(`${po.number} → ${next}`, {
      action: {
        label: "Undo",
        onClick: () => purchaseOrdersStore.update(po.id, { status: previous, updatedBy: user?.id, updatedAt: new Date().toISOString() }),
      },
    });
  };

  const selected = selectedId ? list.find((p) => p.id === selectedId) ?? null : null;
  const detail = selected ? (
    <DetailPanel
      eyebrow={selected.number}
      title={clients.find((c) => c.id === selected.clientId)?.name ?? "Purchase order"}
      subtitle={fmtCompact(selected.amount, selected.currency)}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          <Button
            size="sm"
            onClick={() => {
              const existing = invoices.find((inv) => inv.poId === selected.id);
              void navigate({
                to: "/invoices",
                search: existing ? { focus: existing.id } : { fromPo: selected.id },
              });
            }}
          >
            {invoices.some((inv) => inv.poId === selected.id) ? "Open invoice" : "Send to Invoice"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setEditing(selected); setOpen(true); }}>Edit</Button>
          {selected.documentUrl && (
            <Button size="sm" variant="ghost" onClick={() => openStoredFile(selected.documentUrl)}>Open file</Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setHistoryOf(selected)}>History</Button>
        </>
      }

    >
      <PoNextStepHint po={selected} />
      <DetailSection>
        <DetailField
          label="Status"
          value={<StatusMenu status={selected.status} statuses={PO_STATUSES} onSelect={(next) => changeStatus(selected, next as POStatus)} />}
        />
        <DetailField label="Client ref" value={selected.clientReference || "—"} />
        <DetailField label="Project" value={projects.find((pr) => pr.id === selected.projectId)?.name ?? "—"} />
        <DetailField label="Company" value={companies.find((c) => c.id === selected.companyId)?.name ?? "—"} />
        <DetailField label="Issued" value={format(parseISO(selected.issueDate), "MMM d, yyyy")} />
        <DetailField label="Amount" value={fmtCompact(selected.amount, selected.currency)} mono />
        <DetailField label="Document" value={selected.documentName ?? (selected.documentUrl ? "PO file" : "Missing")} />
        <DetailField label="Owner" value={ownerName(selected.createdBy)} />
      </DetailSection>
    </DetailPanel>
  ) : null;

  return (
    <>
      <ProjectsStylePageShell
        detail={detail}
        toolbar={
          <>
            <ProjectsStyleToolbarGroup>
              <Button size="sm" onClick={openCreate} className="btn-new gap-1.5 shrink-0" aria-label="New PO" title="New PO">
                <Plus className="h-4 w-4" />
                {!isMobile && "New PO"}
              </Button>
              <RecordCountChip count={list.length} total={baseList.length} label="purchase orders" filtered={filtersActive} />
            </ProjectsStyleToolbarGroup>
            <ProjectsStyleToolbarGroup className="overflow-x-auto no-scrollbar sm:justify-end">
          <DataToolbar view={view} items={baseList} iconOnly className="shrink-0 flex-nowrap" />
          <FilterPresetBar
            api={presets}
            statuses={chipStatuses}
            po={chipDoc}
            onApply={(p) => { setChipStatuses(p.statuses); setChipDoc(p.po); }}
            iconOnly
          />
          <StatusFilterBar
            statuses={PO_STATUSES}
            selected={chipStatuses}
            statusCount={(s) => baseList.filter((p) => p.status === s).length}
            onToggleStatus={(s) =>
              setChipStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
            }
            extra={{
              entries: DOC_CHIPS,
              selected: chipDoc,
              count: (k) => baseList.filter((p) => docStateOf(p) === k).length,
              onToggle: (k) => setChipDoc((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k])),
            }}
            onClear={() => { setChipStatuses([]); setChipDoc([]); }}
            iconOnly
            overflow
            forceOverflowAll={isMobile}
          />
          {filtersActive && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={clearAllFilters}
              title="Clear all"
              aria-label="Clear all filters"
              className="h-8 w-8 shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <ColumnPicker prefs={cp} />
            </ProjectsStyleToolbarGroup>
          </>
        }
      >
      {list.length === 0 ? (
        <EmptyState label="purchase orders" onCreate={openCreate} />
      ) : (
        <ListTableShell>
          <ListTable>
            <thead>
              <ListHeadRow>
                <ListActionsTh />
<ListTh width="11%">Number</ListTh>
                {cp.on("clientRef") && <ListTh width="11%">Client ref</ListTh>}
                {cp.on("fromQuote") && <ListTh width="11%">From quote</ListTh>}
                <ListTh width="16%">Client</ListTh>
                {cp.on("project") && <ListTh width="12%">Project</ListTh>}
                {cp.on("company") && <ListTh width="9%">Company</ListTh>}
                {cp.on("issued") && <ListTh width="11%">Issued</ListTh>}
                {cp.on("status") && <ListTh width="10%">Status</ListTh>}
                {cp.on("document") && <ListTh width="13%">Document</ListTh>}
                <ListTh width="12%" align="right">Amount</ListTh>
                {cp.on("owner") && <ListTh width="12%">Owner</ListTh>}
              </ListHeadRow>
            </thead>
            <tbody>
              {groups.map((g) => (
                <Fragment key={g.key}>
                  {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={cp.count + 1} />}
                  {g.items.map((po) => {
                const co = companies.find((c) => c.id === po.companyId);
                const cl = clients.find((c) => c.id === po.clientId);
                const proj = po.projectId ? projects.find((p) => p.id === po.projectId) : undefined;
                const q = po.quoteId ? quotes.find((x) => x.id === po.quoteId) : undefined;
                return (
                  <Fragment key={po.id}>
                  <tr data-focus-id={po.id} data-selected={selectedId === po.id ? "true" : undefined} onClick={() => setSelectedId(po.id)} className="cursor-pointer">
<ListRowActions colSpan={cp.count}>
                    {po.documentUrl && (
                      <RowAction icon={<Eye className="h-3.5 w-3.5" />} label="Open file" onClick={() => openStoredFile(po.documentUrl)} title="Open client PO document" />
                    )}
                    <RowAction icon={<History className="h-3.5 w-3.5" />} label="History" onClick={() => setHistoryOf(po)} title="Activity history" />
                    <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { setEditing(po); setOpen(true); }} />
                    <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => { if (confirm(`Delete PO ${po.number}?`)) purchaseOrdersStore.remove(po.id); }} />
                  </ListRowActions>

                    <ListTd className="font-tnum text-xs text-muted-foreground" title={po.number}>{po.number}</ListTd>
                    {cp.on("clientRef") && <ListTd className="text-xs" title={po.clientReference}>{po.clientReference || <span className="text-muted-foreground/50">—</span>}</ListTd>}
                    {cp.on("fromQuote") && <ListTd className="text-xs text-muted-foreground">{q?.number ?? <span className="text-muted-foreground/50">—</span>}</ListTd>}
                    <ListTd className="font-medium" title={cl?.name}>{cl?.name ?? "—"}</ListTd>
                    {cp.on("project") && <ListTd className="text-xs" title={proj?.name}>{proj ? <span className="inline-block max-w-full truncate px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 align-middle">{proj.name}</span> : <span className="text-muted-foreground/50">—</span>}</ListTd>}
                    {cp.on("company") && <ListTd title={co?.name}>{co && <span className="inline-flex items-center gap-2 text-xs max-w-full"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: co.color }} /><span className="truncate">{co.shortName}</span></span>}</ListTd>}
                    {cp.on("issued") && <ListTd className="text-muted-foreground text-xs font-tnum">{format(parseISO(po.issueDate), "MMM d, yyyy")}</ListTd>}
                    {cp.on("status") && (
                      <ListTd wrap>
                        <StatusMenu
                          status={po.status}
                          statuses={PO_STATUSES}
                          onSelect={(next) => changeStatus(po, next as POStatus)}
                        />
                      </ListTd>
                    )}
                    {cp.on("document") && (
                      <ListTd className="text-xs" title={po.documentName}>
                        {po.documentUrl ? (
                          <button type="button" onClick={() => openStoredFile(po.documentUrl)} className="inline-flex items-center gap-1.5 text-primary hover:underline max-w-full">
                            <FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{po.documentName ?? "PO file"}</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-warning/40 text-warning bg-warning/10" title="No client PO document uploaded">
                            <AlertTriangle className="h-2.5 w-2.5" /> Missing
                          </span>
                        )}
                      </ListTd>
                    )}
                    <ListTd align="right" className="font-tnum">{fmtCompact(po.amount, po.currency)}</ListTd>
                    {cp.on("owner") && (
                      <ListTd className="text-xs text-muted-foreground" title={po.updatedAt ? `Updated by ${ownerName(po.updatedBy ?? po.createdBy)} · ${format(parseISO(po.updatedAt), "MMM d, HH:mm")}` : ownerName(po.createdBy)}>
                        {ownerName(po.createdBy)}
                      </ListTd>
                    )}
                  </tr>
                  </Fragment>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </ListTable>
        </ListTableShell>

      )}
      </ProjectsStylePageShell>
      <PODialog open={open} onOpenChange={setOpen} editing={editing} />
      <DocumentActivityPanel
        open={!!historyOf}
        onOpenChange={(v) => { if (!v) setHistoryOf(null); }}
        docType="po"
        docId={historyOf?.id}
        docNumber={historyOf?.number}
      />
    </>
  );
}


function PODialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: PurchaseOrder | null }) {
  const { user } = useAuth();
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
    if (editing) {
      purchaseOrdersStore.update(editing.id, { ...data, updatedBy: user?.id, updatedAt: new Date().toISOString() });
      if (editing.status !== status) {
        logActivity({
          docType: "po", docId: editing.id, docNumber: number, companyId,
          action: "status_changed", summary: `From ${editing.status} to ${status}`,
          details: { from: editing.status, to: status },
        });
      }
      const summary = diffDocument(editing as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
      if (summary) logActivity({ docType: "po", docId: editing.id, docNumber: number, companyId, action: "updated", summary });
    } else {
      purchaseOrdersStore.add(
        { id: newId("po"), ...data, createdBy: user?.id, updatedBy: user?.id, updatedAt: new Date().toISOString() },
        { onSynced: (dbId) => logActivity({ docType: "po", docId: dbId, docNumber: number, companyId, action: "created", summary: `Purchase order ${number} recorded` }) },
      );
    }
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label><RequiredLabel>Client PO number</RequiredLabel></Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="As written on the client PO" className={invalidFieldClassName(showErrors && !number.trim())} aria-invalid={showErrors && !number.trim()} />
            </div>
            <div><Label>Client internal reference</Label><Input value={clientReference} onChange={(e) => setClientReference(e.target.value)} placeholder="Their internal #" /></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label><RequiredLabel>Company</RequiredLabel></Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); setQuoteId(""); }}>
                <SelectTrigger className={invalidFieldClassName(showErrors && !companyId)} aria-invalid={showErrors && !companyId}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}{companyId && !companies.some((c) => c.id === companyId) && <SelectItem value={companyId}>Current company</SelectItem>}</SelectContent>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
