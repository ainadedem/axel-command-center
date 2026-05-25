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
import { format, parseISO } from "date-fns";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pipeline")({ component: PipelinePage });

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

  const active = list.filter((o) => o.stage !== "Won" && o.stage !== "Lost");
  const total = active.reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const weighted = active.reduce((s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage], 0);
  const won30 = list.filter((o) => o.stage === "Won").reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <div className="p-8 space-y-6">
      <CrudToolbar count={list.length} label="opportunities" onCreate={openCreate} />

      {list.length === 0 ? (
        <EmptyState label="opportunities" onCreate={openCreate} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat label="Total pipeline" value={fmtCompact(total, "MGA")} highlight />
            <Stat label="Weighted forecast" value={fmtCompact(weighted, "MGA")} />
            <Stat label="Won (30d)" value={fmtCompact(won30, "MGA")} good />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            {stages.map((s) => {
              const col = list.filter((o) => o.stage === s);
              const sum = col.reduce((acc, o) => acc + toMGA(o.value, o.currency), 0);
              return (
                <div key={s} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-3 min-h-[280px]">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div>
                      <div className="text-xs font-semibold">{s}</div>
                      <div className="text-[10px] text-muted-foreground font-tnum">{col.length} · {fmtCompact(sum, "MGA")}</div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-tnum">{Math.round(stageProbability[s] * 100)}%</span>
                  </div>
                  <div className="space-y-2">
                    {col.map((o) => {
                      const co = companies.find((c) => c.id === o.companyId);
                      return (
                        <div key={o.id} className="rounded-lg bg-surface-elevated border border-border/60 p-3 hover:border-primary/40 transition group">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-sm font-medium leading-snug">{o.name}</div>
                            {co && <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: co.color }} />}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{o.client}</div>
                          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                            <div className="font-display font-bold text-sm font-tnum">{fmtCompact(o.value, o.currency)}</div>
                            <div className="text-[10px] text-muted-foreground font-tnum">{format(parseISO(o.expectedClose), "MMM d")}</div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 flex gap-1 mt-2 pt-2 border-t border-border/30">
                            <button onClick={() => { setEditing(o); setOpen(true); }} className="h-6 px-2 text-[10px] rounded hover:bg-surface text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
                            <button onClick={() => confirm(`Delete ${o.name}?`) && opportunitiesStore.remove(o.id)} className="h-6 px-2 text-[10px] rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive inline-flex items-center gap-1"><Trash2 className="h-3 w-3" /> Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <OpportunityDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function OpportunityDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Opportunity | null }) {
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [owner, setOwner] = useState("");
  const [stage, setStage] = useState<Stage>("Lead");
  const [value, setValue] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [expectedClose, setExpectedClose] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name); setClient(editing.client); setOwner(editing.owner);
      setStage(editing.stage); setValue(String(editing.value)); setCurrency(editing.currency); setExpectedClose(editing.expectedClose);
    } else {
      const c = companies[0]; setCompanyId(c?.id ?? ""); setName(""); setClient(""); setOwner("");
      setStage("Lead"); setValue("0"); setCurrency(c?.baseCurrency ?? "EUR"); setExpectedClose(new Date().toISOString().slice(0, 10));
    }
  }, [open, editing, companies]);

  const submit = () => {
    if (!name.trim() || !companyId) return;
    const data = { companyId, name, client, owner, stage, value: Number(value) || 0, currency, expectedClose };
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Client</Label><Input value={client} onChange={(e) => setClient(e.target.value)} /></div>
            <div><Label>Owner</Label><Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="M.R." /></div>
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

function Stat({ label, value, highlight, good }: { label: string; value: string; highlight?: boolean; good?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-5 ${highlight ? "bg-gradient-to-br from-surface-elevated to-surface shadow-[var(--shadow-glow)]" : "bg-[var(--gradient-surface)]"}`}>
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-2 font-tnum ${good ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}
