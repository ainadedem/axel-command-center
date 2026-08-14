import { useCreateAction } from "@/lib/create-action";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { inScope, useCompany } from "@/lib/company-context";
import { newId } from "@/lib/data-store";
import { useAuth } from "@/lib/auth-context";
import { exportCsvRows } from "@/lib/export-csv";
import {
  useInvoices, usePurchaseOrders, useExpenses, useClients, useCompanies,
  usePvrRecords, useInvoiceEscalations,
  invoiceEscalationsStore, fmtAmount,
  type Invoice, type InvoiceEscalation, type PurchaseOrder, type PvrRecord,
} from "@/lib/mock-data";
import {
  SOPS, evaluateCompliance, agingDays, dueStage, ESCALATION_STAGES, STAGE_ACTIONS,
  type Violation, type SopDoc,
} from "@/lib/sop";
import { weeklySummary, type WeeklySummary } from "@/lib/sop-summary";
import { WeeklySummaryCard } from "@/components/weekly-summary-card";
import { FollowUpDraftDialog } from "@/components/followup-draft-dialog";
import { GuidedTour, useTourSeen, type TourStep } from "@/components/guided-tour";
import { useOwnerNames } from "@/hooks/use-owner-names";
import { useEffectiveRole } from "@/lib/use-effective-role";
import { seedDemoWorkspace, removeDemoWorkspace } from "@/lib/sop-demo.functions";
import { saveInvoiceEscalation } from "@/lib/db-sync";
import { toast } from "sonner";
import {
import { KpiCard } from "@/components/kpi-card";
  ShieldCheck, AlertTriangle, Download, BookText, CheckCircle2, Clock,
  PlayCircle, Trash2, Mail, HelpCircle, Loader2, ExternalLink,
} from "lucide-react";

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="kpis"]',
    title: "Your compliance health",
    body: "Four numbers, refreshed live: how many documents pass, how many red flags need action today, how many yellow warnings can wait, and how much was checked.",
  },
  {
    selector: '[data-tour="weekly-summary"]',
    title: "This week at a glance",
    body: "The weekly card compares today with last week, buckets overdue money by age, and names who has open items — bring it to the Monday review.",
  },
  {
    selector: '[data-tour="tabs"]',
    title: "Three views",
    body: "Compliance is the checklist of everything that's missing. AR escalations is the chase list. SOP library is the written procedure behind both.",
  },
  {
    selector: '[data-tour="violations"]',
    title: "The checklist",
    body: "Each row is one gap on one document, in plain language, with the money at risk. Filter by severity or rule, then export to a spreadsheet.",
  },
  {
    selector: '[data-tour="demo"]',
    title: "Try it safely",
    body: "Load demo data to create a clearly labelled sample company with invoices that trigger every rule — then remove it in one click when you're done.",
  },
];

export const Route = createFileRoute("/_authenticated/sops")({
  component: SopsPage,
  head: () => ({
    meta: [
      { title: "SOPs & Compliance — Axel" },
      { name: "description", content: "Standard operating procedures and live compliance monitoring for invoicing, receivables and payables." },
      { property: "og:title", content: "SOPs & Compliance — Axel" },
      { property: "og:description", content: "Standard operating procedures and live compliance monitoring for invoicing, receivables and payables." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SopsPage() {
  return (
    <AppShell>
      <PageHeader title="SOPs & Compliance" description="Operating procedures and the live checks that enforce them." />
      <Body />
    </AppShell>
  );
}

type Tab = "dashboard" | "escalations" | "library";

function Body() {
  const { scope } = useCompany();
  const [tab, setTab] = useState<Tab>("dashboard");
  // Topbar "Log escalation" jumps to the AR escalation ladder.
  useCreateAction(() => setTab("escalations"));
  const { isGroupAdmin } = useEffectiveRole();
  const [tourSeen, markTourSeen] = useTourSeen("sops-tour-v1");
  const [tourOpen, setTourOpen] = useState(false);

  const invoices = inScope(useInvoices(), scope);
  const purchaseOrders = inScope(usePurchaseOrders(), scope);
  const expenses = inScope(useExpenses(), scope);
  const pvrs = inScope(usePvrRecords(), scope);
  const escalations = inScope(useInvoiceEscalations(), scope);

  const input = useMemo(
    () => ({ invoices, purchaseOrders, expenses, pvrs, escalations }),
    [invoices, purchaseOrders, expenses, pvrs, escalations],
  );
  const violations = useMemo(() => evaluateCompliance(input), [input]);
  const summary = useMemo(() => weeklySummary(input, violations), [input, violations]);

  // Offer the walkthrough once, automatically, the first time the page opens.
  useEffect(() => {
    if (!tourSeen) setTourOpen(true);
  }, [tourSeen]);

  const closeTour = () => {
    setTourOpen(false);
    markTourSeen();
  };

  const critical = violations.filter((v) => v.severity === "critical").length;
  const warnings = violations.length - critical;
  const checked = invoices.length + purchaseOrders.length + expenses.length;
  const flagged = new Set(violations.map((v) => v.entityId)).size;
  const rate = checked === 0 ? 100 : Math.round(((checked - flagged) / checked) * 100);

  return (
    <div className="p-4 sm:p-8 space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setTourOpen(true)}>
          <HelpCircle className="h-3.5 w-3.5 mr-1.5" /> 60-second walkthrough
        </Button>
        {isGroupAdmin && <DemoControls />}
      </div>

      <div data-tour="kpis" className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi label="Compliance rate" value={`${rate}%`} accent={rate >= 90 ? "text-success" : rate >= 70 ? "text-warning" : "text-destructive"} />
        <Kpi label="Critical violations" value={String(critical)} mono accent={critical > 0 ? "text-destructive" : undefined} />
        <Kpi label="Warnings" value={String(warnings)} mono accent={warnings > 0 ? "text-warning" : undefined} />
        <Kpi label="Records checked" value={String(checked)} mono />
      </div>

      <div data-tour="tabs" className="flex items-center gap-1 rounded-xl border border-border bg-[var(--gradient-surface)] p-1 w-fit">
        {([
          ["dashboard", "Compliance", ShieldCheck],
          ["escalations", "AR escalations", Clock],
          ["library", "SOP library", BookText],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-sm flex items-center gap-2 transition-all",
              tab === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && <ComplianceTab violations={violations} summary={summary} />}
      {tab === "escalations" && (
        <EscalationsTab invoices={invoices} escalations={escalations} purchaseOrders={purchaseOrders} pvrs={pvrs} />
      )}
      {tab === "library" && <LibraryTab />}

      <GuidedTour steps={TOUR_STEPS} open={tourOpen} onClose={closeTour} />
    </div>
  );
}

/** Demo workspace controls — platform admins only. */
function DemoControls() {
  const companies = useCompanies();
  const hasDemo = companies.some((c) => c.isDemo);
  const [busy, setBusy] = useState<"seed" | "remove" | null>(null);

  const run = async (mode: "seed" | "remove") => {
    setBusy(mode);
    try {
      if (mode === "seed") {
        const res = await seedDemoWorkspace();
        toast.success(`Demo workspace ready — ${res.invoices} sample invoices loaded.`);
      } else {
        await removeDemoWorkspace();
        toast.success("Demo workspace removed.");
      }
      // The workspace list and all stores hydrate at bootstrap, so reload once.
      window.setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div data-tour="demo" className="flex items-center gap-2">
      <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("seed")}>
        {busy === "seed" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5 mr-1.5" />}
        {hasDemo ? "Reload demo data" : "Load demo data"}
      </Button>
      {hasDemo && (
        <Button variant="ghost" size="sm" disabled={busy !== null} onClick={() => run("remove")}>
          {busy === "remove" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
          Remove demo
        </Button>
      )}
    </div>
  );
}

/** Thin wrapper so legacy call sites keep working on the shared dashboard card. */
function Kpi({ label, value, accent }: { label: string; value: string; accent?: string; mono?: boolean }) {
  const tone = accent?.includes("destructive") ? "danger" : accent?.includes("success") ? "success" : accent?.includes("warn") || accent?.includes("amber") ? "warning" : "default";
  return <KpiCard label={label} value={value} tone={tone} />;
}

/* ─── Compliance tab ────────────────────────────────────────────────── */

/** Route + highlight target for the record a violation belongs to. */
function docTarget(v: Violation): { to: string; label: string } | null {
  if (v.entity === "invoice") return { to: "/invoices", label: "Open invoice" };
  if (v.entity === "purchase_order") return { to: "/purchase-orders", label: "Open purchase order" };
  if (v.entity === "expense") return { to: "/expenses", label: "Open expense" };
  return null;
}

function ComplianceTab({ violations, summary }: { violations: Violation[]; summary: WeeklySummary }) {
  const companies = useCompanies();
  const clients = useClients();
  const { ownerName } = useOwnerNames(summary.owners.map((o) => o.ownerId));
  const [severity, setSeverity] = useState<"all" | "critical" | "warning">("all");
  const [rule, setRule] = useState("all");


  const rules = useMemo(() => {
    const m = new Map<string, string>();
    violations.forEach((v) => m.set(v.ruleId, v.ruleLabel));
    return [...m.entries()];
  }, [violations]);

  const list = violations.filter(
    (v) => (severity === "all" || v.severity === severity) && (rule === "all" || v.ruleId === rule),
  );

  const exportAll = () => {
    exportCsvRows(
      `sop-compliance-${format(new Date(), "yyyy-MM-dd")}.csv`,
      ["Severity", "Rule", "Type", "Reference", "Client", "Company", "Amount", "Currency", "Detail"],
      list.map((v) => [
        v.severity,
        v.ruleLabel,
        v.entity,
        v.reference,
        clients.find((c) => c.id === v.clientId)?.name ?? "",
        companies.find((c) => c.id === v.companyId)?.shortName ?? "",
        v.amount ?? "",
        v.currency ?? "",
        v.detail,
      ]),
    );
  };


  return (
    <div className="space-y-4">
      <WeeklySummaryCard summary={summary} ownerName={(id) => (id === "unassigned" ? "Unassigned" : ownerName(id))} />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
          <SelectTrigger className="w-40" aria-label="Filter by severity"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical only</SelectItem>
            <SelectItem value="warning">Warnings only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={rule} onValueChange={setRule}>
          <SelectTrigger className="w-64" aria-label="Filter by rule"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All rules</SelectItem>
            {rules.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={exportAll} disabled={list.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-success/30 bg-success/5 p-10 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto text-success" />
          <div className="mt-3 font-display text-lg font-semibold">All checks pass</div>
          <p className="text-sm text-muted-foreground mt-1">No SOP violations in the current workspace.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-2">Rule</div>
            <div className="col-span-2">Reference</div>
            <div className="col-span-2">Client</div>
            <div className="col-span-1">Company</div>
            <div className="col-span-3">Detail</div>
            <div className="col-span-1 text-right">Exposure</div>
            <div className="col-span-1 text-right">Severity</div>
          </div>
          {list.map((v, idx) => {
            const target = docTarget(v);
            const client = clients.find((c) => c.id === v.clientId);
            return (
              <div key={`${v.ruleId}-${v.entityId}-${idx}`} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated/60 transition">
                <div className="col-span-2 text-sm font-medium truncate">{v.ruleLabel}</div>
                <div className="col-span-2 text-sm font-tnum truncate">
                  {target ? (
                    <Link
                      to={target.to}
                      search={{ focus: v.entityId }}
                      title={`${target.label} ${v.reference}`}
                      className="text-primary hover:underline underline-offset-2 inline-flex items-center gap-1"
                    >
                      {v.reference}
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                    </Link>
                  ) : (
                    v.reference
                  )}
                </div>
                <div className="col-span-2 text-sm truncate">
                  {client ? (
                    <Link
                      to="/clients"
                      search={{ focus: client.id }}
                      title={`Open ${client.name}`}
                      className="text-primary hover:underline underline-offset-2"
                    >
                      {client.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-1 text-[11px] font-mono text-muted-foreground truncate">
                  {companies.find((c) => c.id === v.companyId)?.shortName ?? "—"}
                </div>
                <div className="col-span-3 text-xs text-muted-foreground">{v.detail}</div>
                <div className="col-span-1 text-right text-sm font-tnum">
                  {v.amount != null && v.currency ? fmtAmount(v.amount, v.currency as never) : "—"}
                </div>
                <div className="col-span-1 flex justify-end">
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider border inline-flex items-center gap-1",
                    v.severity === "critical"
                      ? "border-destructive/40 text-destructive bg-destructive/10"
                      : "border-warning/40 text-warning bg-warning/10",
                  )}>
                    <AlertTriangle className="h-3 w-3" />
                    {v.severity}
                  </span>
                </div>
              </div>
            );
          })}

        </div>
      )}
    </div>
  );
}

/* ─── AR escalations tab ────────────────────────────────────────────── */

function EscalationsTab({
  invoices, escalations, purchaseOrders, pvrs,
}: {
  invoices: Invoice[];
  escalations: InvoiceEscalation[];
  purchaseOrders: PurchaseOrder[];
  pvrs: PvrRecord[];
}) {
  const clients = useClients();
  const companies = useCompanies();
  const { profile } = useAuth() as { profile?: { displayName?: string } | null };
  const [logging, setLogging] = useState<{ invoice: Invoice; stage: number; existing?: InvoiceEscalation } | null>(null);
  const [drafting, setDrafting] = useState<{ invoice: Invoice; stage: number } | null>(null);

  const rows = useMemo(() => {
    return invoices
      .filter((i) => i.status !== "cancelled" && i.status !== "draft" && i.amount - i.paid > 0.5)
      .map((i) => {
        // Green comes from the saved "done" timestamp: keep the latest log per stage.
        const done = new Map<number, InvoiceEscalation>();
        for (const e of escalations) {
          if (e.invoiceId !== i.id || !e.performedAt) continue;
          const prev = done.get(e.stage);
          if (!prev || e.performedAt > prev.performedAt) done.set(e.stage, e);
        }
        const lastAt = [...done.values()].reduce<string | null>(
          (acc, e) => (!acc || e.performedAt > acc ? e.performedAt : acc),
          null,
        );
        return { inv: i, days: agingDays(i), stage: dueStage(i), done, lastAt };
      })
      .filter((r) => r.stage > 0)
      .sort((a, b) => b.days - a.days);
  }, [invoices, escalations]);

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-10 text-center text-sm text-muted-foreground">
          No open invoice has reached day 15 yet.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
            <div className="col-span-2">Invoice</div>
            <div className="col-span-3">Client</div>
            <div className="col-span-2 text-right">Balance</div>
            <div className="col-span-1 text-right">Age</div>
            <div className="col-span-4">Ladder</div>
          </div>
          {rows.map(({ inv, days, stage, done, lastAt }) => {
            const client = clients.find((c) => c.id === inv.clientId);
            return (
            <div key={inv.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated/60 transition">
              <div className="col-span-2 text-sm font-tnum truncate">
                <Link to="/invoices" search={{ focus: inv.id }} title={`Open invoice ${inv.number}`} className="text-primary hover:underline underline-offset-2 inline-flex items-center gap-1">
                  {inv.number}
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </Link>
              </div>
              <div className="col-span-3 text-sm truncate">
                {client ? (
                  <Link to="/clients" search={{ focus: client.id }} title={`Open ${client.name}`} className="text-primary hover:underline underline-offset-2">
                    {client.name}
                  </Link>
                ) : "—"}
              </div>
              <div className="col-span-2 text-right text-sm font-tnum">{fmtAmount(inv.amount - inv.paid, inv.currency)}</div>
              <div className={cn("col-span-1 text-right text-sm font-tnum", days >= 60 ? "text-destructive" : days >= 30 ? "text-warning" : "")}>
                {days}d
                {lastAt && (
                  <div className="text-[10px] text-muted-foreground font-normal">{format(parseISO(lastAt), "MMM d")}</div>
                )}
              </div>
              <div className="col-span-4 flex flex-wrap gap-1">
                {ESCALATION_STAGES.map((s) => {
                  const entry = done.get(s);
                  const isDone = !!entry;
                  const isDue = s <= stage;
                  return (
                    <button
                      key={s}
                      disabled={!isDone && !isDue}
                      onClick={() => setLogging({ invoice: inv, stage: s, existing: entry })}
                      title={
                        entry
                          ? `Done ${format(parseISO(entry.performedAt), "MMM d, yyyy")}${entry.performedByName ? ` · ${entry.performedByName}` : ""} — click to review`
                          : isDue ? `Log day ${s} action` : `Due at day ${s}`
                      }
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded border uppercase tracking-wider transition-all inline-flex items-center gap-1",
                        isDone && "border-success/40 text-success bg-success/10 hover:bg-success/20 press-scale",
                        !isDone && isDue && "border-destructive/40 text-destructive bg-destructive/10 hover:bg-destructive/20 press-scale",
                        !isDone && !isDue && "border-border text-muted-foreground opacity-60",
                      )}
                    >
                      {isDone && <CheckCircle2 className="h-3 w-3" aria-hidden />}
                      D{s}
                    </button>
                  );
                })}

                {stage >= 30 && (
                  <button
                    onClick={() => setDrafting({ invoice: inv, stage })}
                    title={`Draft the day ${stage} follow-up message`}
                    className="text-[10px] px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/10 hover:bg-primary/20 uppercase tracking-wider transition-all press-scale inline-flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" /> Draft
                  </button>
                )}
              </div>
            </div>
            );
          })}

        </div>
      )}

      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <div className="px-4 py-2.5 text-sm font-medium border-b border-border">Logged actions</div>
        {escalations.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">Nothing logged yet.</div>
        ) : (
          [...escalations]
            .sort((a, b) => b.performedAt.localeCompare(a.performedAt))
            .slice(0, 40)
            .map((e) => (
              <div key={e.id} className="px-4 py-2.5 border-b border-border/40 last:border-0 flex items-start gap-3">
                <span className="text-[10px] px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/10 uppercase tracking-wider shrink-0">D{e.stage}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    {invoices.find((i) => i.id === e.invoiceId)?.number ?? "—"} — {e.action}
                  </div>
                  {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                </div>
                <div className="text-[11px] text-muted-foreground shrink-0">
                  {format(parseISO(e.performedAt), "MMM d, yyyy")}
                  {e.performedByName ? ` · ${e.performedByName}` : ""}
                </div>
              </div>
            ))
        )}
      </div>

      <LogEscalationDialog target={logging} onClose={() => setLogging(null)} />
      <FollowUpDraftDialog
        target={drafting}
        onClose={() => setDrafting(null)}
        clients={clients}
        companies={companies}
        purchaseOrders={purchaseOrders}
        pvrs={pvrs}
        senderName={profile?.displayName}
      />
    </div>
  );
}

function LogEscalationDialog({
  target, onClose,
}: {
  target: { invoice: Invoice; stage: number; existing?: InvoiceEscalation } | null;
  onClose: () => void;
}) {
  const { user, profile } = useAuth() as { user?: { id?: string } | null; profile?: { displayName?: string; display_name?: string } | null };
  const [action, setAction] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stage = target?.stage ?? 0;
  const preset = STAGE_ACTIONS[stage] ?? "";
  const existing = target?.existing;

  // Load the saved values whenever a different step is opened.
  useEffect(() => {
    setAction(existing?.action ?? "");
    setNotes(existing?.notes ?? "");
    setError(null);
  }, [existing?.id, target?.invoice.id, stage]);

  const submit = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    const record: InvoiceEscalation = {
      id: existing?.id ?? newId("esc"),
      companyId: target.invoice.companyId,
      invoiceId: target.invoice.id,
      stage: target.stage,
      action: action.trim() || preset,
      notes: notes.trim() || undefined,
      performedAt: existing?.performedAt ?? new Date().toISOString(),
      performedBy: existing?.performedBy ?? user?.id,
      performedByName: existing?.performedByName ?? profile?.displayName ?? profile?.display_name ?? undefined,
    };
    const res = await saveInvoiceEscalation(record);
    setSaving(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    const saved = { ...record, id: res.id };
    if (existing) invoiceEscalationsStore.update(existing.id, saved);
    else invoiceEscalationsStore.add(saved);
    toast.success(`Day ${target.stage} action recorded.`);
    onClose();
  };

  const removeEntry = () => {
    if (!existing) return;
    invoiceEscalationsStore.remove(existing.id);
    toast.success(`Day ${stage} action removed.`);
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Day" : "Log day"} {stage} action — {target?.invoice.number}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {existing && (
            <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" aria-hidden />
              Done {format(parseISO(existing.performedAt), "MMM d, yyyy 'at' HH:mm")}
              {existing.performedByName ? ` · ${existing.performedByName}` : ""}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="esc-action">Action taken</Label>
            <Input id="esc-action" value={action} onChange={(e) => setAction(e.target.value)} placeholder={preset} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="esc-notes">Notes</Label>
            <Textarea id="esc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Who was contacted, response received, next step…" />
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
        <DialogFooter>
          {existing && (
            <Button variant="ghost" className="text-destructive mr-auto" onClick={removeEntry}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {existing ? "Save changes" : "Log action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


/* ─── SOP library tab ───────────────────────────────────────────────── */

function LibraryTab() {
  const [openId, setOpenId] = useState(SOPS[0]?.id ?? "");
  const doc = SOPS.find((s) => s.id === openId) ?? SOPS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden h-fit">
        {SOPS.map((s) => (
          <button
            key={s.id}
            onClick={() => setOpenId(s.id)}
            className={cn(
              "w-full text-left px-4 py-3 border-b border-border/40 last:border-0 transition-colors",
              s.id === openId ? "bg-primary/10" : "hover:bg-surface-elevated/60",
            )}
          >
            <div className="text-[10px] font-mono text-muted-foreground">{s.code}</div>
            <div className="text-sm font-medium">{s.title}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">v{s.version} · {s.effectiveDate}</div>
          </button>
        ))}
      </div>
      {doc && <SopBody doc={doc} />}
    </div>
  );
}

function SopBody({ doc }: { doc: SopDoc }) {
  return (
    <article className="rounded-xl border border-border bg-[var(--gradient-surface)] p-6 space-y-5">
      <header className="space-y-2 pb-4 border-b border-border/60">
        <div className="text-[11px] font-mono text-muted-foreground">{doc.code} · v{doc.version} · effective {doc.effectiveDate}</div>
        <h2 className="font-display text-2xl font-bold tracking-tight">{doc.title}</h2>
        <div className="text-sm text-muted-foreground">Owner: {doc.owner}</div>
      </header>
      <section className="space-y-1">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Purpose</h3>
        <p className="text-sm leading-relaxed">{doc.purpose}</p>
      </section>
      <section className="space-y-1">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground">Scope</h3>
        <p className="text-sm leading-relaxed">{doc.scope}</p>
      </section>
      {doc.sections.map((s) => (
        <section key={s.heading} className="space-y-2">
          <h3 className="font-display text-base font-semibold">{s.heading}</h3>
          <div className="space-y-1.5">
            {s.body.map((line, i) =>
              line.startsWith("- ") ? (
                <div key={i} className="flex gap-2 text-sm leading-relaxed">
                  <span className="text-primary mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" aria-hidden />
                  <span>{line.slice(2)}</span>
                </div>
              ) : (
                <p key={i} className="text-sm leading-relaxed text-muted-foreground">{line}</p>
              ),
            )}
          </div>
        </section>
      ))}
    </article>
  );
}
