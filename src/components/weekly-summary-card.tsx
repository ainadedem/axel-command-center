import { useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fmtAmount } from "@/lib/mock-data";
import { exportCsvRows } from "@/lib/export-csv";
import type { WeeklySummary } from "@/lib/sop-summary";
import { ArrowDownRight, ArrowUpRight, Download, Minus, Users } from "lucide-react";

interface Props {
  summary: WeeklySummary;
  /** Resolves an invoice creator id to a display name. */
  ownerName: (id: string) => string;
}

function Delta({ value, invert = true }: { value: number; invert?: boolean }) {
  if (value === 0) {
    return <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" /> no change</span>;
  }
  const worse = invert ? value > 0 : value < 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px]", worse ? "text-destructive" : "text-success")}>
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}{value} vs last week
    </span>
  );
}

export function WeeklySummaryCard({ summary, ownerName }: Props) {
  const owners = useMemo(() => summary.owners.slice(0, 6), [summary.owners]);

  const exportSummary = () => {
    const rows: Array<Array<string | number>> = [
      ["Critical flags", summary.critical, `${summary.criticalDelta >= 0 ? "+" : ""}${summary.criticalDelta} vs last week`],
      ["Warning flags", summary.warning, `${summary.warningDelta >= 0 ? "+" : ""}${summary.warningDelta} vs last week`],
      ["Overdue invoices", summary.overdueCount, fmtAmount(summary.overdueExposureMGA, "MGA")],
      ["Ladder steps due this week", summary.stepsDueThisWeek, ""],
      ["Ladder steps logged this week", summary.stepsLoggedThisWeek, ""],
      ...summary.buckets.map((b) => [b.label, b.count, fmtAmount(b.exposureMGA, "MGA")]),
      ...summary.owners.map((o) => [`Owner: ${ownerName(o.ownerId)}`, o.count, fmtAmount(o.exposureMGA, "MGA")]),
    ];
    exportCsvRows(`weekly-compliance-${format(new Date(), "yyyy-MM-dd")}.csv`, ["Metric", "Count", "Detail"], rows);
  };

  return (
    <section
      data-tour="weekly-summary"
      className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 space-y-4"
      aria-label="Weekly compliance summary"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">This week at a glance</h2>
          <p className="text-xs text-muted-foreground">Last 7 days, compared with the week before.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportSummary}>
          <Download className="h-3.5 w-3.5 mr-1.5" /> Export summary
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Red flags" value={summary.critical} tone="destructive" delta={summary.criticalDelta} />
        <Metric label="Yellow flags" value={summary.warning} tone="warning" delta={summary.warningDelta} />
        <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue invoices</div>
          <div className="mt-1 text-xl font-display font-semibold font-tnum">{summary.overdueCount}</div>
          <div className="text-[11px] text-muted-foreground font-tnum">{fmtAmount(summary.overdueExposureMGA, "MGA")} at risk</div>
        </div>
        <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Ladder steps</div>
          <div className="mt-1 text-xl font-display font-semibold font-tnum">
            {summary.stepsLoggedThisWeek}<span className="text-muted-foreground text-sm">/{summary.stepsDueThisWeek}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">logged of those that came due</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">Aging</div>
          {summary.buckets.map((b) => (
            <div key={b.label} className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0">
              <div className="text-sm flex-1">{b.label}</div>
              <div className="text-sm font-tnum">{b.count}</div>
              <div className="text-xs text-muted-foreground font-tnum w-32 text-right">{fmtAmount(b.exposureMGA, "MGA")}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Who needs to act
          </div>
          {owners.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Nothing outstanding — nobody has open items.</div>
          ) : (
            owners.map((o) => (
              <div key={o.ownerId} className="flex items-center gap-3 px-3 py-2 border-b border-border/40 last:border-0">
                <div className="text-sm flex-1 truncate" title={ownerName(o.ownerId)}>{firstName(ownerName(o.ownerId))}</div>
                {o.criticals > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-destructive/40 text-destructive bg-destructive/10 uppercase tracking-wider">
                    {o.criticals} critical
                  </span>
                )}
                <div className="text-sm font-tnum">{o.count}</div>
                <div className="text-xs text-muted-foreground font-tnum w-32 text-right">{fmtAmount(o.exposureMGA, "MGA")}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone, delta }: { label: string; value: number; tone: "destructive" | "warning"; delta: number }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-xl font-display font-semibold font-tnum", value > 0 && (tone === "destructive" ? "text-destructive" : "text-warning"))}>
        {value}
      </div>
      <Delta value={delta} />
    </div>
  );
}
