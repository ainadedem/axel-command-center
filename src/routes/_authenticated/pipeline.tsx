import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useOpportunities, useCompanies, opportunitiesStore,
  stages, fmtCompact, toMGA, stageProbability,
  type Stage, type Opportunity, type Currency,
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

/* ─── Stage visual system ─────────────────────────────────────────── */

type StageStyle = {
  /** Tailwind utility classes for full color block (header strip). */
  bar: string;
  /** Border accent for cards. */
  ring: string;
  /** Soft tinted background. */
  tint: string;
  /** Foreground/text accent. */
  text: string;
  /** Pill/badge classes. */
  pill: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STAGE_STYLES: Record<Stage, StageStyle> = {
  Lead:        { bar: "bg-slate-400",     ring: "border-l-slate-400",   tint: "bg-slate-400/5",   text: "text-slate-400",   pill: "bg-slate-400/10 text-slate-300 border border-slate-400/20",    icon: Clock },
  Qualified:   { bar: "bg-sky-500",       ring: "border-l-sky-500",     tint: "bg-sky-500/5",     text: "text-sky-400",     pill: "bg-sky-500/10 text-sky-300 border border-sky-500/20",          icon: CheckCircle2 },
  Proposal:    { bar: "bg-violet-500",    ring: "border-l-violet-500",  tint: "bg-violet-500/5",  text: "text-violet-400",  pill: "bg-violet-500/10 text-violet-300 border border-violet-500/20", icon: Pencil },
  Negotiation: { bar: "bg-amber-500",     ring: "border-l-amber-500",   tint: "bg-amber-500/5",   text: "text-amber-400",   pill: "bg-amber-500/10 text-amber-300 border border-amber-500/20",    icon: Flame },
  Won:         { bar: "bg-emerald-500",   ring: "border-l-emerald-500", tint: "bg-emerald-500/5", text: "text-emerald-400", pill: "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20", icon: CheckCircle2 },
  Lost:        { bar: "bg-rose-500",      ring: "border-l-rose-500",    tint: "bg-rose-500/5",    text: "text-rose-400",    pill: "bg-rose-500/10 text-rose-300 border border-rose-500/20",       icon: XCircle },
};

function urgencyOf(o: Opportunity): { label: string; cls: string } | null {
  if (o.stage === "Won" || o.stage === "Lost") return null;
  const days = differenceInDays(parseISO(o.expectedClose), new Date());
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, cls: "text-rose-400 bg-rose-500/10" };
  if (days <= 7) return { label: `${days}d left`, cls: "text-amber-400 bg-amber-500/10" };
  if (days <= 30) return { label: `${days}d`, cls: "text-sky-400 bg-sky-500/10" };
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

function Body() {
  const { scope } = useCompany();
  const opportunities = useOpportunities();
  const companies = useCompanies();
  const list = inScope(opportunities, scope);
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Pipeline" value={fmtCompact(total, "MGA")} accent="bg-primary" highlight />
            <Stat label="Weighted" value={fmtCompact(weighted, "MGA")} accent="bg-violet-500" />
            <Stat label="Won" value={fmtCompact(won, "MGA")} accent="bg-emerald-500" />
            <Stat label="Lost" value={fmtCompact(lost, "MGA")} accent="bg-rose-500" />
            <Stat label="Win rate" value={`${winRate}%`} accent="bg-amber-500" />
          </div>

          {/* Stage distribution bar */}
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
              <KanbanView list={list} companies={companies} onEdit={onEdit} />
            </TabsContent>
            <TabsContent value="list" className="mt-4">
              <ListView list={list} onEdit={onEdit} />
            </TabsContent>
            <TabsContent value="acquisition" className="mt-4">
              <PeopleView list={list} onEdit={onEdit} role="acquisition" />
            </TabsContent>
            <TabsContent value="closer" className="mt-4">
              <PeopleView list={list} onEdit={onEdit} role="closer" />
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
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Stage distribution</div>
        <div className="text-[11px] text-muted-foreground font-tnum">{fmtCompact(grand, "MGA")}</div>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface">
        {totals.map((t) => (
          <div key={t.stage} className={`${STAGE_STYLES[t.stage].bar} transition-all`} style={{ width: `${(t.value / grand) * 100}%` }} title={`${t.stage} · ${fmtCompact(t.value, "MGA")}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {totals.map((t) => (
          <div key={t.stage} className="flex items-center gap-2 text-xs">
            <span className={`h-2 w-2 rounded-full ${STAGE_STYLES[t.stage].bar}`} />
            <span className="text-muted-foreground">{t.stage}</span>
            <span className="font-tnum">{t.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Kanban view ─────────────────────────────────────────────────── */

function KanbanView({ list, companies, onEdit }: { list: Opportunity[]; companies: ReturnType<typeof useCompanies>; onEdit: (o: Opportunity) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
      {stages.map((s) => {
        const st = STAGE_STYLES[s];
        const col = list.filter((o) => o.stage === s);
        const sum = col.reduce((acc, o) => acc + toMGA(o.value, o.currency), 0);
        const Icon = st.icon;
        return (
          <div key={s} className={`rounded-xl border border-border ${st.tint} overflow-hidden min-h-[280px] flex flex-col`}>
            <div className={`${st.bar} h-1`} />
            <div className="p-3 flex flex-col gap-3 flex-1">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 ${st.text}`} />
                  <div>
                    <div className="text-xs font-semibold">{s}</div>
                    <div className="text-[10px] text-muted-foreground font-tnum">{col.length} · {fmtCompact(sum, "MGA")}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-tnum px-1.5 py-0.5 rounded ${st.pill}`}>{Math.round(stageProbability[s] * 100)}%</span>
              </div>
              <div className="space-y-2">
                {col.map((o) => {
                  const co = companies.find((c) => c.id === o.companyId);
                  const u = urgencyOf(o);
                  return (
                    <div key={o.id} className={`rounded-lg bg-surface-elevated border-l-2 ${st.ring} border-y border-r border-border/60 p-3 hover:border-primary/40 transition group`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium leading-snug">{o.name}</div>
                        {co && <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: co.color }} />}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{o.client}</div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                        <div className="font-display font-bold text-sm font-tnum">{fmtCompact(o.value, o.currency)}</div>
                        {u ? (
                          <span className={`text-[10px] font-tnum px-1.5 py-0.5 rounded ${u.cls} inline-flex items-center gap-1`}>
                            {u.label.includes("overdue") && <AlertTriangle className="h-2.5 w-2.5" />}
                            {u.label}
                          </span>
                        ) : (
                          <div className="text-[10px] text-muted-foreground font-tnum">{format(parseISO(o.expectedClose), "MMM d")}</div>
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-2 pt-2 border-t border-border/30">
                        <button onClick={() => onEdit(o)} className="h-6 px-2 text-[10px] rounded hover:bg-surface text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
                        <button onClick={() => confirm(`Delete ${o.name}?`) && opportunitiesStore.remove(o.id)} className="h-6 px-2 text-[10px] rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── List view ───────────────────────────────────────────────────── */

function ListView({ list, onEdit }: { list: Opportunity[]; onEdit: (o: Opportunity) => void }) {
  const sorted = [...list].sort((a, b) => toMGA(b.value, b.currency) - toMGA(a.value, a.currency));
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
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
        const Icon = st.icon;
        return (
          <div key={o.id} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-border/40 last:border-0 border-l-2 ${st.ring} hover:bg-surface-elevated transition cursor-pointer`} onClick={() => onEdit(o)}>
            <div className="col-span-3">
              <div className="text-sm font-medium">{o.name}</div>
              <div className="text-xs text-muted-foreground">{o.client}</div>
            </div>
            <div className="col-span-2">
              <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${st.pill}`}>
                <Icon className="h-3 w-3" /> {o.stage}
              </span>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground truncate">{o.owner || "—"}</div>
            <div className="col-span-1 text-xs text-muted-foreground truncate">{o.closer || "—"}</div>
            <div className="col-span-2 text-right font-tnum text-sm font-semibold">{fmtCompact(o.value, o.currency)}</div>
            <div className="col-span-2 text-right">
              {u ? (
                <span className={`text-[10px] font-tnum px-1.5 py-0.5 rounded ${u.cls}`}>{u.label}</span>
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

function PeopleView({ list, onEdit, role }: { list: Opportunity[]; onEdit: (o: Opportunity) => void; role: "acquisition" | "closer" }) {
  const grouped = useMemo(() => {
    const m = new Map<string, Opportunity[]>();
    list.forEach((o) => {
      const k = (role === "acquisition" ? o.owner : o.closer) || "Unassigned";
      m.set(k, [...(m.get(k) ?? []), o]);
    });
    return Array.from(m.entries()).sort((a, b) => {
      const va = a[1].reduce((s, o) => s + toMGA(o.value, o.currency), 0);
      const vb = b[1].reduce((s, o) => s + toMGA(o.value, o.currency), 0);
      return vb - va;
    });
  }, [list, role]);

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
                return (
                  <button key={o.id} onClick={() => onEdit(o)} className={`w-full flex items-center justify-between gap-2 text-left rounded-md border-l-2 ${st.ring} bg-surface-elevated/60 hover:bg-surface-elevated px-2.5 py-2 transition`}>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{o.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {o.client}
                        {role === "acquisition" && o.closer ? ` · closer: ${o.closer}` : ""}
                        {role === "closer" && o.owner ? ` · acq: ${o.owner}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${st.pill}`}>{o.stage}</span>
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
                  <div key={b.stage} className={`${STAGE_STYLES[b.stage].bar} flex items-center justify-center text-[10px] font-tnum text-white/90`} style={{ width: `${(b.value / total) * 100}%` }} title={`${b.stage} · ${fmtCompact(b.value, "MGA")}`}>
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
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [owner, setOwner] = useState("");
  const [closer, setCloser] = useState("");
  const [stage, setStage] = useState<Stage>("Lead");
  const [value, setValue] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [expectedClose, setExpectedClose] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name); setClient(editing.client);
      setOwner(editing.owner); setCloser(editing.closer ?? "");
      setStage(editing.stage); setValue(String(editing.value)); setCurrency(editing.currency); setExpectedClose(editing.expectedClose);
    } else {
      const c = companies[0]; setCompanyId(c?.id ?? ""); setName(""); setClient("");
      setOwner(""); setCloser("");
      setStage("Lead"); setValue("0"); setCurrency(c?.baseCurrency ?? "EUR"); setExpectedClose(new Date().toISOString().slice(0, 10));
    }
  }, [open, editing, companies]);

  const submit = () => {
    if (!name.trim() || !companyId) return;
    const data = { companyId, name, client, owner, closer: closer.trim() || undefined, stage, value: Number(value) || 0, currency, expectedClose };
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
          <div><Label>Client</Label><Input value={client} onChange={(e) => setClient(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Acquisition (client owner)</Label><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Who brought the client" /></div>
            <div><Label>Closer</Label><Input value={closer} onChange={(e) => setCloser(e.target.value)} placeholder="Who closes the deal" /></div>
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
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
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
