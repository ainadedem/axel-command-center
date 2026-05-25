import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { opportunities, stages, companies, fmtCompact, toMGA, stageProbability, type Stage } from "@/lib/mock-data";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO } from "date-fns";

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
  const list = inScope(opportunities, scope);
  const active = list.filter(o => o.stage !== "Won" && o.stage !== "Lost");
  const total = active.reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const weighted = active.reduce((s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage], 0);
  const won30 = list.filter(o => o.stage === "Won").reduce((s, o) => s + toMGA(o.value, o.currency), 0);

  const board: Stage[] = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Total pipeline" value={fmtCompact(total, "MGA")} highlight />
        <Stat label="Weighted forecast" value={fmtCompact(weighted, "MGA")} />
        <Stat label="Won (30d)" value={fmtCompact(won30, "MGA")} good />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
        {board.map((s) => {
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
                  const co = companies.find(c => c.id === o.companyId)!;
                  return (
                    <div key={o.id} className="rounded-lg bg-surface-elevated border border-border/60 p-3 hover:border-primary/40 transition cursor-pointer">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium leading-snug">{o.name}</div>
                        <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ background: co.color }} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{o.client}</div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                        <div className="font-display font-bold text-sm font-tnum">{fmtCompact(o.value, o.currency)}</div>
                        <div className="text-[10px] text-muted-foreground font-tnum">{format(parseISO(o.expectedClose), "MMM d")}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
