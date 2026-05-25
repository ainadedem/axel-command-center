import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { useCompany } from "@/lib/company-context";
import {
  useAccounts, useTransactions, useInvoices, useOpportunities, useCompanies,
  toMGA, fmtCompact, stageProbability,
} from "@/lib/mock-data";
import { inScope } from "@/lib/company-context";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, parseISO } from "date-fns";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, AlertOctagon, ShieldCheck, Rocket } from "lucide-react";
import { FX, type Currency } from "@/lib/mock-data";

const pct = (cur: number, prev: number) => {
  if (prev === 0) return cur === 0 ? 0 : cur > 0 ? 100 : -100;
  return ((cur - prev) / Math.abs(prev)) * 100;
};
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;


export const Route = createFileRoute("/_authenticated/")({ component: Dashboard });

function Dashboard() {
  return (
    <AppShell>
      <PageHeader
        title="Financial Command"
        description="Live group view across all companies, currencies and accounts."
      />
      <DashboardBody />
    </AppShell>
  );
}

function DashboardBody() {
  const { scope } = useCompany();

  const acc = inScope(useAccounts(), scope);
  const tx = inScope(useTransactions(), scope);
  const inv = inScope(useInvoices(), scope);
  const opp = inScope(useOpportunities(), scope);
  const companies = useCompanies();

  const cashByCurrency = acc.reduce<Record<string, number>>((m, a) => {
    m[a.currency] = (m[a.currency] ?? 0) + a.balance;
    return m;
  }, {});
  const totalMGA = acc.reduce((s, a) => s + toMGA(a.balance, a.currency), 0);

  const last30 = tx.filter((t) => parseISO(t.date) >= subDays(new Date(), 30));
  const incomeMGA = last30.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const expenseMGA = last30.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const profitMGA = incomeMGA - expenseMGA;

  const receivablesMGA = inv
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);

  const overdueCount = inv.filter((i) => i.status === "overdue").length;

  const burnMGA = expenseMGA; // last 30d
  const runwayMonths = burnMGA > 0 ? totalMGA / burnMGA : 99;

  // Prior 30d window for real trend deltas
  const prev30 = tx.filter((t) => {
    const d = parseISO(t.date);
    return d < subDays(new Date(), 30) && d >= subDays(new Date(), 60);
  });
  const prevIncomeMGA = prev30.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const prevExpenseMGA = prev30.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const prevProfitMGA = prevIncomeMGA - prevExpenseMGA;

  // Cash delta last 30d as % of opening cash (totalMGA - profitMGA approximation)
  const openingCash = Math.max(totalMGA - profitMGA, 1);
  const cashPct = (profitMGA / openingCash) * 100;
  const profitPct = pct(profitMGA, prevProfitMGA);
  const receivablesPct = pct(receivablesMGA, prevIncomeMGA); // proxy
  const prevBurn = prevExpenseMGA;
  const prevRunway = prevBurn > 0 ? totalMGA / prevBurn : runwayMonths;
  const runwayDeltaPct = pct(runwayMonths, prevRunway);

  // Runway health: danger if burning cash (profit < 0), warning if runway < 4mo
  const runwayTone: "default" | "warning" | "danger" | "success" =
    profitMGA < 0 ? "danger" : runwayMonths < 4 ? "warning" : runwayMonths >= 6 ? "success" : "default";

  const pipelineMGA = opp
    .filter((o) => o.stage !== "Closed" && o.stage !== "Lost")
    .reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const weightedMGA = opp
    .filter((o) => o.stage !== "Closed" && o.stage !== "Lost")
    .reduce((s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage], 0);


  // Cash flow chart with view modes
  const [cashView, setCashView] = useState<"daily" | "monthly" | "yearly">("daily");

  const cashFlowData = useMemo(() => {
    if (cashView === "daily") {
      return Array.from({ length: 30 }).map((_, i) => {
        const d = subDays(new Date(), 29 - i);
        const key = d.toISOString().slice(0, 10);
        const dayTx = tx.filter((t) => t.date === key);
        const income = dayTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
        const expense = dayTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
        return { date: format(d, "MMM d"), income: income / 1_000_000, expense: expense / 1_000_000 };
      });
    }
    if (cashView === "monthly") {
      return Array.from({ length: 12 }).map((_, i) => {
        const d = subMonths(new Date(), 11 - i);
        const start = startOfMonth(d);
        const end = endOfMonth(d);
        const mTx = tx.filter((t) => {
          const td = parseISO(t.date);
          return td >= start && td <= end;
        });
        const income = mTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
        const expense = mTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
        return { date: format(d, "MMM yy"), income: income / 1_000_000, expense: expense / 1_000_000 };
      });
    }
    // yearly
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }).map((_, i) => {
      const year = currentYear - 4 + i;
      const start = startOfYear(new Date(year, 0, 1));
      const end = new Date(year, 11, 31, 23, 59, 59);
      const yTx = tx.filter((t) => {
        const td = parseISO(t.date);
        return td >= start && td <= end;
      });
      const income = yTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
      const expense = yTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
      return { date: String(year), income: income / 1_000_000, expense: expense / 1_000_000 };
    });
  }, [cashView, tx]);

  const cashViewLabel = cashView === "daily" ? "30 days" : cashView === "monthly" ? "12 months" : "5 years";



  // per-company profit
  const perCompany = companies.map((c) => {
    const ctx = tx.filter((t) => t.companyId === c.id);
    const inc = ctx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
    const exp = ctx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
    return { name: c.shortName, profit: (inc - exp) / 1_000_000, color: c.color };
  });

  // Sales (closed) chart — historical "Closed" deals by expectedClose month + forecast
  // for the next 3 months derived from the open pipeline weighted by stage probability.
  const salesData = useMemo(() => {
    const now = new Date();
    const historyMonths = 12;
    const forecastMonths = 3;
    const points: Array<{ date: string; closed: number; forecast: number }> = [];
    for (let i = -historyMonths + 1; i <= forecastMonths; i++) {
      const d = subMonths(now, -i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inMonth = (iso: string) => {
        const td = parseISO(iso);
        return td >= start && td <= end;
      };
      const isFuture = i > 0;
      const closed = isFuture
        ? 0
        : opp
            .filter((o) => o.stage === "Closed" && inMonth(o.expectedClose))
            .reduce((s, o) => s + toMGA(o.value, o.currency), 0);
      const forecast = isFuture
        ? opp
            .filter((o) => o.stage !== "Closed" && o.stage !== "Lost" && inMonth(o.expectedClose))
            .reduce((s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage], 0)
        : 0;
      points.push({
        date: format(d, "MMM yy"),
        closed: closed / 1_000_000,
        forecast: forecast / 1_000_000,
      });
    }
    return points;
  }, [opp]);

  const totalClosed12mo = salesData.reduce((s, p) => s + p.closed, 0);
  const totalForecast3mo = salesData.reduce((s, p) => s + p.forecast, 0);

  // ── Axiom pipeline — future expected revenue ───────────────────────────
  // Match any company whose name contains "Axiom" (case-insensitive).
  const axiomCompanyIds = useMemo(
    () => new Set(companies.filter((c) => /axiom/i.test(c.name)).map((c) => c.id)),
    [companies],
  );
  const axiomOpenOpp = useMemo(
    () =>
      opp.filter(
        (o) =>
          axiomCompanyIds.has(o.companyId) &&
          o.stage !== "Closed" &&
          o.stage !== "Lost",
      ),
    [opp, axiomCompanyIds],
  );
  const axiomGrossMGA = axiomOpenOpp.reduce(
    (s, o) => s + toMGA(o.value, o.currency),
    0,
  );
  const axiomWeightedMGA = axiomOpenOpp.reduce(
    (s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage],
    0,
  );
  // Currency mix (gross, in MGA equivalent) for FX transparency.
  const axiomByCurrency = axiomOpenOpp.reduce<Record<Currency, { native: number; mga: number }>>(
    (m, o) => {
      const cur = o.currency;
      m[cur] ??= { native: 0, mga: 0 };
      m[cur].native += o.value;
      m[cur].mga += toMGA(o.value, o.currency);
      return m;
    },
    {} as Record<Currency, { native: number; mga: number }>,
  );
  // 6-month forward weighted expected revenue, MGA equivalent.
  const axiomForecast6mo = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(now, -(i + 1));
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inMonth = axiomOpenOpp.filter((o) => {
        const td = parseISO(o.expectedClose);
        return td >= start && td <= end;
      });
      const weighted = inMonth.reduce(
        (s, o) => s + toMGA(o.value, o.currency) * stageProbability[o.stage],
        0,
      );
      const gross = inMonth.reduce(
        (s, o) => s + toMGA(o.value, o.currency),
        0,
      );
      return {
        date: format(d, "MMM yy"),
        weighted: weighted / 1_000_000,
        gross: gross / 1_000_000,
      };
    });
  }, [axiomOpenOpp]);
  // Runway impact — if weighted expected revenue lands, how many extra months of runway?
  const runwayWithPipeline = burnMGA > 0 ? (totalMGA + axiomWeightedMGA) / burnMGA : runwayMonths;
  const runwayAddedMonths = runwayWithPipeline - runwayMonths;

  return (
    <div className="p-8 space-y-6">
      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total cash (MGA equiv.)"
          value={fmtCompact(totalMGA, "MGA")}
          sub={
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              {Object.entries(cashByCurrency).map(([cur, amt]) => (
                <span key={cur} className="inline-flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-primary" />
                  {fmtCompact(amt, cur as "MGA" | "EUR" | "USD")}
                </span>
              ))}
            </div>
          }
          trend={fmtPct(cashPct)}
          trendDir={cashPct > 0.1 ? "up" : cashPct < -0.1 ? "down" : "flat"}
          highlight={cashPct >= 0}
          tone={totalMGA < 0 ? "danger" : "default"}
        />
        <KpiCard
          label="Profit · last 30d"
          value={fmtCompact(profitMGA, "MGA")}
          sub={`Income ${fmtCompact(incomeMGA, "MGA")} · Spend ${fmtCompact(expenseMGA, "MGA")}`}
          trend={fmtPct(profitPct)}
          trendDir={profitPct > 0.1 ? "up" : profitPct < -0.1 ? "down" : "flat"}
          tone={profitMGA < 0 ? "danger" : profitMGA > 0 ? "success" : "default"}
          badge={profitMGA < 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
              <AlertOctagon className="h-3 w-3" /> Danger
            </span>
          ) : undefined}
        />
        <KpiCard
          label="Receivables"
          value={fmtCompact(receivablesMGA, "MGA")}
          sub={`${overdueCount} overdue · ${inv.filter(i => i.status !== "paid").length} open`}
          trend={overdueCount > 0 ? `${overdueCount} overdue` : fmtPct(receivablesPct)}
          trendDir={overdueCount > 0 ? "down" : receivablesPct < 0 ? "up" : "flat"}
          tone={overdueCount >= 5 ? "warning" : "default"}
          badge={overdueCount >= 5 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <AlertTriangle className="h-3 w-3" /> Warning
            </span>
          ) : undefined}
        />
        <KpiCard
          label="Runway"
          value={`${runwayMonths.toFixed(1)} mo`}
          sub={`Burn ${fmtCompact(burnMGA, "MGA")} / 30d`}
          trend={
            profitMGA < 0 ? "Burning cash"
              : runwayMonths < 4 ? "Low runway"
                : runwayMonths >= 6 ? "Healthy"
                  : fmtPct(runwayDeltaPct)
          }
          trendDir={profitMGA < 0 || runwayMonths < 4 ? "down" : "up"}
          tone={runwayTone}
          badge={
            profitMGA < 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
                <AlertOctagon className="h-3 w-3" /> Danger Zone
              </span>
            ) : runwayMonths < 4 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <AlertTriangle className="h-3 w-3" /> Warning Zone
              </span>
            ) : runwayMonths >= 6 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-success/15 text-success border border-success/30">
                <ShieldCheck className="h-3 w-3" /> Healthy
              </span>
            ) : undefined
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Cash flow · {cashViewLabel}</div>
              <div className="font-display text-lg font-semibold mt-1">All currencies, MGA equivalent (M)</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Tabs value={cashView} onValueChange={(v) => setCashView(v as "daily" | "monthly" | "yearly")}>
                <TabsList className="h-8">
                  <TabsTrigger value="daily" className="text-xs px-2.5 py-1">Daily</TabsTrigger>
                  <TabsTrigger value="monthly" className="text-xs px-2.5 py-1">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly" className="text-xs px-2.5 py-1">Yearly</TabsTrigger>
                </TabsList>
              </Tabs>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-destructive" />Expense</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={cashFlowData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>

                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.14 165)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.14 165)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.68 0.19 22)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.68 0.19 22)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--foreground)" }}
                />
                <Area type="monotone" dataKey="income" stroke="oklch(0.78 0.14 165)" strokeWidth={2} fill="url(#gIn)" />
                <Area type="monotone" dataKey="expense" stroke="oklch(0.68 0.19 22)" strokeWidth={2} fill="url(#gOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Profit by company</div>
          <div className="font-display text-lg font-semibold mt-1 mb-4">30-day net (M MGA)</div>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={perCompany} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }} />
                <Bar dataKey="profit" radius={[6, 6, 0, 0]} fill="oklch(0.78 0.14 165)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales (closed) + forecast */}
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Sales — closed & forecast</div>
            <div className="font-display text-lg font-semibold mt-1">Last 12 months closed · next 3 months weighted (M MGA)</div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground">Closed 12mo <span className="font-tnum text-foreground">{fmtCompact(totalClosed12mo * 1_000_000, "MGA")}</span></span>
            <span className="text-muted-foreground">Forecast 3mo <span className="font-tnum text-foreground">{fmtCompact(totalForecast3mo * 1_000_000, "MGA")}</span></span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" />Closed</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chart-2/70 border border-dashed" />Forecast</span>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={salesData} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }} />
              <Bar dataKey="closed" stackId="s" radius={[0, 0, 0, 0]} fill="oklch(0.78 0.14 165)" name="Closed" />
              <Bar dataKey="forecast" stackId="s" radius={[6, 6, 0, 0]} fill="oklch(0.72 0.13 220)" fillOpacity={0.55} name="Forecast (weighted)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Axiom pipeline — future expected revenue */}
      {axiomCompanyIds.size > 0 && (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Axiom pipeline · future expected revenue
              </div>
              <div className="font-display text-lg font-semibold mt-1">
                Open deals weighted by stage probability · FX-converted to MGA
              </div>
            </div>
            <Link to="/pipeline" className="text-xs text-primary hover:underline">
              Open pipeline →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Gross open pipeline
              </div>
              <div className="font-display text-2xl font-bold tracking-tight font-tnum mt-1">
                {fmtCompact(axiomGrossMGA, "MGA")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {axiomOpenOpp.length} open deals
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-accent/40 p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-primary">
                Weighted expected revenue
              </div>
              <div className="font-display text-2xl font-bold tracking-tight font-tnum mt-1 text-primary">
                {fmtCompact(axiomWeightedMGA, "MGA")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {axiomGrossMGA > 0
                  ? `${((axiomWeightedMGA / axiomGrossMGA) * 100).toFixed(0)}% blended win rate`
                  : "—"}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-card p-4">
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Runway impact
              </div>
              <div className="font-display text-2xl font-bold tracking-tight font-tnum mt-1 flex items-baseline gap-2">
                <span>{runwayWithPipeline.toFixed(1)} mo</span>
                <span className="text-xs font-medium text-success font-tnum">
                  {runwayAddedMonths >= 0 ? "+" : ""}
                  {runwayAddedMonths.toFixed(1)} mo
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Rocket className="h-3 w-3" />
                from {runwayMonths.toFixed(1)} mo today
              </div>
            </div>
          </div>

          {/* Currency mix — shows the FX conversion that feeds the totals */}
          {Object.keys(axiomByCurrency).length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground mb-4">
              <span className="uppercase tracking-[0.16em] text-[10px]">FX mix</span>
              {(Object.entries(axiomByCurrency) as [Currency, { native: number; mga: number }][])
                .sort((a, b) => b[1].mga - a[1].mga)
                .map(([cur, v]) => (
                  <span key={cur} className="inline-flex items-center gap-1.5 font-tnum">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-foreground">{fmtCompact(v.native, cur)}</span>
                    <span className="text-muted-foreground">→ {fmtCompact(v.mga, "MGA")}</span>
                    {cur !== "MGA" && (
                      <span className="text-[10px] text-muted-foreground/70">
                        @ {FX[cur].toLocaleString()} MGA/{cur}
                      </span>
                    )}
                  </span>
                ))}
            </div>
          )}

          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={axiomForecast6mo} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: "color-mix(in oklab, var(--primary) 6%, transparent)" }}
                  formatter={(v: number) => `${v.toFixed(1)} M MGA`}
                />
                <Bar dataKey="gross" radius={[4, 4, 0, 0]} fill="oklch(0.72 0.13 220)" fillOpacity={0.3} name="Gross" />
                <Bar dataKey="weighted" radius={[6, 6, 0, 0]} fill="oklch(0.58 0.21 268)" name="Weighted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}


      {/* Pipeline + Recent */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Pipeline</div>
            <Link to="/pipeline" className="text-xs text-primary hover:underline">View →</Link>
          </div>
          <div className="font-display text-3xl font-bold tracking-tight font-tnum">{fmtCompact(pipelineMGA, "MGA")}</div>
          <div className="text-xs text-muted-foreground font-tnum mt-1">Weighted {fmtCompact(weightedMGA, "MGA")}</div>
          <div className="mt-4 space-y-2">
            {(["Lead", "Qualified", "Proposal", "Negotiation"] as const).map((s) => {
              const v = opp.filter(o => o.stage === s).reduce((sum, o) => sum + toMGA(o.value, o.currency), 0);
              const pct = pipelineMGA > 0 ? (v / pipelineMGA) * 100 : 0;
              return (
                <div key={s}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s}</span>
                    <span className="font-tnum">{fmtCompact(v, "MGA")}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-chart-2" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="xl:col-span-2 rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Recent activity</div>
            <Link to="/transactions" className="text-xs text-primary hover:underline">All transactions →</Link>
          </div>
          <div className="divide-y divide-border/60">
            {tx.slice(0, 6).map((t) => {
              const co = companies.find((c) => c.id === t.companyId)!;
              return (
                <div key={t.id} className="flex items-center gap-4 py-3">
                  <div className="h-8 w-8 rounded-md grid place-items-center text-[10px] font-bold font-display text-primary-foreground" style={{ background: co.color }}>
                    {co.shortName}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{t.description}</div>
                    <div className="text-xs text-muted-foreground">{format(parseISO(t.date), "MMM d")} · {t.category}</div>
                  </div>
                  <div className={`font-tnum text-sm font-medium ${t.type === "income" ? "text-success" : t.type === "expense" ? "text-destructive" : "text-chart-2"}`}>
                    {t.type === "income" ? "+" : t.type === "expense" ? "−" : "↔"} {fmtCompact(t.amount, t.currency)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
