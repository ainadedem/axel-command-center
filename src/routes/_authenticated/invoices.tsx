import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { focusSearch, useFocusRow, useJumpToRecord, type FocusSearch } from "@/hooks/use-focus-row";
import { BankAccountSelect } from "@/components/bank-account-select";
import { defaultBankAccount } from "@/lib/payment-details";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useInvoices, useCompanies, useClients, useProjects, usePurchaseOrders, useQuotes, useAccounts, useTransactions,
  invoicesStore, transactionsStore, projectsStore, purchaseOrdersStore, quotesStore,
  fmtAmount, fmtFull, fmtCompact, toMGA, FX, type Invoice, type Project, type Currency, type QuoteLine, type Client,
  getNumberFormat, setNumberFormat, type NumberFormatMode,
  contactBelongsTo,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useRowWindow, SpacerRow, useScrollRef } from "@/components/virtual-rows";
import { LiveAmount, RowSaveState } from "@/components/save-state";
import { docTotals, lineNet } from "@/lib/discounts";
import { defaultTaxRate } from "@/lib/vat";

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
import { ListEmptyState, ListNoMatchState, ListErrorState } from "@/components/list-state";
import { useCreateAction } from "@/lib/create-action";
import { Eye, Pencil, Trash2, AlertTriangle, CheckCircle2, Ban, BadgeCheck, ToggleLeft, ToggleRight, Plus, X, ListFilter } from "lucide-react";
import { InvoicePreview } from "@/components/invoice-preview";
import { MarkPaidDialog } from "@/components/mark-paid-dialog";
import { useStatusDiff, planStatusChange, commitStatusChange, type InvoiceStatus } from "@/lib/invoice-status";
import { RecordPaymentDialog } from "@/components/statement-import-dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { Textarea } from "@/components/ui/textarea";
import { RICH_TEXT_HINT } from "@/lib/rich-text";
import { RichTextField } from "@/components/rich-text-field";
import { Wallet, History, CircleDollarSign, ExternalLink, UserPlus } from "lucide-react";
import { KanbanTemplatePicker } from "@/components/kanban-template-picker";
import { useKanbanTemplates, type KanbanTemplate } from "@/lib/kanban-templates";
import { BoardHistoryPanel } from "@/components/board-history-panel";
import { logBoardMove } from "@/lib/board-moves";
import { CardAction, CardCommentAction } from "@/components/kanban-card-actions";
import { nextNumber, nextNumberAsync, isNumberTaken } from "@/lib/numbering";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { withSelected } from "@/lib/select-options";
import { toast } from "sonner";
import { clientLabel, clientTitle } from "@/lib/client-name";
import { KanbanBoard, type KanbanColumnDef } from "@/components/kanban-board";
import { clientColor } from "@/lib/client-color";
import { notify } from "@/lib/notifications";
import { LayoutToggle } from "@/components/layout-toggle";
import { usePersistentState } from "@/lib/persistent-state";
import { canWriteCompany, dbCompanyId } from "@/lib/db-sync";
import { useBulkSelection, SelectAllHeaderCell, SelectRowCell, BulkActionBar } from "@/components/bulk-select";
import { refreshStampsAndSignatures } from "@/lib/stamp-refresh";
import { BulkEditDocDialog } from "@/components/bulk-edit-doc-dialog";
import { BulkStatusDialog } from "@/components/bulk-status-dialog";
import { applyBulkStatus } from "@/lib/bulk-status";
import { CancelReasonDialog } from "@/components/cancel-reason-dialog";
import { bulkUpdateDocuments, bulkSetFields, bulkResultMessage, type BulkPatch } from "@/lib/bulk-edit";
import { type ColumnDef } from "@/lib/column-prefs";
import { useTablePrefs } from "@/lib/table-prefs";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";
import { StatusBadge, PoBadge, VerifiedBadge } from "@/components/status-badge";
import { StatusMenu } from "@/components/status-menu";
import { PaymentProofBlock } from "@/components/payment-proof-block";
import { PaymentMatchDialog } from "@/components/payment-match-dialog";
import { verificationOf, badgeState, type ProofInvoice } from "@/lib/payment-proof";
import { OpportunitySelect } from "@/components/opportunity-select";
import { proposeStageChange } from "@/lib/pipeline-automation";
import { MasterDetail, DetailPanel, DetailField, DetailSection } from "@/components/master-detail";
import { useLineReorder, DragHandle, moveItem, ReorderLiveRegion } from "@/components/sortable-row";
import { useFilterPresets } from "@/lib/filter-presets";
import { FilterPresetBar } from "@/components/filter-presets";

import { buildAging, inBucket, type AgingKey } from "@/lib/aging";
import { AgingPanel } from "@/components/aging-panel";

import { StatusFilterBar, type PoState } from "@/components/status-filter-bar";
import { TableExportMenu } from "@/components/table-export-menu";
import { invoiceBalance, invoicePayable } from "@/lib/invoice-money";
import { useIsMobile } from "@/hooks/use-mobile";




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

/** Starter presets seeded once per user — renameable and deletable afterwards. */
const DEFAULT_PRESETS = [
  { id: "seed-draft", name: "Draft", statuses: ["draft"], po: [] },
  { id: "seed-sent", name: "Sent", statuses: ["sent"], po: [] },
  { id: "seed-overdue", name: "Overdue", statuses: ["overdue"], po: [] },
  { id: "seed-po-missing", name: "PO missing", statuses: [], po: ["missing"] },
];

/** PO handling state of an invoice. */
const poStateOf = (i: Invoice): PoState => (i.poId ? "linked" : i.poWaived ? "waived" : "missing");

/** Compact inline stat — label + value on one line, used in the invoices header strip. */
function StatItem({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" | "success" }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[11px] tracking-[0.02em] text-muted-foreground font-medium whitespace-nowrap">{label}</span>
      <span className={cn("text-sm font-semibold font-tnum whitespace-nowrap", tone === "danger" && "text-destructive", tone === "success" && "text-success")}>
        {value}
      </span>
    </div>
  );
}


/** `focus`/`aging` deep links plus `fromPo` (start a new invoice from a PO). */
const invoiceSearch = (search: Record<string, unknown>): FocusSearch & { fromPo?: string } => ({
  ...focusSearch(search),
  ...(typeof search.fromPo === "string" && search.fromPo ? { fromPo: search.fromPo } : {}),
});


export const Route = createFileRoute("/_authenticated/invoices")({ component: InvoicesPage, validateSearch: invoiceSearch });


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
  const { scope, bootstrapError, retryBootstrap } = useCompany();
  const invoices = useInvoices();
  const companies = useCompanies();
  const clients = useClients();
  const projects = useProjects();
  const transactions = useTransactions();
  const baseList = inScope(invoices, scope);
  const [matchOpen, setMatchOpen] = useState(false);
  const verifOf = useCallback(
    (i: Invoice) => verificationOf(i as unknown as ProofInvoice, transactions as never),
    [transactions],
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [previewing, setPreviewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [cancelling, setCancelling] = useState<Invoice | null>(null);
  const [marking, setMarking] = useState<Invoice | null>(null);
  const [historyOf, setHistoryOf] = useState<Invoice | null>(null);
  const [numMode, setNumMode] = useState<NumberFormatMode>(getNumberFormat());
  const tp = useTablePrefs("invoices", INVOICE_COLUMNS, INVOICE_COL_WIDTHS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = usePersistentState<"list" | "board">("invoices.layout", "list");


  const toggleMode = useCallback(() => {
    const next: NumberFormatMode = numMode === "compact" ? "full" : "compact";
    setNumMode(next);
    setNumberFormat(next);
  }, [numMode]);

  const quarterOf = (iso: string) => {
    const d = parseISO(iso);
    return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
  };
  const quarterSortKey = (iso: string) => {
    const d = parseISO(iso);
    return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
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
    { key: "paymentUnverified", label: "Payment unverified", type: "boolean", accessor: (i) => verifOf(i) === "unverified" },

    { key: "currency", label: "Currency", type: "enum", accessor: (i) => i.currency },
    { key: "issueDate", label: "Issued", type: "date", accessor: (i) => i.issueDate, noGroup: true },
    { key: "dueDate", label: "Due", type: "date", accessor: (i) => i.dueDate, noGroup: true },
    { key: "issuedDay", label: "Issued (day)", type: "string", accessor: (i) => dayOf(i.issueDate), sortAccessor: (i) => i.issueDate, groupOrder: "desc", noFilter: true },
    { key: "issuedMonth", label: "Issued (month)", type: "string", accessor: (i) => monthOf(i.issueDate), sortAccessor: (i) => i.issueDate.slice(0, 7), groupOrder: "desc", noFilter: true },
    { key: "issuedQuarter", label: "Issued (quarter)", type: "string", accessor: (i) => quarterOf(i.issueDate), sortAccessor: (i) => quarterSortKey(i.issueDate), groupOrder: "desc", noFilter: true },
    { key: "amount", label: "Amount", type: "number", accessor: (i) => invoicePayable(i), noGroup: true },
    { key: "balance", label: "Balance", type: "number", accessor: (i) => invoiceBalance(i), noGroup: true },
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
  const presets = useFilterPresets("invoices", DEFAULT_PRESETS);
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
  // "Send to Invoice" from a purchase order: open the create dialog pre-linked.
  const [fromPoId, setFromPoId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!search.fromPo) return;
    setFromPoId(search.fromPo);
    setEditing(null);
    setOpen(true);
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, fromPo: undefined }), replace: true } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.fromPo]);

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
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const { user: authUser } = useAuth();

  /** Rules that make a bulk status move impossible for a given invoice. */
  const bulkStatusBlock = (inv: Invoice, next: string): string | null => {
    if (next !== "draft" && !inv.poId && !inv.poWaived) return "No purchase order";
    if (next === "paid" && invoiceBalance(inv) > 0) return "Outstanding balance — use Mark paid";
    return null;
  };

  const applyBulkStatusChange = async (next: string, rows: Invoice[], reason?: string) => {
    const result = await applyBulkStatus({
      collection: invoicesStore, docType: "invoice", rows, next, reason, userId: authUser?.id,
    });
    selection.clear();
    toast.success(result.message, result.changed.length
      ? { action: { label: "Undo", onClick: () => void result.undo() } }
      : undefined);
  };

  const applyBulk = async (patch: BulkPatch) => {
    const rows = selection.selectedRows;
    const result = await bulkUpdateDocuments({
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
    const msg = bulkResultMessage(result, "invoice");
    if (result.failed.length) toast.error(msg, { description: result.failed.map((f) => f.number).join(", ") });
    else if (result.updated === 0) toast.info(msg);
    else toast.success(msg, {
      description: result.skipped.length
        ? `Skipped: ${result.skipped.slice(0, 4).map((s) => `${s.number} (${s.reason})`).join(", ")}`
        : undefined,
    });
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
  const totalOpen = active.filter((i) => i.status !== "paid").reduce((s, i) => s + toMGA(invoiceBalance(i), i.currency), 0);
  const totalOverdue = active.filter((i) => i.status === "overdue").reduce((s, i) => s + toMGA(invoiceBalance(i), i.currency), 0);
  const totalPaid = active.filter((i) => i.status === "paid").reduce((s, i) => s + toMGA(invoicePayable(i), i.currency), 0);

  const aging = useMemo(
    () =>
      buildAging(chipFiltered.filter((i) => i.status !== "cancelled"), {
        due: (i) => i.dueDate,
        balance: (i) => toMGA(invoiceBalance(i), i.currency),
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
      count: scopedInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.paid >= invoicePayable(i) && invoicePayable(i) > 0).length,
      fix: () => {
        let n = 0;
        scopedInvoices.forEach((i) => {
          if (i.status !== "paid" && i.status !== "cancelled" && i.paid >= invoicePayable(i) && invoicePayable(i) > 0) {
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
      count: scopedInvoices.filter((i) => i.paid > 0 && i.paid < invoicePayable(i) && i.status !== "partial" && i.status !== "cancelled").length,
      fix: () => {
        let n = 0;
        scopedInvoices.forEach((i) => {
          if (i.paid > 0 && i.paid < invoicePayable(i) && i.status !== "partial" && i.status !== "cancelled") {
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
            amount: invoicePayable(i), currency: i.currency, clientId: i.clientId,
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

  // Flatten groups so long receivable lists render only the rows in view.
  const flatRows = useMemo(() => {
    const rows: ({ kind: "group"; key: string; label: string; count: number } | { kind: "item"; key: string; inv: Invoice })[] = [];
    groups.forEach((g) => {
      if (groups.length > 1) rows.push({ kind: "group", key: `g:${g.key}`, label: g.label, count: g.items.length });
      g.items.forEach((inv) => rows.push({ kind: "item", key: inv.id, inv }));
    });
    return rows;
  }, [groups]);
  const scrollRef = useScrollRef();
  const windowed = useRowWindow({ rows: flatRows, scrollRef, rowHeight: 40 });

  /**
   * Inline status change from the list / detail panel. Guarded moves keep
   * their dialogs so the audit trail keeps its evidence.
   */
  const changeStatus = (inv: Invoice, next: string) => {
    if (!isWritable(inv)) { toast.error(`You do not have permission to change ${inv.number}.`); return; }
    if (next === inv.status) return;
    if (next !== "draft" && !inv.poId && !inv.poWaived) {
      toast.error(`${inv.number} has no purchase order`, { description: "Link a PO or bypass it from the invoice editor first." });
      return;
    }
    const plan = planStatusChange(inv, next as InvoiceStatus);
    if (plan.requiresPayment) { setMarking(inv); return; }
    if (plan.requiresReason) { setCancelling(inv); return; }
    const committed = commitStatusChange(inv, plan);
    toast.success(`${inv.number} → ${next}`, {
      action: { label: "Undo", onClick: () => { void committed.revert(); } },
    });
  };

  const renderCell = (key: string, inv: Invoice) => {
    const co = companies.find((c) => c.id === inv.companyId);
    const cl = clients.find((c) => c.id === inv.clientId);
    const proj = inv.projectId ? projects.find((p) => p.id === inv.projectId) : undefined;
    const days = differenceInDays(parseISO(inv.dueDate), new Date());
    const balance = invoiceBalance(inv);
    const timing = inv.paidDate ? differenceInDays(parseISO(inv.paidDate), parseISO(inv.dueDate)) : null;

    switch (key) {
      case "number":
        return <ListTd lines={2} className="font-tnum text-xs text-muted-foreground" title={inv.number}>{inv.number}</ListTd>;
      case "client":
        return <ListTd lines={2} className="font-medium" title={clientTitle(cl)}>{clientLabel(cl)}</ListTd>;
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
              <StatusMenu
                status={inv.status}
                statuses={INVOICE_STATUSES}
                disabled={!isWritable(inv)}
                disabledReason="You cannot change this invoice"
                title={inv.status === "cancelled" && inv.cancellationReason ? `Cancelled: ${inv.cancellationReason}` : undefined}
                onSelect={(next) => changeStatus(inv, next)}
              />
              {inv.status !== "cancelled" && <PoBadge state={poStateOf(inv)} />}
              {inv.status !== "cancelled" && verifOf(inv) !== "n/a" && <VerifiedBadge state={badgeState(verifOf(inv))} />}
              <StatusDiffChip id={inv.id} />
            </div>
          </ListTd>
        );
      case "amount":
        return (
          <ListTd align="right" className="font-tnum" title={fmtFull(invoicePayable(inv), inv.currency)}>
            <span className="inline-flex items-center justify-end gap-1.5">
              <RowSaveState collection="invoices" id={inv.id} />
              <LiveAmount collection="invoices" id={inv.id}>{fmtFull(invoicePayable(inv), inv.currency)}</LiveAmount>
            </span>
          </ListTd>
        );
      case "balance":
        return (
          <ListTd align="right" className="font-tnum font-medium">
            {inv.status === "cancelled" ? <span className="text-muted-foreground">—</span> : balance > 0 ? (
              <LiveAmount collection="invoices" id={inv.id}>{fmtFull(balance, inv.currency)}</LiveAmount>
            ) : <span className="text-muted-foreground">—</span>}
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
      case "client": return clientLabel(clients.find((c) => c.id === inv.clientId), "");
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
      case "amount": return fmtFull(invoicePayable(inv), inv.currency);
      case "balance": return inv.status === "cancelled" ? "" : fmtFull(invoiceBalance(inv), inv.currency);
      case "owner": return ownerName(inv.createdBy);
      default: return "";
    }
  };

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [
    ...(view.state.q.trim()
      ? [{ key: "q", label: `Search: “${view.state.q.trim()}”`, onRemove: () => view.setState((p) => ({ ...p, q: "" })) }]
      : []),
    ...chipStatuses.map((s) => ({
      key: `st:${s}`,
      label: `Status: ${s}`,
      onRemove: () => setChipStatuses((prev) => prev.filter((x) => x !== s)),
    })),
    ...chipPo.map((s) => ({
      key: `po:${s}`,
      label: `PO: ${s}`,
      onRemove: () => setChipPo((prev) => prev.filter((x) => x !== s)),
    })),
    ...Object.entries(view.state.filters)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => ({
        key: `f:${k}`,
        label: fields.find((f) => f.key === k)?.label ?? k,
        onRemove: () => view.setState((p) => ({ ...p, filters: { ...p.filters, [k]: undefined } })),
      })),
    ...(bucket ? [{ key: "aging", label: `Ageing: ${bucket}`, onRemove: () => setDrawerBucket(null) }] : []),
    ...(view.state.group
      ? [{
          key: "group",
          label: `Grouped by ${fields.find((f) => f.key === view.state.group!.key)?.label ?? view.state.group!.key}`,
          onRemove: () => view.setState((p) => ({ ...p, group: null })),
        }]
      : []),
  ];
  const filtersActive = activeChips.length > 0 || Boolean(view.state.sort);
  const isMobile = useIsMobile();

  // Reserve space for the table toolbar above the table's scroll pane.
  const pageRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const card = filterRef.current;
    const page = pageRef.current;
    if (!card || !page || typeof ResizeObserver === "undefined") return;
    const sync = () => page.style.setProperty("--list-sticky-top", `${card.offsetHeight}px`);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(card);
    return () => ro.disconnect();
  });

  const clearAllFilters = () => {
    setChipStatuses([]);
    setChipPo([]);
    setBucket(null);
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, aging: undefined, focus: undefined }), replace: true } as never);
    view.reset();
  };

  const selected = selectedId ? list.find((i) => i.id === selectedId) ?? null : null;
  const detail = selected ? (
    <DetailPanel
      eyebrow={companies.find((c) => c.id === selected.companyId)?.name ?? "Invoice"}
      title={selected.number}
      subtitle={clients.find((c) => c.id === selected.clientId)?.name}
      onClose={() => setSelectedId(null)}
      actions={
        <>
          <Button size="sm" onClick={() => setPreviewing(selected)} className="gap-1.5"><Eye className="h-4 w-4" /> Preview</Button>
          <Button size="sm" variant="outline" onClick={() => { setEditing(selected); setOpen(true); }} className="gap-1.5"><Pencil className="h-4 w-4" /> Edit</Button>
          {selected.status !== "paid" && selected.status !== "cancelled" && (
            <Button size="sm" variant="outline" onClick={() => setPaying(selected)} className="gap-1.5"><Wallet className="h-4 w-4" /> Payment</Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setHistoryOf(selected)} className="gap-1.5"><History className="h-4 w-4" /> History</Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusMenu
          status={selected.status}
          statuses={INVOICE_STATUSES}
          disabled={!isWritable(selected)}
          disabledReason="You cannot change this invoice"
          onSelect={(next) => changeStatus(selected, next)}
        />
        <PoBadge state={poStateOf(selected)} />
      </div>
      <PaymentProofBlock invoice={selected} />
      <DetailSection>
        <DetailField label="Project" value={projects.find((p) => p.id === selected.projectId)?.name ?? "—"} />
        <DetailField label="Issued" value={selected.issueDate} mono />
        <DetailField label="Due" value={selected.dueDate} mono />
      </DetailSection>
      <DetailSection title="Amounts">
        <DetailField label="Total" value={fmtFull(invoicePayable(selected), selected.currency)} mono />
        <DetailField label="Paid" value={fmtFull(selected.paid, selected.currency)} mono />
        <DetailField label="Balance" value={fmtFull(invoiceBalance(selected), selected.currency)} mono />
      </DetailSection>
    </DetailPanel>
  ) : null;

  return (
    <div ref={pageRef} className="p-5 sm:p-10 lg:p-12">
      <MasterDetail detail={detail}>
      <div className="space-y-4">

      {bootstrapError ? (
        <ListErrorState label="invoices" message={bootstrapError} onRetry={retryBootstrap} />
      ) : list.length === 0 && (filtersActive || baseList.length > 0) ? (
        <ListNoMatchState
          label="invoices"
          chips={activeChips}
          onClearAll={clearAllFilters}
          onCreate={openCreate}
          createLabel="New invoice"
        />
      ) : list.length === 0 ? (
        <ListEmptyState label="invoices" onCreate={openCreate} createLabel="Create your first invoice" />
      ) : (

        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 px-1">
            <StatItem label="Open receivables" value={fmtAmount(totalOpen, "MGA")} />
            <StatItem label="Overdue" value={fmtAmount(totalOverdue, "MGA")} tone={totalOverdue > 0 ? "danger" : "default"} />
            <StatItem label="Collected (period)" value={fmtAmount(totalPaid, "MGA")} tone="success" />
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
                    invoiceBalance(i) > 0 &&
                    inBucket(i.dueDate, key),
                )
                .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
                .map((i) => ({
                  id: i.id,
                  title: i.number,
                  subtitle: clients.find((c) => c.id === i.clientId)?.name,
                  amount: toMGA(invoiceBalance(i), i.currency),
                  due: i.dueDate,
                  status: i.status,
                }))
            }
            drawerBucket={urlBucket}
            onDrawerBucketChange={setDrawerBucket}
            onJump={(item) => jumpTo(item.id, bucket)}
          />

          {/* Unified table toolbar — sticky, never wraps: chips overflow into a menu */}
          <div
            ref={filterRef}
            className="sticky top-0 z-30 rounded-2xl border border-border bg-card/95 backdrop-blur-sm shadow-[var(--shadow-card)] p-2.5"
          >
            <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span
                title={`${list.length} of ${baseList.length} invoice${baseList.length !== 1 ? "s" : ""}${filtersActive ? " · filtered" : ""}`}
                aria-label={`${list.length} of ${baseList.length} invoices`}
                className="inline-flex shrink-0 items-center gap-1.5 h-8 px-2 rounded-full border border-border bg-surface text-xs text-muted-foreground font-tnum whitespace-nowrap"
              >
                <ListFilter className="h-4 w-4" />
                <span>{list.length}/{baseList.length}</span>
              </span>
              <DataToolbar view={view} items={baseList} iconOnly className="shrink-0 flex-nowrap" />
              <FilterPresetBar
                api={presets}
                statuses={chipStatuses}
                po={chipPo}
                onApply={(p) => { setChipStatuses(p.statuses); setChipPo(p.po as PoState[]); }}
                iconOnly
              />
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
                iconOnly
                overflow
                forceOverflowAll={isMobile}
              />
              {filtersActive && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  title="Clear all"
                  aria-label="Clear all filters"
                  className="inline-flex shrink-0 items-center justify-center h-8 w-8 rounded-full bg-surface text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <div className="ml-auto shrink-0 flex items-center gap-1 rounded-full bg-[var(--surface-container)]/70 p-1">
                <TableExportMenu
                  filename="invoices"
                  title="Invoices"
                  subtitle={`${list.length} row${list.length !== 1 ? "s" : ""}`}
                  build={() => ({
                    columns: tp.visible.map((c) => ({ key: c.key, label: c.label, width: tp.width(c.key), align: ALIGN[c.key] ?? "left" })),
                    rows: list.map((inv) => Object.fromEntries(tp.visible.map((c) => [c.key, exportValue(c.key, inv)]))),
                  })}
                  iconOnly
                />
                <LayoutToggle value={layout} onChange={setLayout} />
                {layout === "list" && <ColumnPicker prefs={tp} onResetWidths={tp.resetWidths} onResetOrder={tp.resetOrder} iconOnly />}
                <ReconcileButton checks={checks} iconOnly />
                <button
                  onClick={toggleMode}
                  title={numMode === "compact" ? "Switch to full numbers" : "Switch to compact numbers"}
                  aria-label={numMode === "compact" ? "Switch to full numbers" : "Switch to compact numbers"}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-surface text-muted-foreground hover:text-foreground hover:bg-[var(--surface-container)] transition-[color,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                >
                  {numMode === "compact" ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                </button>
              </div>
              <span className="h-5 w-px bg-border shrink-0" aria-hidden />
              <Button
                size="sm"
                onClick={openCreate}
                className="btn-new gap-1.5 shrink-0"
                aria-label="New invoice"
                title="New invoice"
              >
                <Plus className="h-4 w-4" />
                {!isMobile && "New invoice"}
              </Button>
            </div>
          </div>


          {layout === "board" ? (
            <InvoiceBoard list={list} clients={clients} companies={companies} canWrite={isWritable} onOpen={(inv) => setSelectedId(inv.id)} onMarkPaid={(inv) => setMarking(inv)} />
          ) : (
          <ListTableShell
            scrollX
            stickyHeader
            announcement={tp.announcement}
            scrollRef={windowed.active ? scrollRef : undefined}
            maxHeight={windowed.active ? "calc(100dvh - 22rem)" : undefined}
          >
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
                <SpacerRow height={windowed.padTop} colSpan={colCount} />
                {windowed.items.map((row) => {
                  if (row.kind === "group") {
                    return <GroupHeaderRow key={row.key} label={row.label} count={row.count} colSpan={colCount} />;
                  }
                  const inv = row.inv;
                  return (
                    <Fragment key={inv.id}>
                    <tr
                      data-focus-id={inv.id}
                      data-selected={selectedId === inv.id ? "true" : undefined}
                      onClick={() => setSelectedId(inv.id)}
                      style={{ boxShadow: `inset 3px 0 0 0 ${clientColor(clients.find((c) => c.id === inv.clientId))}` }}
                      className="cursor-pointer hover:bg-surface-elevated/40 data-[selected=true]:bg-[var(--primary-container)]/40 transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                    >
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
                  );
                })}
                <SpacerRow height={windowed.padBottom} colSpan={colCount} />
              </tbody>
            </ListTable>
          </ListTableShell>
          )}

        </>
      )}
      </div>
      </MasterDetail>


      <PaymentMatchDialog
        open={matchOpen}
        onOpenChange={setMatchOpen}
        invoices={selection.count > 0 ? selection.selectedRows : list}
      />

      <BulkActionBar count={selection.count} noun="invoice" onClear={selection.clear}>
        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => setBulkOpen(true)}>
          Bulk edit
        </Button>
        <Button
          size="sm" variant="outline" className="h-7 px-3 text-xs"
          onClick={() => bulkStatus("paid", "Marked paid", (inv) => ({ paid: invoicePayable(inv), paidDate: inv.paidDate ?? new Date().toISOString().slice(0, 10) }))}
        >
          Mark paid
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => bulkStatus("sent", "Marked sent")}>
          Mark sent
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setMatchOpen(true)}>
          Match payments
        </Button>
        <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setBulkStatusOpen(true)}>
          Change status
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
      <BulkStatusDialog
        open={bulkStatusOpen}
        onOpenChange={setBulkStatusOpen}
        noun="invoice"
        rows={selection.selectedRows}
        statuses={INVOICE_STATUSES}
        canWrite={isWritable}
        validate={bulkStatusBlock}
        onApply={applyBulkStatusChange}
      />
      <BulkEditDocDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        rows={selection.selectedRows}
        noun="invoice"
        docType="invoice"
        onApply={applyBulk}
      />

      <InvoiceDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFromPoId(undefined); }} editing={editing} prefillPoId={fromPoId} />
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

/**
 * Cancellation always collects a reason, then goes through the guarded status
 * commit so the change is conflict-checked and lands in the audit trail.
 */
function CancelInvoiceDialog({ open, onOpenChange, invoice }: { open: boolean; onOpenChange: (v: boolean) => void; invoice: Invoice | null }) {
  if (!invoice) return null;
  return (
    <CancelReasonDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Cancel invoice ${invoice.number}`}
      description="The invoice stays in the CRM as cancelled. The reason is stored on the invoice and in its audit trail."
      confirmLabel="Cancel invoice"
      onConfirm={(reason) => {
        const plan = planStatusChange(invoice, "cancelled", { reason });
        const committed = commitStatusChange(invoice, plan);
        toast.success(`${invoice.number} cancelled`, {
          action: { label: "Undo", onClick: () => { void committed.revert(); } },
        });
      }}
    />
  );
}

function deriveStatus(amount: number, paid: number, dueDate: string): Invoice["status"] {
  if (paid >= amount && amount > 0) return "paid";
  if (paid > 0 && paid < amount) return "partial";
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return "overdue";
  return "sent";
}

function InvoiceDialog({ open, onOpenChange, editing, prefillPoId }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Invoice | null; prefillPoId?: string }) {
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
  const [taxRate, setTaxRate] = useState<number>(0);

  const [showErrors, setShowErrors] = useState(false);
  const [opportunityId, setOpportunityId] = useState("");

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
      setTaxRate(editing.taxRate ?? 0);
      setOpportunityId(editing.opportunityId ?? "");
    } else {
      // Starting from a PO ("Send to Invoice"): inherit its company/client/project.
      const sourcePo = prefillPoId ? pos.find((p) => p.id === prefillPoId) : undefined;
      const cid = sourcePo?.companyId ?? companies[0]?.id ?? "";
      const company = companies.find((c) => c.id === cid);
      numberTouched.current = false; setNumber(cid ? nextNumber("invoice", cid, today) : ""); setCompanyId(cid);
      setClientId(sourcePo?.clientId ?? "");
      setProjectId(sourcePo?.projectId ?? ""); setPoId(sourcePo?.id ?? ""); setPoWaived(false); setPoWaiverReason("");
      setSubject(sourcePo?.subject ?? ""); setBankAccountId(sourcePo?.bankAccountId ?? "");

      setOpportunityId("");
      setIssueDate(today); setDueDate(today);
      setAmount(sourcePo ? String(sourcePo.amount) : "0"); setPaid("0");
      setCurrency(sourcePo?.currency ?? company?.baseCurrency ?? "EUR"); setStatus("draft");
      setLines((sourcePo?.lines ?? []).map((l) => ({ ...l }))); setDiscountPct(0);
      setTaxRate(defaultTaxRate(company ?? companies[0], today));
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
  const totals = docTotals(lines, Number(discountPct) || 0, Number(taxRate) || 0);

  // New invoices: follow the company/issue-date VAT rule until the user overrides it.
  useEffect(() => {
    if (!open || editing || !companyId) return;
    setTaxRate(defaultTaxRate(companies.find((c) => c.id === companyId), issueDate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, companyId, issueDate]);

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
    const taxRateNum = Number(taxRate) || 0;
    // Same convention as quotations: `amount` is the pre-tax subtotal, with the
    // VAT and payable total stored alongside it.
    const manual = Number(amount) || 0;
    const a = lines.length ? totals.subtotal : manual;
    const taxAmount = lines.length ? totals.taxAmount : Math.round((manual * taxRateNum) / 100);
    const payable = a + taxAmount;
    const p = Number(paid) || 0;
    const finalStatus = status === "draft" ? "draft" : deriveStatus(payable, p, dueDate);
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
      taxRate: taxRateNum,
      taxAmount,
      totalAmount: payable,
      // Pipeline link: explicit choice wins, otherwise inherit the source quote's deal.
      opportunityId: opportunityId || linkedQuote?.opportunityId || undefined,
    };
    const oppId = data.opportunityId;

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

    if (oppId && finalStatus !== "draft" && editing?.status !== finalStatus) {
      proposeStageChange(oppId, "invoice_issued", {},
        editing ? { docType: "invoice", docId: editing.id, docNumber: number } : undefined);
    }
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(96vw,1040px)] p-0 gap-0 max-h-[92dvh] overflow-hidden flex flex-col form-compact">
        <DialogHeader className="shrink-0 border-b border-border px-5 py-3">
          <DialogTitle className="text-base">{editing ? "Edit invoice" : "New invoice"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
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
          <OpportunitySelect
            companyId={companyId}
            clientId={clientId}
            subject={subject}
            issueDate={issueDate}
            value={opportunityId || linkedQuote?.opportunityId || ""}
            onChange={setOpportunityId}
            allowCreate={false}
          />
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
                <table className="w-full min-w-[720px] md:min-w-0 md:table-fixed text-xs">
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
                      <td colSpan={6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">Subtotal</td>
                      <td className="px-2 py-2 text-right font-tnum">{fmtAmount(linesTotal, currency)}</td>
                      <td />
                    </tr>
                    <tr className="bg-surface-elevated/30">
                      <td colSpan={6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <span>Tax</span>
                          <div className="relative">
                            <Input
                              type="number" min={0} step={0.01}
                              className="h-7 w-20 text-xs text-right pr-6"
                              value={taxRate}
                              onChange={(e) => setTaxRate(Number(e.target.value))}
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">%</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-tnum">{fmtAmount(totals.taxAmount, currency)}</td>
                      <td />
                    </tr>
                    <tr className="border-t border-border bg-surface-elevated/40">
                      <td colSpan={6} className="px-2 py-2 text-right text-[11px] uppercase tracking-wider text-foreground font-semibold">Total</td>
                      <td className="px-2 py-2 text-right font-tnum font-semibold">{fmtAmount(totals.total, currency)}</td>
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
              {lines.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Amount is computed from the lines: {fmtAmount(totals.subtotal, currency)} HT · {fmtAmount(totals.total, currency)} payable
                </p>
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
              <Label>Amount (excl. tax)</Label>
              <div className="relative">
                <Input
                  type="number" className="pr-10"
                  value={lines.length ? String(totals.subtotal) : amount}
                  disabled={lines.length > 0}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">
                  {currency === "EUR" ? "€" : currency === "USD" ? "$" : "Ar"}
                </span>
              </div>
              {!lines.length && Number(taxRate) > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  + {fmtAmount(Math.round(((Number(amount) || 0) * (Number(taxRate) || 0)) / 100), currency)} tax · {fmtAmount(Math.round((Number(amount) || 0) * (1 + (Number(taxRate) || 0) / 100)), currency)} payable
                </p>
              )}
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
            {lines.length === 0 && (
              <div>
                <Label>Tax %</Label>
                <div className="relative">
                  <Input
                    type="number" min={0} step={0.01} className="pr-8"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">%</span>
                </div>
              </div>
            )}
          </div>

        </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-border px-5 py-3 gap-2">
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



/** Transient inline diff shown on a row right after a status change. */
function StatusDiffChip({ id }: { id: string }) {
  const diff = useStatusDiff(id);
  if (!diff) return null;
  return (
    <span
      title={diff}
      className="inline-flex max-w-[220px] truncate items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary animate-in fade-in"
    >
      {diff}
    </span>
  );
}


/* ─── Board view (drag an invoice between statuses) ────────────────── */

const INVOICE_BOARD_COLUMNS: { key: InvoiceStatus; label: string; dot: string }[] = [
  { key: "draft", label: "Draft", dot: "bg-slate-400" },
  { key: "sent", label: "Sent", dot: "bg-blue-500" },
  { key: "partial", label: "Partly paid", dot: "bg-amber-500" },
  { key: "paid", label: "Paid", dot: "bg-emerald-500" },
  { key: "overdue", label: "Overdue", dot: "bg-rose-500" },
  { key: "cancelled", label: "Cancelled", dot: "bg-muted-foreground" },
];

const INVOICE_TEMPLATES: KanbanTemplate[] = [
  { id: "sales-flow", name: "Sales flow", keys: ["draft", "sent", "paid"] },
  { id: "collections", name: "Collections", keys: ["sent", "partial", "overdue", "paid"] },
  { id: "full", name: "Full", keys: ["draft", "sent", "partial", "paid", "overdue", "cancelled"] },
];

function InvoiceBoard({
  list,
  clients,
  companies,
  canWrite,
  onOpen,
  onMarkPaid,
}: {
  list: Invoice[];
  clients: Client[];
  companies: ReturnType<typeof useCompanies>;
  canWrite: (inv: Invoice) => boolean;
  onOpen: (inv: Invoice) => void;
  onMarkPaid: (inv: Invoice) => void;
}) {
  const { user } = useAuth();
  const tpl = useKanbanTemplates("invoices", INVOICE_TEMPLATES);
  const [historyOpen, setHistoryOpen] = useState(false);
  const activeKeys = tpl.active?.keys ?? INVOICE_BOARD_COLUMNS.map((c) => c.key);

  const columns: KanbanColumnDef[] = activeKeys
    .map((k) => INVOICE_BOARD_COLUMNS.find((c) => c.key === k))
    .filter(Boolean)
    .map((c) => {
      const col = c!;
      const items = list.filter((inv) => inv.status === col.key);
      const sum = items.reduce((acc, inv) => acc + toMGA(invoicePayable(inv), inv.currency), 0);
      return { key: col.key, label: col.label, dot: col.dot, meta: fmtCompact(sum, "MGA") };
    });

  const visible = list.filter((inv) => activeKeys.includes(inv.status));
  const hidden = list.length - visible.length;

  const [cancelling, setCancelling] = useState<Invoice | null>(null);

  const blocked = (inv: Invoice, to: string, reason: string) =>
    logBoardMove({
      docType: "invoice", docId: inv.id, docNumber: inv.number, companyId: inv.companyId,
      from: inv.status, to, blocked: true, reason,
    });

  /**
   * Drag only performs status changes that need no extra input. Moves to
   * "paid" with an outstanding balance, or to "cancelled" (which requires a
   * reason), stay in their dialogs so the audit trail keeps its evidence.
   */
  const move = (inv: Invoice, next: string) => {
    const from = inv.status;
    const plan = planStatusChange(inv, next as InvoiceStatus);
    if (plan.requiresPayment) {
      blocked(inv, next, "outstanding balance");
      toast.error(`${inv.number} has an outstanding balance`, { description: "Use “Mark paid” to record the payment." });
      return;
    }
    if (plan.requiresReason) {
      // Cancelling is allowed from the board, but only through the reason gate.
      setCancelling(inv);
      return;
    }
    const committed = commitStatusChange(inv, plan);
    logBoardMove({ docType: "invoice", docId: inv.id, docNumber: inv.number, companyId: inv.companyId, from, to: next });
    toast.success(`${inv.number} → ${next}`, {
      action: { label: "Undo", onClick: () => { void committed.revert(); } },
    });
  };

  const assignToMe = (inv: Invoice) => {
    if (!user?.id) return;
    if (!canWrite(inv)) { toast.error(`You do not have permission to change ${inv.number}.`); return; }
    const current = inv.assignedTo ?? [];
    if (current.includes(user.id)) { toast.info(`You are already following ${inv.number}.`); return; }
    if (current.length >= 3) { toast.error(`${inv.number} already has 3 assignees.`); return; }
    invoicesStore.update(inv.id, { assignedTo: [...current, user.id] });
    notify({
      kind: "assignment", companyId: inv.companyId, docType: "invoice", docId: inv.id, docNumber: inv.number,
      title: `${inv.number} assigned`, body: "Assigned from the board.", href: "/invoices",
      recipients: [user.id], amount: inv.amount,
    });
    toast.success(`Assigned ${inv.number} to you`);
  };

  const comment = (inv: Invoice, text: string) => {
    void logActivity({
      docType: "invoice", docId: inv.id, docNumber: inv.number, companyId: inv.companyId,
      action: "comment", summary: text,
    });
    notify({
      kind: "comment", companyId: inv.companyId, docType: "invoice", docId: inv.id, docNumber: inv.number,
      title: `New comment on ${inv.number}`, body: text, href: "/invoices",
      recipients: inv.assignedTo ?? [], amount: inv.amount,
    });
    toast.success(`Comment added to ${inv.number}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        {hidden > 0 && (
          <button
            type="button"
            onClick={() => tpl.setActive("full")}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {hidden} hidden by this template
          </button>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setHistoryOpen(true)}>
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Board history</span>
        </Button>
        <KanbanTemplatePicker
          templates={tpl.templates}
          active={tpl.active}
          onSelect={tpl.setActive}
          onSave={tpl.save}
          onRename={tpl.rename}
          onRemove={tpl.remove}
          currentKeys={activeKeys}
        />
      </div>

      <KanbanBoard
        className="xl:grid-cols-3 2xl:grid-cols-6"
        columns={columns}
        items={visible}
        idOf={(inv) => inv.id}
        labelOf={(inv) => inv.number}
        columnOf={(inv) => inv.status}
        canMove={(inv, to) => {
          if (canWrite(inv)) return true;
          blocked(inv, to, "no permission");
          toast.error(`You do not have permission to change ${inv.number}.`);
          return false;
        }}
        onMove={move}
        onCardClick={onOpen}
        accentOf={(inv) => clientColor(clients.find((c) => c.id === inv.clientId))}
        renderActions={(inv) => (
          <>
            <StatusMenu
              status={inv.status}
              statuses={INVOICE_STATUSES}
              disabled={!canWrite(inv)}
              disabledReason="You cannot change this invoice"
              onSelect={(next) => move(inv, next)}
              className="mr-auto"
            />
            <CardAction icon={ExternalLink} label="Open details" onClick={() => onOpen(inv)} />
            <CardAction
              icon={CircleDollarSign}
              label="Mark as paid"
              tone="success"
              disabled={inv.status === "paid" || inv.status === "cancelled" || !canWrite(inv)}
              onClick={() => onMarkPaid(inv)}
            />
            <CardAction icon={UserPlus} label="Assign to me" onClick={() => assignToMe(inv)} disabled={!user?.id} />
            <CardCommentAction onSubmit={(text) => comment(inv, text)} />
          </>
        )}
        renderCard={(inv) => {
          const cl = clients.find((c) => c.id === inv.clientId);
          const co = companies.find((c) => c.id === inv.companyId);
          const balance = invoiceBalance(inv);
          return (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs font-tnum text-muted-foreground break-words">{inv.number}</div>
                {co && <span className="h-1.5 w-1.5 rounded-full mt-1 shrink-0" style={{ background: co.color }} />}
              </div>
              <div className="text-sm font-medium leading-snug mt-0.5 break-words" title={clientTitle(cl)}>{clientLabel(cl)}</div>
              {inv.subject && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{inv.subject}</div>}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                <div className="font-tnum text-sm font-semibold">{fmtCompact(invoicePayable(inv), inv.currency)}</div>
                <div className="text-[10px] text-muted-foreground font-tnum">
                  {balance > 0 ? `Due ${format(parseISO(inv.dueDate), "MMM d")}` : "Settled"}
                </div>
              </div>
            </>
          );
        }}
      />

      <CancelInvoiceDialog open={!!cancelling} onOpenChange={(v) => { if (!v) setCancelling(null); }} invoice={cancelling} />
      <BoardHistoryPanel
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        docType="invoice"
        docIds={list.map((inv) => inv.id)}
        onOpenDoc={(id) => {
          const inv = list.find((x) => x.id === id);
          if (inv) onOpen(inv);
        }}
      />
    </div>
  );
}

