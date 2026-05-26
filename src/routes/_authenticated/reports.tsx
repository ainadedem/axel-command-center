import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useTransactions, useCompanies, toMGA, fmtCompact } from "@/lib/mock-data";
import { useCompany, inScope } from "@/lib/company-context";
import { PeriodPicker, defaultPeriod, type Period } from "@/components/period-picker";
import { exportCsvRows } from "@/lib/export-csv";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { parseISO } from "date-fns";
import { useState, useMemo } from "react";
import { Download, TrendingUp, TrendingDown, Minus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  return (
    <AppShell>
      <PageHeader title="Reports" description="P&L consolidé par société — toutes devises, équivalent MGA." />
      <Body />
    </AppShell>
  );
}

function inPeriod(date: string, p: Period) {
  const d = parseISO(date);
  return d >= p.from && d <= p.to;
}

function priorPeriod(p: Period): Period {
  const duration = p.to.getTime() - p.from.getTime();
  return {
    from: new Date(p.from.getTime() - duration - 1),
    to: new Date(p.from.getTime() - 1),
    label: "Période précédente",
  };
}

const pct = (cur: number, prev: number) => {
  if (prev === 0) return cur === 0 ? 0 : cur > 0 ? 100 : -100;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

function Body() {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const { scope } = useCompany();
  const allTx = useTransactions();
  const companies = useCompanies();

  const tx = inScope(allTx, scope);
  const prior = priorPeriod(period);

  const periodTx = useMemo(() => tx.filter((t) => inPeriod(t.date, period)), [tx, period]);
  const priorTx = useMemo(() => tx.filter((t) => inPeriod(t.date, prior)), [tx, prior]);

  const totalInc = periodTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const totalExp = periodTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const totalProfit = totalInc - totalExp;

  const prevInc = priorTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const prevExp = priorTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const prevProfit = prevInc - prevExp;

  const chartData = useMemo(() =>
    companies.map((c) => {
      const ctx = periodTx.filter((t) => t.companyId === c.id);
      const inc = ctx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0) / 1_000_000;
      const exp = ctx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0) / 1_000_000;
      return { name: c.shortName, Revenus: +inc.toFixed(1), Charges: +exp.toFixed(1), Résultat: +(inc - exp).toFixed(1) };
    }), [companies, periodTx]);

  const handleExport = () => {
    exportCsvRows(
      `rapport-pl-${period.label.replace(/\s/g, "-")}.csv`,
      ["Société", "Revenus (M MGA)", "Charges (M MGA)", "Résultat (M MGA)"],
      chartData.map((r) => [r.name, r.Revenus, r.Charges, r.Résultat]),
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PeriodPicker value={period} onChange={setPeriod} />
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-surface hover:bg-surface-elevated text-sm transition"
        >
          <Download className="h-4 w-4" /> Exporter CSV
        </button>
      </div>

      {/* KPI cards with period comparison */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard
          label={`Revenus · ${period.label}`}
          value={fmtCompact(totalInc, "MGA")}
          prev={prevInc}
          cur={totalInc}
          tone="success"
        />
        <KpiCard
          label={`Charges · ${period.label}`}
          value={fmtCompact(totalExp, "MGA")}
          prev={prevExp}
          cur={totalExp}
          tone="destructive"
          invertTrend
        />
        <KpiCard
          label={`Résultat net · ${period.label}`}
          value={fmtCompact(totalProfit, "MGA")}
          prev={prevProfit}
          cur={totalProfit}
          tone={totalProfit >= 0 ? "success" : "destructive"}
        />
      </div>

      {/* P&L by company */}
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">P&L · par société</div>
            <div className="font-display text-lg font-semibold mt-1">{period.label} (M MGA)</div>
          </div>
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }}
                formatter={(v) => `${Number(v).toFixed(1)} M MGA`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Revenus" radius={[6, 6, 0, 0]} fill="oklch(0.78 0.14 165)" />
              <Bar dataKey="Charges" radius={[6, 6, 0, 0]} fill="oklch(0.68 0.19 22)" />
              <Bar dataKey="Résultat" radius={[6, 6, 0, 0]} fill="oklch(0.72 0.13 220)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail table */}
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-border text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Détail par société · {period.label}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-5 py-2">Société</th>
              <th className="text-right font-medium px-5 py-2 w-36">Revenus</th>
              <th className="text-right font-medium px-5 py-2 w-36">Charges</th>
              <th className="text-right font-medium px-5 py-2 w-36">Résultat</th>
              <th className="text-right font-medium px-5 py-2 w-24">Marge</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((r) => {
              const margin = r.Revenus > 0 ? ((r.Résultat / r.Revenus) * 100).toFixed(1) : "—";
              return (
                <tr key={r.name} className="border-b border-border/30 last:border-0">
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 text-right font-tnum text-success">{r.Revenus.toFixed(1)} M</td>
                  <td className="px-5 py-3 text-right font-tnum text-destructive">{r.Charges.toFixed(1)} M</td>
                  <td className={`px-5 py-3 text-right font-tnum font-semibold ${r.Résultat >= 0 ? "text-success" : "text-destructive"}`}>
                    {r.Résultat.toFixed(1)} M
                  </td>
                  <td className={`px-5 py-3 text-right font-tnum text-xs ${r.Résultat >= 0 ? "text-success" : "text-destructive"}`}>
                    {margin !== "—" ? `${margin}%` : "—"}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-surface-elevated/40 font-semibold border-t border-border">
              <td className="px-5 py-3 text-xs uppercase tracking-wider">Total groupe</td>
              <td className="px-5 py-3 text-right font-tnum text-success">{(totalInc / 1_000_000).toFixed(1)} M</td>
              <td className="px-5 py-3 text-right font-tnum text-destructive">{(totalExp / 1_000_000).toFixed(1)} M</td>
              <td className={`px-5 py-3 text-right font-tnum ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                {(totalProfit / 1_000_000).toFixed(1)} M
              </td>
              <td className={`px-5 py-3 text-right font-tnum text-xs ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>
                {totalInc > 0 ? `${((totalProfit / totalInc) * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TrendBadge({ cur, prev, invertTrend }: { cur: number; prev: number; invertTrend?: boolean }) {
  if (prev === 0) return null;
  const delta = pct(cur, prev);
  const positive = invertTrend ? delta <= 0 : delta >= 0;
  const Icon = Math.abs(delta) < 0.1 ? Minus : positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${positive ? "text-success" : "text-destructive"}`}>
      <Icon className="h-3 w-3" />
      {delta >= 0 ? "+" : ""}{delta.toFixed(1)}% vs période préc.
    </span>
  );
}

function KpiCard({ label, value, cur, prev, tone, invertTrend }: {
  label: string; value: string; cur: number; prev: number;
  tone?: "success" | "destructive"; invertTrend?: boolean;
}) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 space-y-1">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold font-tnum ${toneClass}`}>{value}</div>
      <TrendBadge cur={cur} prev={prev} invertTrend={invertTrend} />
    </div>
  );
}
