import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { focusSearch, useFocusRow, useJumpToRecord } from "@/hooks/use-focus-row";
import { BankAccountSelect } from "@/components/bank-account-select";
import { defaultBankAccount } from "@/lib/payment-details";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useInvoices, useCompanies, useClients, useProjects, usePurchaseOrders, useQuotes, useAccounts,
  invoicesStore, transactionsStore, projectsStore, purchaseOrdersStore, quotesStore,
  fmtAmount, fmtFull, toMGA, FX, type Invoice, type Project, type Currency, type QuoteLine, type Client,
  getNumberFormat, setNumberFormat, type NumberFormatMode,
  contactBelongsTo,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { docTotals, lineNet } from "@/lib/discounts";
import { inScope, useCompany } from "@/lib/company-context";
import { ReconcileButton, type ReconcileCheck } from "@/components/reconcile-button";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Fragment, useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { useOwnerNames } from "@/hooks/use-owner-names";
import { logActivity, diffDocument } from "@/lib/document-activity";
import { DocumentActivityPanel } from "@/components/document-activity-panel";
import { useAuth } from "@/lib/auth-context";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/crud-toolbar";
import { useCreateAction } from "@/lib/create-action";
import { Eye, Pencil, Trash2, AlertTriangle, CheckCircle2, Ban, BadgeCheck, ToggleLeft, ToggleRight, Plus, X } from "lucide-react";
import { InvoicePreview } from "@/components/invoice-preview";
import { RecordPaymentDialog } from "@/components/statement-import-dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { Textarea } from "@/components/ui/textarea";
import { RICH_TEXT_HINT } from "@/lib/rich-text";
import { RichTextField } from "@/components/rich-text-field";
import { Wallet, History } from "lucide-react";
import { nextNumber, nextNumberAsync, isNumberTaken } from "@/lib/numbering";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { withSelected } from "@/lib/select-options";
import { toast } from "sonner";
import { canWriteCompany, dbCompanyId } from "@/lib/db-sync";
import { useBulkSelection, SelectAllHeaderCell, SelectRowCell, BulkActionBar } from "@/components/bulk-select";
import { refreshStampsAndSignatures } from "@/lib/stamp-refresh";
import { BulkEditDocDialog } from "@/components/bulk-edit-doc-dialog";
import { bulkUpdateDocuments, bulkSetFields, type BulkPatch } from "@/lib/bulk-edit";
import { type ColumnDef } from "@/lib/column-prefs";
import { useTablePrefs } from "@/lib/table-prefs";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";
import { StatusBadge, PoBadge } from "@/components/status-badge";
import { useLineReorder, DragHandle, moveItem, ReorderLiveRegion } from "@/components/sortable-row";
import { useFilterPresets } from "@/lib/filter-presets";
import { FilterPresetBar } from "@/components/filter-presets";

import { buildAging, inBucket, type AgingKey } from "@/lib/aging";
import { AgingPanel } from "@/components/aging-panel";
import { KpiCard } from "@/components/kpi-card";
import { StatusFilterBar, type PoState } from "@/components/status-filter-bar";
import { TableExportMenu } from "@/components/table-export-menu";



const INVOICE_COLUMNS: ColumnDef[] = [
  { key: "number", label: "Number", priority: "always" },
  { key: "client", label: "Client", priority: "always" },
  { key: "project", label: "Project" },
  { key: "company", label: "Company" },
  { key: "issued", label: "Issued", priority: "optional" },
  { key: "due", label: "Due" },
  { key: "paidOn", label: "Paid on", priority: "optional" },
  { key: "timing", label: "Timing", priority: "optional" },
  { key: "status", label: "Status" },
  { key: "amount", label: "Amount", priority: "always" },
  { key: "balance", label: "Balance" },
  { key: "owner", label: "Owner", priority: "optional" },
];


const INVOICE_COL_WIDTHS: Record<string, number> = {
  number: 130, client: 200, project: 160, company: 130, issued: 130, due: 150,
  paidOn: 130, timing: 120, status: 180, amount: 160, balance: 150, owner: 150,
};

const ALIGN: Record<string, "left" | "right" | "center"> = { amount: "right", balance: "right" };

const INVOICE_STATUSES = ["draft", "sent", "partial", "paid", "overdue", "cancelled"];

/** PO handling state of an invoice. */
const poStateOf = (i: Invoice): PoState => (i.poId ? "linked" : i.poWaived ? "waived" : "missing");


export const Route = createFileRoute("/_authenticated/invoices")({ component: InvoicesPage, validateSearch: focusSearch });

function InvoicesPage() {
  useFocusRow(Route.useSearch().focus);
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
  const [historyOf, setHistoryOf] = useState<Invoice | null>(null);
  const [numMode, setNumMode] = useState<NumberFormatMode>(getNumberFormat());
  const tp = useTablePrefs("invoices", INVOICE_COLUMNS, INVOICE_COL_WIDTHS);


  const toggleMode = useCallback(() => {
    const next: NumberFormatMode = numMode === "compact" ? "full" : "compact";
    setNumMode(next);
    setNumberFormat(next);
  }, [numMode]);

  const quarterOf = (iso: string) => {
    const d = parseISO(iso);
    return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
  };
  const { ownerName } = useOwnerNames(baseList.map((i) => i.createdBy));
  const monthOf = (iso: string) => format(parseISO(iso), "MMM yyyy");
  const dayOf = (iso: string) => format(parseISO(iso), "MMM d, yyyy");

  const fields: FieldDef<Invoice>[] = [
    { key: "number", label: "Number", type: "string", accessor: (i) => i.number, noGroup: true },
    { key: "client", label: "Client", type: "enum", accessor: (i) => clients.find((c) => c.id === i.clientId)?.name ?? "" },
    { key: "project", label: "Project", type: "enum", accessor: (i) => projects.find((p) => p.id === i.projectId)?.name ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (i) => companies.find((c) => c.id === i.companyId)?.shortName ?? "" },
    { key: "status", label: "Status", type: "enum", accessor: (i) => i.status },
    { key: "poMissing", label: "PO missing", type: "boolean", accessor: (i) => !i.poId },

    { key: "currency", label: "Currency", type: "enum", accessor: (i) => i.currency },
    { key: "issueDate", label: "Issued", type: "date", accessor: (i) => i.issueDate, noGroup: true },
    { key: "dueDate", label: "Due", type: "date", accessor: (i) => i.dueDate, noGroup: true },
    { key: "issuedDay", label: "Issued (day)", type: "string", accessor: (i) => dayOf(i.issueDate), noSort: true, noFilter: true },
    { key: "issuedMonth", label: "Issued (month)", type: "string", accessor: (i) => monthOf(i.issueDate), noSort: true, noFilter: true },
    { key: "issuedQuarter", label: "Issued (quarter)", type: "string", accessor: (i) => quarterOf(i.issueDate), noSort: true, noFilter: true },
    { key: "amount", label: "Amount", type: "number", accessor: (i) => i.amount, noGroup: true },
    { key: "balance", label: "Balance", type: "number", accessor: (i) => i.amount - i.paid, noGroup: true },
    { key: "owner", label: "Owner", type: "enum", accessor: (i) => ownerName(i.createdBy) },
  ];
  const view = useDataView<Invoice>("invoices", fields);
  // Quick status / PO chips layered on top of the saved view filters.
  const [chipStatuses, setChipStatuses] = useState<string[]>([]);
  const [chipPo, setChipPo] = useState<PoState[]>([]);
  const chipFiltered = useMemo(
    () =>
      baseList.filter(
        (i) =>
          (chipStatuses.length === 0 || chipStatuses.includes(i.status)) &&
          (chipPo.length === 0 || chipPo.includes(poStateOf(i))),
      ),
    [baseList, chipStatuses, chipPo],
  );
  const presets = useFilterPresets("invoices");
  // Aging bucket filter driven by the shared aging panel (click a tile / bar).
  // The bucket + focused record live in the URL so drawer jumps are shareable.
  const search = Route.useSearch();
  const navigate = useNavigate();
  const jumpTo = useJumpToRecord();
  const urlBucket = (search.aging as AgingKey | undefined) ?? null;
  const [bucket, setBucket] = useState<AgingKey | null>(urlBucket);
  useEffect(() => {
    if (urlBucket && urlBucket !== bucket) setBucket(urlBucket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlBucket]);
  const setDrawerBucket = (key: AgingKey | null) => {
    if (key) setBucket(key);
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, aging: key ?? undefined }), replace: true } as never);
  };
  const bucketFiltered = useMemo(
    () =>
      bucket
        ? chipFiltered.filter(
            // Never filter out the deep-linked record — the jump must always land.
            (i) => i.id === search.focus || (i.status !== "paid" && inBucket(i.dueDate, bucket)),
          )
        : chipFiltered,
    [chipFiltered, bucket, search.focus],
  );
  const groups = view.apply(bucketFiltered);


  const list = groups.flatMap((g) => g.items);

  const isWritable = useCallback(
    (inv: Invoice) => canWriteCompany(dbCompanyId(inv.companyId) ?? inv.companyId),
    [],
  );
  const selection = useBulkSelection(list, isWritable);
  const [bulkOpen, setBulkOpen] = useState(false);
  const { user: authUser } = useAuth();

  const applyBulk = async (patch: BulkPatch) => {
    const rows = selection.selectedRows;
    const n = await bulkUpdateDocuments({
      collection: invoicesStore,
      docType: "invoice",
      rows,
      patch,
      userId: authUser?.id,
      label: `bulk edit ${rows.length} invoice${rows.length !== 1 ? "s" : ""}`,
      clientName: (id) => clients.find((c) => c.id === id)?.name ?? id,
      projectName: (id) => projects.find((p) => p.id === id)?.name ?? id,
    });
    selection.clear();
    toast.success(`Updated ${n} invoice${n !== 1 ? "s" : ""}`);
  };

  const bulkStatus = async (
    status: Invoice["status"],
    verb: string,
    extra?: (inv: Invoice) => Partial<Invoice>,
  ) => {
    const rows = selection.selectedRows;
    const n = await bulkSetFields<Invoice>({
      collection: invoicesStore,
      docType: "invoice",
      rows,
      userId: authUser?.id,
      label: `${verb} ${rows.length} invoice${rows.length !== 1 ? "s" : ""}`,
      summary: `Bulk update: status → ${status}`,
      patch: (inv) => (inv.status === status ? null : { status, ...(extra?.(inv) ?? {}) }),
    });
    selection.clear();
    if (n === 0) toast.info("Nothing to update");
    else toast.success(`${verb} ${n} invoice${n !== 1 ? "s" : ""}`);
  };

  const active = list.filter((i) => i.status !== "cancelled");
  const totalOpen = active.filter((i) => i.status !== "paid").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalOverdue = active.filter((i) => i.status === "overdue").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalPaid = active.filter((i) => i.status === "paid").reduce((s, i) => s + toMGA(i.amount, i.currency), 0);

  const aging = useMemo(
    () =>
      buildAging(chipFiltered.filter((i) => i.status !== "cancelled"), {
        due: (i) => i.dueDate,
        balance: (i) => toMGA(i.amount - i.paid, i.currency),
        include: (i) => i.status !== "paid",
      }),
    [chipFiltered],
  );


  const openCreate = useCallback(() => { setEditing(null); setOpen(true); }, []);
  // Topbar "New" button broadcast (previously handled by CrudToolbar)
  useCreateAction(openCreate);


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

  const colCount = 2 + tp.count;
  const tableMinWidth = 48 + 136 + tp.totalWidth;

  const renderCell = (key: string, inv: Invoice) => {
    const co = companies.find((c) => c.id === inv.companyId);
    const cl = clients.find((c) => c.id === inv.clientId);
    const proj = inv.projectId ? projects.find((p) => p.id === inv.projectId) : undefined;
    const days = differenceInDays(parseISO(inv.dueDate), new Date());
    const balance = inv.amount - inv.paid;
    const timing = inv.paidDate ? differenceInDays(parseISO(inv.paidDate), parseISO(inv.dueDate)) : null;

    switch (key) {
      case "number":
        return <ListTd className="font-tnum text-xs text-muted-foreground" title={inv.number}>{inv.number}</ListTd>;
      case "client":
        return <ListTd className="font-medium" title={cl?.name}>{cl?.name ?? "—"}</ListTd>;
      case "project":
        return (
          <ListTd className="text-xs" title={proj?.name}>
            {proj ? <span className="inline-block max-w-full truncate px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/5 align-middle">{proj.name}</span> : <span className="text-muted-foreground/50">—</span>}
          </ListTd>
        );
      case "company":
        return (
          <ListTd title={co?.name}>
            {co && <span className="inline-flex items-center gap-2 text-xs max-w-full"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: co.color }} /><span className="truncate">{co.shortName}</span></span>}
          </ListTd>
        );
      case "issued":
        return <ListTd className="text-muted-foreground text-xs font-tnum">{format(parseISO(inv.issueDate), "MMM d, yyyy")}</ListTd>;
      case "due":
        return (
          <ListTd className="text-muted-foreground text-xs font-tnum">
            <span className="inline-flex items-center gap-1.5">
              <span>{format(parseISO(inv.dueDate), "MMM d, yyyy")}</span>
              {inv.status !== "paid" && inv.status !== "cancelled" && days < 0 && (
                <span className="text-destructive font-medium">{Math.abs(days)}d late</span>
              )}
            </span>
          </ListTd>
        );
      case "paidOn":
        return (
          <ListTd className="text-muted-foreground text-xs font-tnum">
            {inv.paidDate ? format(parseISO(inv.paidDate), "MMM d, yyyy") : <span className="text-muted-foreground/40">—</span>}
          </ListTd>
        );
      case "timing":
        return (
          <ListTd className="text-xs font-tnum">
            {timing === null ? <span className="text-muted-foreground/40">—</span>
              : timing <= 0 ? <span className="text-success">{Math.abs(timing)}d early</span>
              : <span className="text-destructive">{timing}d late</span>}
          </ListTd>
        );
      case "status":
        return (
          <ListTd wrap title={inv.status === "cancelled" && inv.cancellationReason ? `Cancelled: ${inv.cancellationReason}` : inv.status}>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge
                status={inv.status}
                title={inv.status === "cancelled" && inv.cancellationReason ? `Cancelled: ${inv.cancellationReason}` : undefined}
              />
              {inv.status !== "cancelled" && <PoBadge state={poStateOf(inv)} />}
            </div>
          </ListTd>
        );
      case "amount":
        return <ListTd align="right" className="font-tnum" title={fmtFull(inv.amount, inv.currency)}>{fmtFull(inv.amount, inv.currency)}</ListTd>;
      case "balance":
        return (
          <ListTd align="right" className="font-tnum font-medium">
            {inv.status === "cancelled" ? <span className="text-muted-foreground">—</span> : balance > 0 ? fmtFull(balance, inv.currency) : <span className="text-muted-foreground">—</span>}
          </ListTd>
        );
      case "owner":
        return (
          <ListTd className="text-xs text-muted-foreground" title={inv.updatedAt ? `Updated by ${ownerName(inv.updatedBy ?? inv.createdBy)} · ${format(parseISO(inv.updatedAt), "MMM d, HH:mm")}` : ownerName(inv.createdBy)}>
            {ownerName(inv.createdBy)}
          </ListTd>
        );
      default:
        return <ListTd />;
    }
  };

  /** Plain-text value for CSV/PDF export — always full amounts. */
  const exportValue = (key: string, inv: Invoice): string => {
    switch (key) {
      case "number": return inv.number;
      case "client": return clients.find((c) => c.id === inv.clientId)?.name ?? "";
      case "project": return projects.find((p) => p.id === inv.projectId)?.name ?? "";
      case "company": return companies.find((c) => c.id === inv.companyId)?.shortName ?? "";
      case "issued": return format(parseISO(inv.issueDate), "yyyy-MM-dd");
      case "due": return format(parseISO(inv.dueDate), "yyyy-MM-dd");
      case "paidOn": return inv.paidDate ? format(parseISO(inv.paidDate), "yyyy-MM-dd") : "";
      case "timing": {
        if (!inv.paidDate) return "";
        const t = differenceInDays(parseISO(inv.paidDate), parseISO(inv.dueDate));
        return t <= 0 ? `${Math.abs(t)}d early` : `${t}d late`;
      }
      case "status": return inv.status === "cancelled" ? "cancelled" : `${inv.status} / PO ${poStateOf(inv)}`;
      case "amount": return fmtFull(inv.amount, inv.currency);
      case "balance": return inv.status === "cancelled" ? "" : fmtFull(inv.amount - inv.paid, inv.currency);
      case "owner": return ownerName(inv.createdBy);
      default: return "";
    }
  };

  const filtersActive =
    chipStatuses.length > 0 || chipPo.length > 0 || view.activeFilterCount > 0 || view.state.q.trim().length > 0;
  const clearAllFilters = () => {
    setChipStatuses([]);
    setChipPo([]);
    view.reset();
  };

  return (
    <div className="p-4 sm:p-8 space-y-4">
      {/* Single page action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground font-tnum">
          {list.length} invoice{list.length !== 1 ? "s" : ""}
          {filtersActive && <span className="text-foreground/70"> · filtered</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TableExportMenu
            filename="invoices"
            title="Invoices"
            subtitle={`${list.length} row${list.length !== 1 ? "s" : ""}`}
            build={() => ({
              columns: tp.visible.map((c) => ({ key: c.key, label: c.label, width: tp.width(c.key), align: ALIGN[c.key] ?? "left" })),
              rows: list.map((inv) => Object.fromEntries(tp.visible.map((c) => [c.key, exportValue(c.key, inv)]))),
            })}
          />
          <ColumnPicker prefs={tp} onResetWidths={tp.resetWidths} onResetOrder={tp.resetOrder} />
          <ReconcileButton checks={checks} />
          <button
            onClick={toggleMode}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-border bg-surface text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
            title={numMode === "compact" ? "Switch to full numbers" : "Switch to compact numbers"}
          >
            {numMode === "compact" ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
            <span className="hidden sm:inline">{numMode === "compact" ? "Compact" : "Full"}</span>
          </button>
          <span className="mx-0.5 hidden sm:block h-5 w-px bg-border" aria-hidden />
          <Button size="sm" onClick={openCreate} className="btn-new gap-1.5" aria-label="New invoice">
            <Plus className="h-4 w-4" /> New invoice
          </Button>
        </div>
      </div>

      {/* Unified filter bar */}
      <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)] p-3 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <DataToolbar view={view} items={baseList} />
          <span className="mx-0.5 hidden sm:block h-5 w-px bg-border" aria-hidden />
          <FilterPresetBar
            api={presets}
            statuses={chipStatuses}
            po={chipPo}
            onApply={(p) => { setChipStatuses(p.statuses); setChipPo(p.po as PoState[]); }}
          />
          {filtersActive && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
        </div>

        <StatusFilterBar
          statuses={INVOICE_STATUSES}
          selected={chipStatuses}
          statusCount={(s) => baseList.filter((i) => i.status === s).length}
          onToggleStatus={(s) =>
            setChipStatuses((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
          }
          poSelected={chipPo}
          poCount={(s) => baseList.filter((i) => poStateOf(i) === s).length}
          onTogglePo={(s) => setChipPo((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
          onClear={() => { setChipStatuses([]); setChipPo([]); }}
        />
      </div>




      {list.length === 0 ? (
        <EmptyState label="invoices" onCreate={openCreate} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard label="Open receivables" value={fmtAmount(totalOpen, "MGA")} />
            <KpiCard label="Overdue" value={fmtAmount(totalOverdue, "MGA")} tone={totalOverdue > 0 ? "danger" : "default"} />
            <KpiCard label="Collected (period)" value={fmtAmount(totalPaid, "MGA")} tone="success" />
          </div>

          <AgingPanel
            aging={aging}
            selected={bucket}
            onSelect={setBucket}
            format={(v) => fmtAmount(v, "MGA")}
            noun="invoice"
            storageKey="receivables"
            tilesTitle="Receivables aging — days past due"
            itemsInBucket={(key) =>
              chipFiltered
                .filter(
                  (i) =>
                    i.status !== "cancelled" &&
                    i.status !== "paid" &&
                    i.amount - i.paid > 0 &&
                    inBucket(i.dueDate, key),
                )
                .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
                .map((i) => ({
                  id: i.id,
                  title: i.number,
                  subtitle: clients.find((c) => c.id === i.clientId)?.name,
                  amount: toMGA(i.amount - i.paid, i.currency),
                  due: i.dueDate,
                  status: i.status,
                }))
            }
            drawerBucket={urlBucket}
            onDrawerBucketChange={setDrawerBucket}
            onJump={(item) => jumpTo(item.id, bucket)}
          />


          <ListTableShell scrollX announcement={tp.announcement}>
            <ListTable style={{ minWidth: tableMinWidth }}>
              <thead>
                <ListHeadRow>
                  <ListActionsTh />
<SelectAllHeaderCell checked={selection.allSelected} onToggle={selection.toggleAll} />
                  {tp.visible.map((c) => (
                    <ListTh
                      key={c.key}
                      width={tp.cssWidth(c.key)}
                      align={ALIGN[c.key] ?? "left"}
                      onResizeStart={tp.startResize(c.key)}
                      dragProps={tp.dragProps(c.key)}
                      keyProps={tp.keyboardProps(c.key)}
                    >
                      {c.label}
                    </ListTh>
                  ))}
                </ListHeadRow>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key}>
                    {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />}
                    {g.items.map((inv) => (
                    <Fragment key={inv.id}>
                    <tr data-focus-id={inv.id} className="hover:bg-surface-elevated/40 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]">
<ListRowActions colSpan={colCount}>
                      <RowAction icon={<History className="h-3.5 w-3.5" />} label="History" onClick={() => setHistoryOf(inv)} title="Activity history" />
                      <RowAction icon={<Eye className="h-3.5 w-3.5" />} label="Preview" onClick={() => setPreviewing(inv)} title="Preview & export PDF" />
                      {inv.status !== "paid" && inv.status !== "cancelled" && (
                        <>
                          <RowAction icon={<Wallet className="h-3.5 w-3.5" />} label="Payment" tone="success" onClick={() => setPaying(inv)} title="Add payment" />
                          <RowAction icon={<BadgeCheck className="h-3.5 w-3.5" />} label="Mark paid" tone="success" onClick={() => setMarking(inv)} />
                          <RowAction icon={<Ban className="h-3.5 w-3.5" />} label="Cancel" tone="warning" onClick={() => setCancelling(inv)} title="Cancel invoice" />
                        </>
                      )}
                      <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { setEditing(inv); setOpen(true); }} />
                      <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => { if (confirm(`Delete invoice ${inv.number}?`)) invoicesStore.remove(inv.id); }} />
                    </ListRowActions>

                      <SelectRowCell
                        checked={selection.isSelected(inv.id)}
                        onToggle={() => selection.toggle(inv.id)}
                        disabled={!isWritable(inv)}
                        label={`Select invoice ${inv.number}`}
                      />
                      {tp.visible.map((c) => (
                        <Fragment key={c.key}>{renderCell(c.key, inv)}</Fragment>
                      ))}
                    </tr>

                    </Fragment>
                    ))}

                  </Fragment>
                ))}
              </tbody>
            </ListTable>
          </ListTableShell>

        </>
      )}

      <BulkActionBar count={selection.count} noun="invoice" onClear={selection.clear}>
        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => setBulkOpen(true)}>
          Edit client / project
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 px-3 text-xs"
          onClick={() => bulkStatus("paid", "Marked paid", (inv) => ({ paid: inv.amount, paidDate: inv.paidDate ?? new Date().toISOString().slice(0, 10) }))}
        >
          Mark paid
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => bulkStatus("sent", "Marked sent")}>
          Mark sent
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 px-3 text-xs text-destructive"
          onClick={() => {
            if (confirm(`Cancel ${selection.count} invoice${selection.count !== 1 ? "s" : ""}?`)) void bulkStatus("cancelled", "Cancelled");
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 px-3 text-xs"
          onClick={async () => {
            const n = await refreshStampsAndSignatures({
              collection: invoicesStore, docType: "invoice", rows: selection.selectedRows,
            });
            selection.clear();
            toast.success(`Stamp & signature refreshed on ${n} invoice${n > 1 ? "s" : ""}`);
          }}
        >
          Refresh stamp &amp; signature
        </Button>
      </BulkActionBar>
      <BulkEditDocDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        rows={selection.selectedRows}
        noun="invoice"
        onApply={applyBulk}
      />

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
      <DocumentActivityPanel
        open={!!historyOf}
        onOpenChange={(v) => { if (!v) setHistoryOf(null); }}
        docType="invoice"
        docId={historyOf?.id}
        docNumber={historyOf?.number}
      />
      <MarkPaidDialog open={!!marking} onOpenChange={(v) => { if (!v) setMarking(null); }} invoice={marking} />
    </div>
  );
}

function CancelInvoiceDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (v: boolean) => void; invoice: Invoice | null }) {
  const [reason, setReason] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!invoice) return null;
  const submit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setShowErrors(true);
      return;
    }
    invoicesStore.update(invoice.id, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancellationReason: trimmed,
    });
    logActivity({
      docType: "invoice", docId: invoice.id, docNumber: invoice.number, companyId: invoice.companyId,
      action: "status_changed", summary: `Cancelled — ${trimmed}`, details: { from: invoice.status, to: "cancelled" },
    });
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cancel invoice {invoice.number}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <FormErrorBanner show={showErrors} />
          <p className="text-xs text-muted-foreground">
            The invoice will remain in the CRM with a <span className="text-foreground font-medium">cancelled</span> status. This action cannot be undone from this dialog.
          </p>
          <div>
            <Label><RequiredLabel>Reason</RequiredLabel></Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this invoice being cancelled?"
              rows={4}
              className={invalidFieldClassName(showErrors && !reason.trim())}
              aria-invalid={showErrors && !reason.trim()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep invoice</Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={isSubmitting}>
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
  const { user } = useAuth();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const pos = usePurchaseOrders();
  const quotes = useQuotes();
  const today = new Date().toISOString().slice(0, 10);
  const [number, setNumber] = useState("");
  // True once the user edits the number by hand, so async resolution stops overriding it.
  const numberTouched = useRef(false);
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [poId, setPoId] = useState<string>("");
  const [poWaived, setPoWaived] = useState(false);
  const [poWaiverReason, setPoWaiverReason] = useState("");
  const [subject, setSubject] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");

  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [amount, setAmount] = useState("0");
  const [paid, setPaid] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [status, setStatus] = useState<Invoice["status"]>("draft");
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [discountPct, setDiscountPct] = useState<number>(0);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      numberTouched.current = false; setNumber(editing.number); setCompanyId(editing.companyId); setClientId(editing.clientId);

      setProjectId(editing.projectId ?? ""); setPoId(editing.poId ?? "");
      setPoWaived(Boolean(editing.poWaived)); setPoWaiverReason(editing.poWaiverReason ?? "");
      setSubject(editing.subject ?? "");
      setBankAccountId(editing.bankAccountId ?? "");

      setIssueDate(editing.issueDate); setDueDate(editing.dueDate);
      setAmount(String(editing.amount)); setPaid(String(editing.paid));
      setCurrency(editing.currency); setStatus(editing.status);
      setLines((editing.lines ?? []).map((l) => ({ ...l })));
      setDiscountPct(editing.discountPct ?? 0);
    } else {
      const cid = companies[0]?.id ?? "";
      numberTouched.current = false; setNumber(cid ? nextNumber("invoice", cid, today) : ""); setCompanyId(cid); setClientId("");
      setProjectId(""); setPoId(""); setPoWaived(false); setPoWaiverReason(""); setSubject(""); setBankAccountId("");

      setIssueDate(today); setDueDate(today); setAmount("0"); setPaid("0");
      setCurrency(companies[0]?.baseCurrency ?? "EUR"); setStatus("draft");
      setLines([]); setDiscountPct(0);
    }
    setShowErrors(false);
    // Only re-initialise when the dialog opens (or switches record).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // Re-derive the number when the user switches company on a NEW invoice.
  useEffect(() => {
    if (!open || editing || !companyId) return;
    let cancelled = false;
    void nextNumberAsync("invoice", companyId, issueDate).then((n) => {
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
      clients.filter((c: Client) => contactBelongsTo(c, companyId)).sort((a, b) => a.name.localeCompare(b.name)),
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
  const clientPOs = withSelected(
    pos.filter((p) => p.companyId === companyId && p.clientId === clientId && p.status !== "cancelled"),
    editing ? poId : undefined,
    pos,
  );

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedPO = pos.find((p) => p.id === poId);
  const linkedQuote = selectedPO?.quoteId ? quotes.find((q) => q.id === selectedPO.quoteId) : undefined;

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
    currentValue: poId,
    options: clientPOs,
    getId: (po) => po.id,
    allowEmpty: true,
    loading: pos.length === 0,
    preserve: !!editing,
    onChange: setPoId,
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

  // When PO is picked, prefill amount/currency/project from it.
  useEffect(() => {
    if (!poId) return;
    const po = pos.find((x) => x.id === poId);
    if (po) {
      setAmount(String(po.amount)); setCurrency(po.currency);
      if (po.projectId) setProjectId(po.projectId);
    }
  }, [poId, pos]);

  // Prefill the editable line table from the PO (preferred) or the linked quote,
  // but never overwrite lines the user already has in the dialog.
  useEffect(() => {
    if (!open) return;
    if (lines.length > 0) return;
    const inherited = selectedPO?.lines ?? linkedQuote?.lines;
    if (inherited?.length) setLines(inherited.map((l) => ({ ...l })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, poId, selectedPO?.id, linkedQuote?.id]);

  const addLine = () => setLines((prev) => [...prev, { id: newId("ql"), description: "", details: "", unit: "fixed", quantity: 1, rate: 0, createdBy: user?.id, createdAt: new Date().toISOString() }]);
  const updateLine = (id: string, patch: Partial<QuoteLine>) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));
  const moveLine = (from: number, to: number) => setLines((prev) => moveItem(prev, from, to));
  const lineDnd = useLineReorder(moveLine);
  const totals = docTotals(lines, Number(discountPct) || 0, 0);
  const linesTotal = totals.subtotal;

  const processOk = Boolean(poId) || poWaived;
  const blocked = !processOk && status !== "draft";


  const duplicateNumber = Boolean(number.trim()) && Boolean(companyId)
    && isNumberTaken("invoice", companyId, number, editing?.id);

  const submit = () => {
    const invalid = !number.trim() || !companyId || !clientId || blocked || duplicateNumber;
    if (invalid) {
      setShowErrors(true);
      return;
    }
    const a = Number(amount) || 0;
    const p = Number(paid) || 0;
    const finalStatus = status === "draft" ? "draft" : deriveStatus(a, p, dueDate);
    const data = {
      number, companyId, clientId,
      projectId: projectId || undefined,
      poId: poId || undefined,
      poWaived: !poId && poWaived,
      poWaiverReason: !poId && poWaived ? (poWaiverReason.trim() || undefined) : undefined,

      quoteId: linkedQuote?.id,
      issueDate, dueDate, amount: a, paid: p, currency, status: finalStatus,
      subject: subject.trim() || undefined,
      bankAccountId: bankAccountId || defaultBankAccount(companies.find((c) => c.id === companyId))?.id,
      lines: lines.length ? lines.map((l) => ({ ...l })) : undefined,
      discountPct: (Number(discountPct) || 0) || undefined,
    };
    if (editing) {
      invoicesStore.update(editing.id, { ...data, updatedBy: user?.id, updatedAt: new Date().toISOString() });
      if (editing.status !== finalStatus) {
        logActivity({
          docType: "invoice", docId: editing.id, docNumber: number, companyId,
          action: "status_changed", summary: `From ${editing.status} to ${finalStatus}`,
          details: { from: editing.status, to: finalStatus },
        });
      }
      const summary = diffDocument(editing as unknown as Record<string, unknown>, data as unknown as Record<string, unknown>);
      if (summary) logActivity({ docType: "invoice", docId: editing.id, docNumber: number, companyId, action: "updated", summary });
    } else {
      invoicesStore.add(
        { id: newId("inv"), ...data, createdBy: user?.id, updatedBy: user?.id, updatedAt: new Date().toISOString() },
        { onSynced: (dbId) => logActivity({ docType: "invoice", docId: dbId, docNumber: number, companyId, action: "created", summary: `Invoice ${number} created` }) },
      );
    }
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>

        {/* Process strip */}
        <ProcessStrip hasQuote={Boolean(linkedQuote)} hasPO={Boolean(selectedPO) || poWaived} />

        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label><RequiredLabel>Number</RequiredLabel></Label>
              <Input value={number} onChange={(e) => { numberTouched.current = true; setNumber(e.target.value); }} className={invalidFieldClassName((showErrors && !number.trim()) || duplicateNumber)} aria-invalid={(showErrors && !number.trim()) || duplicateNumber} />
              {duplicateNumber && <p className="text-[11px] text-destructive mt-1">This number is already used by another invoice.</p>}
            </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label><RequiredLabel>Company</RequiredLabel></Label>
              <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); setPoId(""); }}>
                <SelectTrigger className={invalidFieldClassName(showErrors && !companyId)} aria-invalid={showErrors && !companyId}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}{companyId && !companies.some((c) => c.id === companyId) && <SelectItem value={companyId}>Current company</SelectItem>}</SelectContent>
              </Select>
            </div>
            <div>
              <Label><RequiredLabel>Client</RequiredLabel></Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId(""); setPoId(""); }}>
                <SelectTrigger className={invalidFieldClassName(showErrors && !clientId)} aria-invalid={showErrors && !clientId}><SelectValue placeholder={companyClients.length ? "Select" : "Create client first"} /></SelectTrigger>
                <SelectContent>{companyClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {selectedClient?.acquisition && (
                <p className="text-[11px] text-muted-foreground mt-1">Sales rep: <span className="text-foreground">{selectedClient.acquisition}</span></p>
              )}
            </div>
          </div>

          <div>
            <Label><RequiredLabel>Purchase order</RequiredLabel></Label>
            <Select value={poId || "__none__"} onValueChange={(v) => { const next = v === "__none__" ? "" : v; setPoId(next); if (next) setPoWaived(false); }} disabled={!clientId}>
              <SelectTrigger className={cn(!processOk && status !== "draft" && "border-destructive")}>
                <SelectValue placeholder={clientId ? (clientPOs.length ? "Select PO" : "No PO for this client") : "Select client first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— No PO —</SelectItem>
                {clientPOs.map((p) => <SelectItem key={p.id} value={p.id}>{p.number} · {fmtAmount(p.amount, p.currency)} · {p.status}</SelectItem>)}
              </SelectContent>
            </Select>

            {!poId && (
              <div className="mt-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox checked={poWaived} onCheckedChange={(v) => setPoWaived(Boolean(v))} className="mt-0.5" />
                  <span className="text-xs">
                    <span className="font-medium">Invoice without PO (bypass)</span>
                    <span className="block text-[11px] text-muted-foreground">The invoice will be flagged <strong>PO missing</strong> everywhere in the system.</span>
                  </span>
                </label>
                {poWaived && (
                  <Input value={poWaiverReason} onChange={(e) => setPoWaiverReason(e.target.value)} placeholder="Reason (e.g. client confirmed by email)" className="h-8 text-xs" />
                )}
              </div>
            )}

            {blocked && (
              <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Link a client PO — or tick the bypass above — before sending the invoice.</p>
            )}
            {!blocked && poId && (
              <p className="text-[11px] text-success mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Quote → PO → Invoice process complete.</p>
            )}
            {!poId && poWaived && (
              <p className="text-[11px] text-warning mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> PO missing — bypass recorded.</p>
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
          <div>
            <Label>Object</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Brand campaign production — Q3 2026" />
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5" /> Add line</Button>
            </div>
            {lines.length === 0 ? (
              <p className="text-xs text-muted-foreground border border-dashed border-border rounded-md py-5 text-center">
                No lines — add one, or pick a PO / quote to inherit its lines.
              </p>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <div className="overflow-x-auto stacked-table">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="bg-surface-elevated/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="w-10" />
                      <th className="text-left font-medium px-2 py-2">Description</th>
                      <th className="text-left font-medium px-2 py-2 w-20">Unit</th>
                      <th className="text-right font-medium px-2 py-2 w-16">Qty</th>
                      <th className="text-right font-medium px-2 py-2 w-24">Price</th>
                      <th className="text-right font-medium px-2 py-2 w-20">Disc %</th>
                      <th className="text-right font-medium px-2 py-2 w-24">Amount</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, li) => {
                      const rp = lineDnd.rowProps(li);
                      return (
                      <tr key={l.id} {...rp} className={cn("border-t border-border/40 align-top", rp.className)}>
                        <td className="px-1 py-1.5">
                          <DragHandle index={li} total={lines.length} handleProps={lineDnd.handleProps(li)} onMove={(f, t) => lineDnd.move(f, t, lines.length)} />
                        </td>

                        <td className="px-2 py-1.5">
                          <Input className="h-8 text-xs" value={l.description} onChange={(e) => updateLine(l.id, { description: e.target.value })} placeholder="Description" />
                          <RichTextField compact className="mt-1" value={l.details ?? ""} onChange={(v) => updateLine(l.id, { details: v })} placeholder="Details (optional)" rows={2} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Select value={l.unit} onValueChange={(v) => updateLine(l.id, { unit: v as QuoteLine["unit"] })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hour">Hour</SelectItem>
                              <SelectItem value="day">Day</SelectItem>
                              <SelectItem value="fixed">Fixed</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-2 py-1.5"><Input type="number" className="h-8 text-xs text-right" value={l.quantity} onChange={(e) => updateLine(l.id, { quantity: Number(e.target.value) })} /></td>
                        <td className="px-2 py-1.5"><Input type="number" className="h-8 text-xs text-right" value={l.rate} onChange={(e) => updateLine(l.id, { rate: Number(e.target.value) })} /></td>
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
                        <td className="px-2 py-1.5 text-right font-tnum">{fmtAmount(lineNet(l), currency)}</td>
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => removeLine(l.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {totals.lineDiscount > 0 && (
                      <tr className="border-t border-border bg-surface-elevated/30">
                        <td colSpan={6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">Line discounts</td>

                        <td className="px-2 py-2 text-right font-tnum text-muted-foreground">−{fmtAmount(totals.lineDiscount, currency)}</td>
                        <td />
                      </tr>
                    )}
                    <tr className="border-t border-border bg-surface-elevated/30">
                      <td colSpan={6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
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
                      <td className="px-2 py-2 text-right font-tnum text-muted-foreground">{totals.globalDiscount > 0 ? `−${fmtAmount(totals.globalDiscount, currency)}` : fmtAmount(0, currency)}</td>
                      <td />
                    </tr>
                    <tr className="border-t border-border bg-surface-elevated/30">
                      <td colSpan={6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">Lines total</td>
                      <td className="px-2 py-2 text-right font-tnum">{fmtAmount(linesTotal, currency)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
                <ReorderLiveRegion text={lineDnd.announcement} />
                </div>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-muted-foreground">{RICH_TEXT_HINT}</p>
              {lines.length > 0 && Math.round(linesTotal) !== Math.round(Number(amount) || 0) && (
                <Button type="button" size="sm" variant="ghost" className="text-[11px]" onClick={() => setAmount(String(linesTotal))}>
                  Use lines total ({fmtAmount(linesTotal, currency)})
                </Button>
              )}
            </div>
          </div>

          <BankAccountSelect company={companies.find((c) => c.id === companyId)} value={bankAccountId} onChange={setBankAccountId} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
            <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <Button onClick={handleSubmit} disabled={isSubmitting || blocked}>{editing ? "Save" : "Create"}</Button>
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


function MarkPaidDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (v: boolean) => void; invoice: Invoice | null }) {
  const { dataLoading } = useCompany();
  const accounts = useAccounts();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState<string>("");
  const [receivedMga, setReceivedMga] = useState<string>("");

  const coAccounts = invoice ? accounts.filter((a) => a.companyId === invoice.companyId) : [];
  const accountsLoading = !!invoice && dataLoading && coAccounts.length === 0;
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

  useEffect(() => {
    if (!open || !invoice) return;
    const currentStillAvailable = coAccounts.some((account) => account.id === accountId);
    if (currentStillAvailable) return;
    const preferred = coAccounts.find((account) => account.currency === "MGA") ?? coAccounts[0];
    if (preferred) {
      setAccountId(preferred.id);
      return;
    }
    if (!accountsLoading) setAccountId("");
  }, [open, invoice, accountId, coAccounts, accountsLoading]);

  useReconciledSelection({
    open,
    currentValue: accountId,
    options: coAccounts,
    getId: (account) => account.id,
    loading: accountsLoading,
    onChange: setAccountId,
  });

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
    logActivity({
      docType: "invoice", docId: invoice.id, docNumber: invoice.number, companyId: invoice.companyId,
      action: "payment", summary: `Marked paid on ${date}`, details: { amount: invoice.amount, currency: invoice.currency },
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
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Payment date</Label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div>
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={accountsLoading || coAccounts.length === 0}>
                <SelectTrigger className="h-9"><SelectValue placeholder={accountsLoading ? "Loading accounts..." : coAccounts.length ? "Select account" : "Create account first"} /></SelectTrigger>
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
          <Button onClick={handleSubmit} disabled={isSubmitting}>Mark paid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
