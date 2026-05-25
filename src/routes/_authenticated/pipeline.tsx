import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useOpportunities, useCompanies, useClients, useSalesPeople, opportunitiesStore, clientsStore,
  stages, fmtCompact, toMGA, stageProbability,
  type Stage, type Opportunity, type Currency, type Client,
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
import { Pencil, Trash2, Flame, Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pipeline")({ component: PipelinePage });

/* ─── Stage visual system (minimal — just a colored dot) ───────────── */

type StageStyle = { dot: string; text: string };

const STAGE_STYLES: Record<Stage, StageStyle> = {
  Lead:        { dot: "bg-slate-400",   text: "text-slate-500" },
  Qualified:   { dot: "bg-sky-500",     text: "text-sky-600" },
  Proposal:    { dot: "bg-violet-500",  text: "text-violet-500" },
  Negotiation: { dot: "bg-amber-500",   text: "text-amber-500" },
  Won:         { dot: "bg-emerald-500", text: "text-emerald-500" },
  Lost:        { dot: "bg-rose-500",    text: "text-rose-500" },
};

function urgencyOf(o: Opportunity): { label: string; cls: string } | null {
  if (o.stage === "Won" || o.stage === "Lost") return null;
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
  const [view, setView] = useState<"kanban" | "list" | "acquisition" | "closer" | "forecast">("kanban");

  const active = list.filter((o) => o.stage !== "Won" && o.stage !== "Lost");
  const total = active.reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const weighted = active.reduce((s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage], 0);
  const won = list.filter((o) => o.stage === "Won").reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const lost = list.filter((o) => o.stage === "Lost").reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const winRate = (() => {
    const closed = list.filter((o) => o.stage === "Won" || o.stage === "Lost").length;
    if (!closed) return 0;
    return Math.round((list.filter((o) => o.stage === "Won").length / closed) * 100);
  })();

  const openCreate = () => { setEditing(null); setOpen(true); };
  const onEdit = (o: Opportunity) => { setEditing(o); setOpen(true); };

  return (
    <div className="p-8 space-y-6">
      <CrudToolbar count={list.length} label="opportunities" onCreate={openCreate} />

      {list.length === 0 ? (
        <EmptyState label="opportunities" onCreate={openCreate} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Pipeline" value={fmtCompact(total, "MGA")} />
            <Stat label="Weighted" value={fmtCompact(weighted, "MGA")} />
            <Stat label="Won" value={fmtCompact(won, "MGA")} />
            <Stat label="Lost" value={fmtCompact(lost, "MGA")} />
            <Stat label="Win rate" value={`${winRate}%`} />
          </div>

          <StageDistribution list={list} />


          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="acquisition">By acquisition</TabsTrigger>
              <TabsTrigger value="closer">By closer</TabsTrigger>
              <TabsTrigger value="forecast">Forecast</TabsTrigger>
            </TabsList>

            <TabsContent value="kanban" className="mt-4">
              <KanbanView list={list} companies={companies} onEdit={onEdit} acqOf={acqOf} />
            </TabsContent>
            <TabsContent value="list" className="mt-4">
              <ListView list={list} onEdit={onEdit} acqOf={acqOf} />
            </TabsContent>
            <TabsContent value="acquisition" className="mt-4">
              <PeopleView list={list} onEdit={onEdit} role="acquisition" acqOf={acqOf} />
            </TabsContent>
            <TabsContent value="closer" className="mt-4">
              <PeopleView list={list} onEdit={onEdit} role="closer" acqOf={acqOf} />
            </TabsContent>
            <TabsContent value="forecast" className="mt-4">
              <ForecastView list={list} />
            </TabsContent>
          </Tabs>
        </>
      )}

      <OpportunityDialog open={open} onOpenChange={setOpen} editing={editing} />
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

/* ─── Kanban view ─────────────────────────────────────────────────── */

function KanbanView({ list, companies, onEdit, acqOf }: { list: Opportunity[]; companies: ReturnType<typeof useCompanies>; onEdit: (o: Opportunity) => void; acqOf: (o: Opportunity) => string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
      {stages.map((s) => {
        const st = STAGE_STYLES[s];
        const col = list.filter((o) => o.stage === s);
        const sum = col.reduce((acc, o) => acc + toMGA(o.value, o.currency), 0);
        return (
          <div key={s} className="rounded-lg border border-border bg-surface overflow-hidden min-h-[280px] flex flex-col">
            <div className="px-3 py-2.5 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${st.dot}`} />
                <div className="text-xs font-medium truncate">{s}</div>
              </div>
              <div className="text-[10px] text-muted-foreground font-tnum shrink-0">{col.length}</div>
            </div>
            <div className="px-3 py-2 text-[10px] text-muted-foreground font-tnum border-b border-border/50">
              {fmtCompact(sum, "MGA")} · {Math.round(stageProbability[s] * 100)}%
            </div>
            <div className="p-2 space-y-1.5 flex-1">
              {col.map((o) => {
                const co = companies.find((c) => c.id === o.companyId);
                const u = urgencyOf(o);
                const acq = acqOf(o);
                return (
                  <div key={o.id} className="rounded-md bg-surface-elevated border border-border/60 p-2.5 hover:border-border transition group cursor-pointer" onClick={() => onEdit(o)}>
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
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-2">
                      <button onClick={(e) => { e.stopPropagation(); onEdit(o); }} className="h-6 px-2 text-[10px] rounded hover:bg-surface text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${o.name}?`)) opportunitiesStore.remove(o.id); }} className="h-6 px-2 text-[10px] rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── List view ───────────────────────────────────────────────────── */

function ListView({ list, onEdit, acqOf }: { list: Opportunity[]; onEdit: (o: Opportunity) => void; acqOf: (o: Opportunity) => string }) {
  const sorted = [...list].sort((a, b) => toMGA(b.value, b.currency) - toMGA(a.value, a.currency));
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
        <div className="col-span-3">Opportunity</div>
        <div className="col-span-2">Stage</div>
        <div className="col-span-2">Acquisition</div>
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
            <div className="col-span-2 text-xs text-muted-foreground truncate">{acqOf(o) || "—"}</div>
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

function PeopleView({ list, onEdit, role, acqOf }: { list: Opportunity[]; onEdit: (o: Opportunity) => void; role: "acquisition" | "closer"; acqOf: (o: Opportunity) => string }) {
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

  const roleLabel = role === "acquisition" ? "Acquisition" : "Closer";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {grouped.map(([person, ops]) => {
        const total = ops.reduce((s, o) => s + toMGA(o.value, o.currency), 0);
        const weighted = ops.reduce((s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage], 0);
        const won = ops.filter((o) => o.stage === "Won").reduce((s, o) => s + toMGA(o.value, o.currency), 0);
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
        const weighted = ops.reduce((s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage], 0);
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

function OpportunityDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Opportunity | null }) {
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
    } else {
      const c = companies[0]; setCompanyId(c?.id ?? ""); setName("");
      setClientId(""); setNewLeadName("");
      setCloser("");
      setStage("Lead"); setValue("0"); setCurrency(c?.baseCurrency ?? "EUR"); setExpectedClose(new Date().toISOString().slice(0, 10));
    }
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
    () => clients.filter((c) => c.companyId === companyId).sort((a, b) => a.name.localeCompare(b.name)),
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
    if (!name.trim() || !companyId) return;

    // Resolve / create the linked client.
    let linkedClientId = clientId;
    let clientDisplayName = selectedClient?.name ?? "";
    if (!linkedClientId) {
      const trimmed = newLeadName.trim();
      if (!trimmed) return; // require either a picked client or a new lead name
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
          status: stage === "Won" ? "client" : "lead",
        };
        clientsStore.add(newClient);
        linkedClientId = newId_;
        clientDisplayName = trimmed;
      }
    }

    // If moving to Won, promote the linked client from "lead" to "client".
    if (stage === "Won" && linkedClientId) {
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
    };
    if (editing) opportunitiesStore.update(editing.id, data);
    else opportunitiesStore.add({ id: newId("opp"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit opportunity" : "New opportunity"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Opportunity name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div>
            <Label>Client / lead <span className="text-destructive">*</span></Label>
            <Select
              value={clientId || "__new__"}
              onValueChange={(v) => setClientId(v === "__new__" ? "" : v)}
              disabled={!companyId}
            >
              <SelectTrigger>
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
            <Label>Closer</Label>
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
          <div className="grid grid-cols-3 gap-3">
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!name.trim() || !companyId || (!clientId && !newLeadName.trim())}>
            {editing ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight, accent }: { label: string; value: string; highlight?: boolean; accent?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl border border-border p-5 ${highlight ? "bg-gradient-to-br from-surface-elevated to-surface shadow-[var(--shadow-glow)]" : "bg-[var(--gradient-surface)]"}`}>
      {accent && <span className={`absolute left-0 top-0 h-full w-1 ${accent}`} />}
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold mt-2 font-tnum">{value}</div>
    </div>
  );
}
