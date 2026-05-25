import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { transactions, companies, toMGA, fmtCompact } from "@/lib/mock-data";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  return (
    <AppShell>
      <PageHeader title="Reports" description="P&L by company, consolidated group view." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const data = companies.map((c) => {
    const tx = transactions.filter(t => t.companyId === c.id);
    const income = tx.filter(t => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0) / 1_000_000;
    const expense = tx.filter(t => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0) / 1_000_000;
    return { name: c.shortName, Income: +income.toFixed(1), Expense: +expense.toFixed(1), Profit: +(income - expense).toFixed(1) };
  });

  const totalInc = data.reduce((s, d) => s + d.Income, 0);
  const totalExp = data.reduce((s, d) => s + d.Expense, 0);

  return (
    <div className="p-8 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Group income · 30d" value={fmtCompact(totalInc * 1_000_000, "MGA")} tone="success" />
        <Stat label="Group spend · 30d" value={fmtCompact(totalExp * 1_000_000, "MGA")} tone="destructive" />
        <Stat label="Group profit · 30d" value={fmtCompact((totalInc - totalExp) * 1_000_000, "MGA")} tone={(totalInc - totalExp) >= 0 ? "success" : "destructive"} />
      </div>

      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">P&L · by company</div>
        <div className="font-display text-lg font-semibold mt-1 mb-4">Last 30 days (M MGA)</div>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="oklch(0.3 0.018 250 / 0.4)" vertical={false} />
              <XAxis dataKey="name" stroke="oklch(0.68 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="oklch(0.68 0.015 250)" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: "oklch(0.215 0.02 250)", border: "1px solid oklch(0.3 0.018 250)", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "oklch(0.27 0.02 250 / 0.5)" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Income" radius={[6, 6, 0, 0]} fill="oklch(0.78 0.14 165)" />
              <Bar dataKey="Expense" radius={[6, 6, 0, 0]} fill="oklch(0.68 0.19 22)" />
              <Bar dataKey="Profit" radius={[6, 6, 0, 0]} fill="oklch(0.72 0.13 220)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" | "primary" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "primary" ? "text-primary" : "";
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-2 font-tnum ${toneClass}`}>{value}</div>
    </div>
  );
}
