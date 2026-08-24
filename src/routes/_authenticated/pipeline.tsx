import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useOpportunities, useCompanies, useClients, useSalesPeople, opportunitiesStore, clientsStore,
  stages, fmtCompact, toMGA, stageProbability,
  type Stage, type Opportunity, type Currency, type Client,
  contactBelongsTo,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO, differenceInDays } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, AlertTriangle } from "lucide-react";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { KpiCard } from "@/components/kpi-card";
import { useQuotes, useInvoices } from "@/lib/mock-data";
import { buildRollups, type OpportunityRollup } from "@/lib/pipeline-link";
import { OpportunityRevenueDrawer } from "@/components/opportunity-revenue-drawer";
import { buildVariances, hasVariance, type QuoteInvoiceVariance } from "@/lib/quote-invoice-variance";
import { SignedAmount } from "@/components/signed-amount";
import { ConversionGapPanel } from "@/components/conversion-gap-panel";
import { KanbanBoard, type KanbanColumnDef } from "@/components/kanban-board";
import { OpportunityDocChips, type DocSection } from "@/components/opportunity-doc-chips";
import { toast } from "sonner";

const pipelineSearch = (search: Record<string, unknown>): { opp?: string } => ({
  opp: typeof search.opp === "string" && search.opp ? search.opp : undefined,
});

export const Route = createFileRoute("/_authenticated/pipeline")({
  component: PipelinePage,
  validateSearch: pipelineSearch,
});

/* ─── Stage visual system (minimal — just a colored dot) ───────────── */

type StageStyle = { dot: string; text: string };

// Colors mirror Notion "Logia Sales CRM" Status option colors.
const STAGE_STYLES: Record<Stage, StageStyle> = {
  Lead:        { dot: "bg-slate-400",   text: "text-slate-500" },   // gray
  Qualified:   { dot: "bg-orange-500",  text: "text-orange-500" },  // orange
  Proposal:    { dot: "bg-blue-500",    text: "text-blue-500" },    // blue
  Negotiation: { dot: "bg-violet-500",  text: "text-violet-500" },  // purple
  "In progress": { dot: "bg-sky-500",   text: "text-sky-500" },     // blue (distinct from Proposal)
  Closed:      { dot: "bg-emerald-500", text: "text-emerald-500" }, // green
  Lost:        { dot: "bg-rose-500",    text: "text-rose-500" },    // red
};

function urgencyOf(o: Opportunity): { label: string; cls: string } | null {
  if (o.stage === "Closed" || o.stage === "Lost") return null;
  const days = differenceInDays(parseISO(o.expectedClose), new Date());
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: "text-rose-500" };
  if (days <= 7) return { label: `${days}d left`, cls: "text-amber-500" };
  if (days <= 30) return { label: `${days}d`, cls: "text-muted-foreground" };
  return null;
}


function PipelinePage() {
  return (
    <AppShell>
      <PageHeader title="Pipeline" description="Future revenue — by stage, weighted by probability." />
      <Body />
    </AppShell>
  );
}

/** Resolve acquisition person for an opportunity — prefers clientId link, falls back to (companyId, client name). */
function useAcqLookup(clients: Client[]): (o: Opportunity) => string {
  return useMemo(() => {
    const byId = new Map<string, Client>();
    const byName = new Map<string, Client>();
    for (const c of clients) {
      byId.set(c.id, c);
      byName.set(`${c.companyId}::${c.name.toLowerCase()}`, c);
    }
    return (o: Opportunity) => {
      const c = (o.clientId && byId.get(o.clientId)) || byName.get(`${o.companyId}::${(o.client || "").toLowerCase()}`);
      return c?.acquisition ?? "";
    };
  }, [clients]);
}

function Body() {
  const { scope } = useCompany();
  const opportunities = useOpportunities();
  const companies = useCompanies();
  const clients = useClients();
  const list = inScope(opportunities, scope);
  const acqOf = useAcqLookup(clients);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [view, setView] = useState<"kanban" | "list" | "revenue" | "conversion" | "acquisition" | "closer" | "forecast">("kanban");
  const quotes = useQuotes();
  const invoices = useInvoices();
  const rollups = useMemo(() => buildRollups(list, quotes, invoices), [list, quotes, invoices]);
  const variances = useMemo(() => buildVariances(rollups), [rollups]);
  const [drill, setDrill] = useState<Opportunity | null>(null);
  const [drillSection, setDrillSection] = useState<DocSection | null>(null);
  const openDocs = (o: Opportunity, section: DocSection | null = null) => { setDrillSection(section); setDrill(o); };

  // Deep link: ?opp=<id> opens the deal drawer, then clears itself so the
  // drawer isn't forced open on every visit.
  const oppParam = Route.useSearch().opp;
  const navigate = useNavigate();
  useEffect(() => {
    if (!oppParam) return;
    const o = list.find((x) => x.id === oppParam);
    if (!o) return; // not loaded yet, or out of company scope
    openDocs(o);
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, opp: undefined }), replace: true } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oppParam, list]);

  const active = list.filter((o) => o.stage !== "Closed" && o.stage !== "Lost");
  const total = active.reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const weighted = active.reduce((s, o) => s + toMGA(o.value, o.currency) * (o.probability !== undefined ? o.probability / 100 : stageProbability[o.stage]), 0);
  const won = list.filter((o) => o.stage === "Closed").reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const lost = list.filter((o) => o.stage === "Lost").reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const winRate = (() => {
    const closed = list.filter((o) => o.stage === "Closed" || o.stage === "Lost").length;
    if (!closed) return 0;
    return Math.round((list.filter((o) => o.stage === "Closed").length / closed) * 100);
  })();

  const openCreate = () => { setEditing(null); setOpen(true); };
  const onEdit = (o: Opportunity) => { setEditing(o); setOpen(true); };

  return (
    <div className="p-5 sm:p-10 lg:p-12 space-y-6 sm:space-y-8">
      <CrudToolbar createLabel="New opportunity" count={list.length} label="opportunities" onCreate={openCreate} />

      {list.length === 0 ? (
        <EmptyState label="opportunities" onCreate={openCreate} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Pipeline" value={fmtCompact(total, "MGA")} />
            <Stat label="Weighted" value={fmtCompact(weighted, "MGA")} />
            <Stat label="Closed" value={fmtCompact(won, "MGA")} />
            <Stat label="Lost" value={fmtCompact(lost, "MGA")} />
            <Stat label="Win rate" value={`${winRate}%`} />
          </div>

          <StageDistribution list={list} />


          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="conversion">Conversion</TabsTrigger>
              <TabsTrigger value="acquisition">By acquisition</TabsTrigger>
              <TabsTrigger value="closer">By closer</TabsTrigger>
              <TabsTrigger value="forecast">Forecast</TabsTrigger>
            </TabsList>

            <TabsContent value="kanban" className="mt-4">
              <KanbanView list={list} companies={companies} onEdit={onEdit} acqOf={acqOf} rollups={rollups} onDocs={openDocs} />
            </TabsContent>
            <TabsContent value="list" className="mt-4">
              <ListView list={list} onEdit={onEdit} acqOf={acqOf} rollups={rollups} onDocs={openDocs} />
            </TabsContent>
            <TabsContent value="revenue" className="mt-4">
              <RevenueView list={list} rollups={rollups} variances={variances} onDrill={(o) => openDocs(o)} />
            </TabsContent>
            <TabsContent value="conversion" className="mt-4">
              <ConversionGapPanel />
            </TabsContent>
            <TabsContent value="acquisition" className="mt-4">
              <PeopleView list={list} onEdit={onEdit} role="acquisition" acqOf={acqOf} rollups={rollups} onDocs={openDocs} />
            </TabsContent>
            <TabsContent value="closer" className="mt-4">
              <PeopleView list={list} onEdit={onEdit} role="closer" acqOf={acqOf} rollups={rollups} onDocs={openDocs} />
            </TabsContent>
            <TabsContent value="forecast" className="mt-4">
              <ForecastView list={list} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <OpportunityRevenueDrawer
        opportunity={drill}
        rollup={drill ? rollups.get(drill.id) ?? null : null}
        variance={drill ? variances.get(drill.id) ?? null : null}
        initialSection={drillSection}
        open={!!drill}
        onOpenChange={(v) => { if (!v) { setDrill(null); setDrillSection(null); } }}
      />
      <OpportunityDialog open={open} onOpenChange={setOpen} editing={editing} rollup={editing ? rollups.get(editing.id) : undefined} />
    </div>
  );
}

/* ─── Revenue view: quoted → invoiced → collected per deal ─────────── */

function RevenueView({ list, rollups, variances, onDrill }: {
  list: Opportunity[];
  rollups: Map<string, OpportunityRollup>;
  variances: Map<string, QuoteInvoiceVariance>;
  onDrill: (o: Opportunity) => void;
}) {
  const [onlyVariance, setOnlyVariance] = useState(false);
  const rows = useMemo(() => {
    return list
      .map((o) => ({ o, r: rollups.get(o.id), v: variances.get(o.id) }))
      .filter((x): x is { o: Opportunity; r: OpportunityRollup; v: QuoteInvoiceVariance | undefined } => !!x.r)
      .filter((x) => !onlyVariance || (x.v ? hasVariance(x.v) : false))
      .sort((a, b) => (b.r.invoiced || b.r.quoted) - (a.r.invoiced || a.r.quoted));
  }, [list, rollups, variances, onlyVariance]);

  const sum = (pick: (r: OpportunityRollup) => number) => rows.reduce((s, x) => s + pick(x.r), 0);
  const totals = {
    quoted: sum((r) => r.quoted),
    invoiced: sum((r) => r.invoiced),
    collected: sum((r) => r.collected),
    outstanding: sum((r) => r.outstanding),
  };
  const varianceTotal = rows.reduce((s2, x) => s2 + (x.v?.total ?? 0), 0);
  const unlinked = rows.filter((x) => x.r.quotes.length === 0 && x.r.invoices.length === 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Quoted" value={fmtCompact(totals.quoted, "MGA")} />
        <Stat label="Invoiced" value={fmtCompact(totals.invoiced, "MGA")} />
        <Stat label="Collected" value={fmtCompact(totals.collected, "MGA")} />
        <Stat label="Outstanding" value={fmtCompact(totals.outstanding, "MGA")} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Button
          size="sm"
          variant={onlyVariance ? "default" : "outline"}
          onClick={() => setOnlyVariance((x) => !x)}
        >
          {onlyVariance ? "Showing deals with variance" : "Only deals with variance"}
        </Button>
        <div className="text-xs text-muted-foreground">
          Net variance{" "}
          <SignedAmount
            value={varianceTotal}
            formatted={<span className="font-tnum">{varianceTotal > 0 ? "+" : ""}{fmtCompact(varianceTotal, "MGA")}</span>}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">Deal</th>
                <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Stage</th>
                <th className="text-right font-medium px-3 py-2">Value</th>
                <th className="text-right font-medium px-3 py-2">Quoted</th>
                <th className="text-right font-medium px-3 py-2">Invoiced</th>
                <th className="text-right font-medium px-3 py-2">Collected</th>
                <th className="text-right font-medium px-3 py-2 hidden md:table-cell">Outstanding</th>
                <th className="text-right font-medium px-3 py-2">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ o, r, v }) => {
                const value = toMGA(o.value, o.currency);
                const pct = value ? Math.min(100, Math.round((r.invoiced / value) * 100)) : 0;
                return (
                  <tr
                    key={o.id}
                    onClick={() => onDrill(o)}
                    className="border-b border-border last:border-0 hover:bg-surface-elevated cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium truncate max-w-[220px]">{o.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                        {o.client || "—"} · {r.quotes.length} quote{r.quotes.length === 1 ? "" : "s"} · {r.invoices.length} invoice{r.invoices.length === 1 ? "" : "s"}
                      </div>
                      <div className="mt-1 h-1 w-full max-w-[180px] rounded-full bg-surface-elevated overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${STAGE_STYLES[o.stage].dot}`} />
                        <span className="text-muted-foreground">{o.stage}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-tnum">{fmtCompact(value, "MGA")}</td>
                    <td className="px-3 py-2 text-right font-tnum">{fmtCompact(r.quoted, "MGA")}</td>
                    <td className="px-3 py-2 text-right font-tnum">{fmtCompact(r.invoiced, "MGA")}</td>
                    <td className="px-3 py-2 text-right font-tnum text-success">{fmtCompact(r.collected, "MGA")}</td>
                    <td className="px-3 py-2 text-right font-tnum hidden md:table-cell">{fmtCompact(r.outstanding, "MGA")}</td>
                    <td className="px-3 py-2 text-right font-tnum whitespace-nowrap">
                      {v && (v.quoted > 0 || v.invoiced > 0) ? (
                        <span className="inline-flex items-center gap-1.5 justify-end">
                          {(v.missing.length > 0 || v.extra.length > 0) && (
                            <span
                              className="inline-flex items-center rounded-full bg-warning/10 text-warning px-1.5 py-0.5 text-[10px]"
                              title={`${v.missing.length} quoted line(s) not invoiced · ${v.extra.length} unquoted line(s)`}
                            >
                              {v.missing.length + v.extra.length}
                            </span>
                          )}
                          <SignedAmount value={v.total} formatted={`${v.total > 0 ? "+" : ""}${fmtCompact(v.total, "MGA")}`} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {unlinked > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {unlinked} deal{unlinked === 1 ? "" : "s"} have no linked quotation or invoice yet — link them from the document form to track revenue.
        </p>
      )}
    </div>
  );
}

/* ─── Stage distribution band ─────────────────────────────────────── */

function StageDistribution({ list }: { list: Opportunity[] }) {
  const totals = stages.map((s) => ({
    stage: s,
    value: list.filter((o) => o.stage === s).reduce((acc, o) => acc + toMGA(o.value, o.currency), 0),
    count: list.filter((o) => o.stage === s).length,
  }));
  const grand = totals.reduce((s, t) => s + t.value, 0) || 1;
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Stage distribution</div>
        <div className="text-[11px] text-muted-foreground font-tnum">{fmtCompact(grand, "MGA")}</div>
      </div>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        {totals.map((t) => (
          <div key={t.stage} className={`${STAGE_STYLES[t.stage].dot} transition-all`} style={{ width: `${(t.value / grand) * 100}%` }} title={`${t.stage} · ${fmtCompact(t.value, "MGA")}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-4 mt-3">
        {totals.map((t) => (
          <div key={t.stage} className="flex items-center gap-1.5 text-xs">
            <span className={`h-1.5 w-1.5 rounded-full ${STAGE_STYLES[t.stage].dot}`} />
            <span className="text-muted-foreground">{t.stage}</span>
            <span className="font-tnum text-foreground/80">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Kanban view (draggable) ─────────────────────────────────────── */

function KanbanView({ list, companies, onEdit, acqOf, rollups, onDocs }: { list: Opportunity[]; companies: ReturnType<typeof useCompanies>; onEdit: (o: Opportunity) => void; acqOf: (o: Opportunity) => string; rollups: Map<string, OpportunityRollup>; onDocs: (o: Opportunity, section?: DocSection | null) => void }) {
  const columns: KanbanColumnDef[] = stages.map((s) => {
    const col = list.filter((o) => o.stage === s);
    const sum = col.reduce((acc, o) => acc + toMGA(o.value, o.currency), 0);
    return {
      key: s,
      label: s,
      dot: STAGE_STYLES[s].dot,
      meta: `${fmtCompact(sum, "MGA")} · ${Math.round(stageProbability[s] * 100)}%`,
    };
  });

  const moveStage = (o: Opportunity, stage: string) => {
    const previous = o.stage;
    try {
      opportunitiesStore.update(o.id, { stage: stage as Stage });
      toast.success(`${o.name} → ${stage}`, {
        action: {
          label: "Undo",
          onClick: () => opportunitiesStore.update(o.id, { stage: previous }),
        },
      });
    } catch (e) {
      opportunitiesStore.update(o.id, { stage: previous });
      toast.error(`Could not move ${o.name}`, { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <KanbanBoard
      className="xl:grid-cols-4 2xl:grid-cols-7"
      columns={columns}
      items={list}
      idOf={(o) => o.id}
      labelOf={(o) => o.name}
      columnOf={(o) => o.stage}
      onMove={moveStage}
      onCardClick={onEdit}
      renderCard={(o) => {
        const co = companies.find((c) => c.id === o.companyId);
        const u = urgencyOf(o);
        const acq = acqOf(o);
        return (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium leading-snug truncate">{o.name}</div>
              {co && <span className="h-1.5 w-1.5 rounded-full mt-1.5 shrink-0" style={{ background: co.color }} />}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{o.client}</div>
            {(acq || o.closer) && (
              <div className="text-[10px] text-muted-foreground mt-1.5 truncate">
                {acq && <span>A: {acq}</span>}
                {acq && o.closer && <span> · </span>}
                {o.closer && <span>C: {o.closer}</span>}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
              <div className="font-tnum text-sm font-semibold">{fmtCompact(o.value, o.currency)}</div>
              {u ? (
                <span className={`text-[10px] font-tnum inline-flex items-center gap-1 ${u.cls}`}>
                  {u.label.includes("overdue") && <AlertTriangle className="h-2.5 w-2.5" />}
                  {u.label}
                </span>
              ) : (
                <div className="text-[10px] text-muted-foreground font-tnum">{format(parseISO(o.expectedClose), "MMM d")}</div>
              )}
            </div>
            <div className="mt-2">
              <OpportunityDocChips size="xs" rollup={rollups.get(o.id)} onOpen={(section) => onDocs(o, section)} />
            </div>
            <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-2">
              <button onClick={(e) => { e.stopPropagation(); onEdit(o); }} className="h-6 px-2 text-[10px] rounded hover:bg-surface text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
              <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${o.name}?`)) opportunitiesStore.remove(o.id); }} className="h-6 px-2 text-[10px] rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
            </div>
          </>
        );
      }}
    />
  );
}


/* ─── List view ───────────────────────────────────────────────────── */

function ListView({ list, onEdit, acqOf, rollups, onDocs }: { list: Opportunity[]; onEdit: (o: Opportunity) => void; acqOf: (o: Opportunity) => string; rollups: Map<string, OpportunityRollup>; onDocs: (o: Opportunity, section?: DocSection | null) => void }) {
  const sorted = [...list].sort((a, b) => toMGA(b.value, b.currency) - toMGA(a.value, a.currency));
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
        <div className="col-span-3">Opportunity</div>
        <div className="col-span-2">Stage</div>
        <div className="col-span-2">Documents</div>
        <div className="col-span-1">Closer</div>
        <div className="col-span-2 text-right">Value</div>
        <div className="col-span-2 text-right">Close</div>
      </div>
      {sorted.map((o) => {
        const st = STAGE_STYLES[o.stage];
        const u = urgencyOf(o);
        return (
          <div key={o.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-border/40 last:border-0 hover:bg-surface-elevated transition cursor-pointer" onClick={() => onEdit(o)}>
            <div className="col-span-3 min-w-0">
              <div className="text-sm font-medium truncate">{o.name}</div>
              <div className="text-xs text-muted-foreground truncate">{o.client}</div>
            </div>
            <div className="col-span-2">
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                <span className={st.text}>{o.stage}</span>
              </span>
            </div>
            <div className="col-span-2 min-w-0">
              <OpportunityDocChips rollup={rollups.get(o.id)} onOpen={(section) => onDocs(o, section)} showOutstanding={false} />
              <div className="text-[10px] text-muted-foreground truncate mt-0.5">acq: {acqOf(o) || "—"}</div>
            </div>
            <div className="col-span-1 text-xs text-muted-foreground truncate">{o.closer || "—"}</div>
            <div className="col-span-2 text-right font-tnum text-sm font-semibold">{fmtCompact(o.value, o.currency)}</div>
            <div className="col-span-2 text-right">
              {u ? (
                <span className={`text-[11px] font-tnum ${u.cls}`}>{u.label}</span>
              ) : (
                <span className="text-xs text-muted-foreground font-tnum">{format(parseISO(o.expectedClose), "MMM d, yy")}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* ─── People view (by acquisition or closer) ──────────────────────── */

function PeopleView({ list, onEdit, role, acqOf, rollups, onDocs }: { list: Opportunity[]; onEdit: (o: Opportunity) => void; role: "acquisition" | "closer"; acqOf: (o: Opportunity) => string; rollups: Map<string, OpportunityRollup>; onDocs: (o: Opportunity, section?: DocSection | null) => void }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    list.forEach((o) => {
      const k = (role === "acquisition" ? acqOf(o) : o.closer) || "Unassigned";
      m.set(k, [...(m.get(k) ?? []), o]);
    });
    return Array.from(m.entries()).sort((a, b) => {
      const va = a[1].reduce((s, o) => s + toMGA(o.value, o.currency), 0);
      const vb = b[1].reduce((s, o) => s + toMGA(o.value, o.currency), 0);
      return vb - va;
    });
  }, [list, role, acqOf]);

  const roleLabel = role === "acquisition" ? "Acquisition" : "Deal Closer";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {grouped.map(([person, ops]) => {
        const total = ops.reduce((s, o) => s + toMGA(o.value, o.currency), 0);
        const weighted = ops.reduce((s, o) => s + toMGA(o.value, o.currency) * (o.probability !== undefined ? o.probability / 100 : stageProbability[o.stage]), 0);
        const won = ops.filter((o) => o.stage === "Closed").reduce((s, o) => s + toMGA(o.value, o.currency), 0);
        return (
          <div key={person} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{roleLabel}</div>
                <div className="font-semibold text-sm">{person}</div>
                <div className="text-[11px] text-muted-foreground font-tnum mt-0.5">{ops.length} · {fmtCompact(total, "MGA")} · ~{fmtCompact(weighted, "MGA")} · won {fmtCompact(won, "MGA")}</div>
              </div>
            </div>
            <div className="space-y-1.5">
              {ops.map((o) => {
                const st = STAGE_STYLES[o.stage];
                const otherAcq = acqOf(o);
                return (
                  <button key={o.id} onClick={() => onEdit(o)} className="w-full flex items-center justify-between gap-2 text-left rounded-md bg-surface-elevated/60 hover:bg-surface-elevated px-2.5 py-2 transition">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${st.dot}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate">{o.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {o.client}
                          {role === "acquisition" && o.closer ? ` · closer: ${o.closer}` : ""}
                          {role === "closer" && otherAcq ? ` · acq: ${otherAcq}` : ""}
                        </div>
                        <div className="mt-1">
                          <OpportunityDocChips size="xs" rollup={rollups.get(o.id)} onOpen={(section) => onDocs(o, section)} showOutstanding={false} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className={`text-[10px] ${st.text}`}>{o.stage}</span>
                      <span className="font-tnum text-xs mt-0.5">{fmtCompact(o.value, o.currency)}</span>
                    </div>
                  </button>

                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Forecast view ───────────────────────────────────────────────── */

function ForecastView({ list }: { list: Opportunity[] }) {
  const buckets = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    list.filter((o) => o.stage !== "Lost").forEach((o) => {
      const k = format(parseISO(o.expectedClose), "yyyy-MM");
      m.set(k, [...(m.get(k) ?? []), o]);
    });
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [list]);

  const maxVal = Math.max(1, ...buckets.map(([, ops]) => ops.reduce((s, o) => s + toMGA(o.value, o.currency), 0)));

  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 space-y-3">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">Monthly forecast (by expected close)</div>
      {buckets.map(([month, ops]) => {
        const byStage = stages.map((s) => ({
          stage: s,
          value: ops.filter((o) => o.stage === s).reduce((a, o) => a + toMGA(o.value, o.currency), 0),
        }));
        const total = byStage.reduce((s, b) => s + b.value, 0);
        const weighted = ops.reduce((s, o) => s + toMGA(o.value, o.currency) * (o.probability !== undefined ? o.probability / 100 : stageProbability[o.stage]), 0);
        return (
          <div key={month} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="font-medium">{format(parseISO(`${month}-01`), "MMM yyyy")}</div>
              <div className="text-muted-foreground font-tnum">{ops.length} · {fmtCompact(total, "MGA")} · ~{fmtCompact(weighted, "MGA")}</div>
            </div>
            <div className="flex h-6 rounded-md overflow-hidden bg-surface" style={{ width: `${(total / maxVal) * 100}%`, minWidth: "8%" }}>
              {byStage.map((b) =>
                b.value > 0 ? (
                  <div key={b.stage} className={`${STAGE_STYLES[b.stage].dot} flex items-center justify-center text-[10px] font-tnum text-white/90`} style={{ width: `${(b.value / total) * 100}%` }} title={`${b.stage} · ${fmtCompact(b.value, "MGA")}`}>
                    {(b.value / total) > 0.12 ? b.stage[0] : ""}
                  </div>
                ) : null
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Dialog (unchanged) ──────────────────────────────────────────── */

function OpportunityDialog({ open, onOpenChange, editing, rollup }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Opportunity | null; rollup?: OpportunityRollup }) {
  const companies = useCompanies();
  const clients = useClients();
  const closerPeople = useSalesPeople("closer");
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [newLeadName, setNewLeadName] = useState("");
  const [closer, setCloser] = useState("");
  const [stage, setStage] = useState<Stage>("Lead");
  const [value, setValue] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [expectedClose, setExpectedClose] = useState(() => new Date().toISOString().slice(0, 10));
  const [probability, setProbability] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name);
      // Resolve the linked client: prefer clientId, else look up by (companyId, name).
      const linked = editing.clientId
        ? clients.find((c) => c.id === editing.clientId)
        : clients.find((c) => c.companyId === editing.companyId && c.name.toLowerCase() === (editing.client || "").toLowerCase());
      setClientId(linked?.id ?? "");
      setNewLeadName(linked ? "" : (editing.client ?? ""));
      setCloser(editing.closer ?? "");
      setStage(editing.stage); setValue(String(editing.value)); setCurrency(editing.currency); setExpectedClose(editing.expectedClose);
      setProbability(editing.probability !== undefined ? String(editing.probability) : "");
    } else {
      const c = companies[0]; setCompanyId(c?.id ?? ""); setName("");
      setClientId(""); setNewLeadName("");
      setCloser("");
      setStage("Lead"); setValue("0"); setCurrency(c?.baseCurrency ?? "EUR"); setExpectedClose(new Date().toISOString().slice(0, 10)); setProbability("");
    }
    setShowErrors(false);
  }, [open, editing, companies, clients]);

  // Reset client picker when company changes (so we don't keep a client from another company).
  useEffect(() => {
    if (!open || !companyId) return;
    if (clientId) {
      const cl = clients.find((c) => c.id === clientId);
      if (!cl || cl.companyId !== companyId) setClientId("");
    }
  }, [companyId, clientId, clients, open]);

  const companyClients = useMemo(
    () => clients.filter((c) => contactBelongsTo(c, companyId)).sort((a, b) => a.name.localeCompare(b.name)),
    [clients, companyId],
  );
  const selectedClient = clientId ? clients.find((c) => c.id === clientId) : undefined;
  const acqForClient = selectedClient?.acquisition ?? "";

  const closerOptions = useMemo(() => {
    const names = closerPeople.map((p) => p.name);
    if (closer && !names.includes(closer)) names.push(closer);
    return names.sort();
  }, [closerPeople, closer]);

  const submit = () => {
    const missingLinkedLead = !clientId && !newLeadName.trim();
    const invalid = !name.trim() || !companyId || missingLinkedLead;
    if (invalid) {
      setShowErrors(true);
      return;
    }

    // Resolve / create the linked client.
    let linkedClientId = clientId;
    let clientDisplayName = selectedClient?.name ?? "";
    if (!linkedClientId) {
      const trimmed = newLeadName.trim();
      // De-dupe: if a client with this name already exists for the company, reuse it.
      const existing = clients.find(
        (c) => c.companyId === companyId && c.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (existing) {
        linkedClientId = existing.id;
        clientDisplayName = existing.name;
      } else {
        const newId_ = newId("cli");
        const newClient: Client = {
          id: newId_,
          companyId,
          name: trimmed,
          country: "",
          status: stage === "Closed" ? "client" : "lead",
        };
        clientsStore.add(newClient);
        linkedClientId = newId_;
        clientDisplayName = trimmed;
      }
    }

    // If moving to Won, promote the linked client from "lead" to "client".
    if (stage === "Closed" && linkedClientId) {
      const cl = clients.find((c) => c.id === linkedClientId);
      if (cl && cl.status !== "client") {
        clientsStore.update(linkedClientId, {
          status: "client",
          acquiredAt: cl.acquiredAt ?? new Date().toISOString().slice(0, 10),
        });
      }
    }

    const data = {
      companyId, name,
      clientId: linkedClientId,
      client: clientDisplayName,
      closer: closer.trim() || undefined,
      stage, value: Number(value) || 0, currency, expectedClose,
      probability: probability !== "" ? Math.min(100, Math.max(0, Number(probability))) : undefined,
    };
    if (editing) opportunitiesStore.update(editing.id, data);
    else opportunitiesStore.add({ id: newId("opp"), ...data });
    onOpenChange(false);
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit opportunity" : "New opportunity"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <FormErrorBanner show={showErrors} />
          <div>
            <Label><RequiredLabel>Company</RequiredLabel></Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger className={invalidFieldClassName(showErrors && !companyId)} aria-invalid={showErrors && !companyId}><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label><RequiredLabel>Opportunity name</RequiredLabel></Label><Input value={name} onChange={(e) => setName(e.target.value)} className={invalidFieldClassName(showErrors && !name.trim())} aria-invalid={showErrors && !name.trim()} /></div>
          <div>
            <Label><RequiredLabel>Client / lead</RequiredLabel></Label>
            <Select
              value={clientId || "__new__"}
              onValueChange={(v) => setClientId(v === "__new__" ? "" : v)}
              disabled={!companyId}
            >
              <SelectTrigger className={invalidFieldClassName(showErrors && !clientId && !newLeadName.trim())} aria-invalid={showErrors && !clientId && !newLeadName.trim()}>
                <SelectValue placeholder={companyId ? "Select client" : "Select company first"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">＋ New lead…</SelectItem>
                {companyClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.status === "lead" ? "· lead" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!clientId && (
              <div className="mt-2">
                <Input
                  value={newLeadName}
                  onChange={(e) => setNewLeadName(e.target.value)}
                  placeholder="New lead name (will be added to Clients as a lead)"
                />
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Acquisition: <span className="font-medium text-foreground">{acqForClient || "—"}</span>
              {" "}(managed on the <Link to="/clients" className="text-primary underline">Clients</Link> page)
            </p>
          </div>
          <div>
            <Label>Deal Closer</Label>
            {closerOptions.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
                No closers in the sales team yet — <Link to="/sales-team" className="text-primary underline">add one</Link>.
              </div>
            ) : (
              <Select value={closer || "__none__"} onValueChange={(v) => setCloser(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select closer" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {closerOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Sourced from the <Link to="/sales-team" className="text-primary underline">Sales team</Link>.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{stages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Value</Label><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} /></div>
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
          <div><Label>Expected close</Label><Input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} /></div>
          {editing && rollup && (rollup.quotes.length > 0 || rollup.invoices.length > 0) && (
            <div className="rounded-lg border border-border bg-surface-elevated/50 p-3 space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Linked documents</div>
              {rollup.quotes.map((q) => (
                <Link key={q.id} to="/quotations" search={{ focus: q.id }} className="flex items-center justify-between gap-2 text-xs hover:text-primary">
                  <span className="truncate">Quotation {q.number}</span>
                  <span className="font-tnum shrink-0">{fmtCompact(q.amount, q.currency)}</span>
                </Link>
              ))}
              {rollup.invoices.map((i) => (
                <Link key={i.id} to="/invoices" search={{ focus: i.id }} className="flex items-center justify-between gap-2 text-xs hover:text-primary">
                  <span className="truncate">Invoice {i.number}</span>
                  <span className="font-tnum shrink-0">{fmtCompact(i.amount, i.currency)}</span>
                </Link>
              ))}
            </div>
          )}
          <div>
            <Label>Win probability % <span className="ml-1 text-[11px] text-muted-foreground font-normal">(blank = stage default: {Math.round(stageProbability[stage] * 100)}%)</span></Label>
            <Input type="number" min="0" max="100" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder={String(Math.round(stageProbability[stage] * 100))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim() || !companyId || (!clientId && !newLeadName.trim())}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <KpiCard label={label} value={value} />;
}
