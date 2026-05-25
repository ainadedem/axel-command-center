import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { useCompany } from "@/lib/company-context";
import {
  accounts, transactions, invoices, opportunities,
  toMGA, fmtCompact, stageProbability, companies,
} from "@/lib/mock-data";
import { inScope } from "@/lib/company-context";
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear, parseISO } from "date-fns";
import { useState, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, AlertOctagon, ShieldCheck } from "lucide-react";

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

  const acc = inScope(accounts, scope);
  const tx = inScope(transactions, scope);
  const inv = inScope(invoices, scope);
  const opp = inScope(opportunities, scope);

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
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost")
    .reduce((s, o) => s + toMGA(o.value, o.currency), 0);
  const weightedMGA = opp
    .filter((o) => o.stage !== "Won" && o.stage !== "Lost")
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
          trend="+12.4%"
          trendDir="up"
          highlight
        />
        <KpiCard
          label="Profit · last 30d"
          value={<span className={profitMGA > 0 ? "text-success" : profitMGA < 0 ? "text-destructive" : ""}>{fmtCompact(profitMGA, "MGA")}</span>}
          sub={`Income ${fmtCompact(incomeMGA, "MGA")} · Spend ${fmtCompact(expenseMGA, "MGA")}`}
          trend={profitMGA >= 0 ? "+8.1%" : "−8.1%"}
          trendDir={profitMGA >= 0 ? "up" : "down"}
        />
        <KpiCard
          label="Receivables"
          value={fmtCompact(receivablesMGA, "MGA")}
          sub={`${overdueCount} overdue · ${inv.filter(i => i.status !== "paid").length} open`}
          trend={overdueCount > 0 ? `${overdueCount} overdue` : "On track"}
          trendDir={overdueCount > 0 ? "down" : "up"}
        />
        <KpiCard
          label="Runway"
          value={`${runwayMonths.toFixed(1)} mo`}
          sub={`Burn ${fmtCompact(burnMGA, "MGA")} / 30d`}
          trend="Healthy"
          trendDir="up"
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
                <CartesianGrid stroke="oklch(0.3 0.018 250 / 0.4)" vertical={false} />
                <XAxis dataKey="date" stroke="oklch(0.68 0.015 250)" fontSize={11} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis stroke="oklch(0.68 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.215 0.02 250)",
                    border: "1px solid oklch(0.3 0.018 250)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "oklch(0.97 0.005 250)" }}
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
                <CartesianGrid stroke="oklch(0.3 0.018 250 / 0.4)" vertical={false} />
                <XAxis dataKey="name" stroke="oklch(0.68 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="oklch(0.68 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "oklch(0.215 0.02 250)", border: "1px solid oklch(0.3 0.018 250)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "oklch(0.27 0.02 250 / 0.5)" }} />
                <Bar dataKey="profit" radius={[6, 6, 0, 0]} fill="oklch(0.78 0.14 165)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

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
