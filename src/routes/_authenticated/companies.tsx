import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { companies, accounts, transactions, toMGA, fmtCompact } from "@/lib/mock-data";

export const Route = createFileRoute("/_authenticated/companies")({ component: CompaniesPage });

function CompaniesPage() {
  return (
    <AppShell>
      <PageHeader title="Companies" description="Group entities under your control." />
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {companies.map((c) => {
          const cAcc = accounts.filter((a) => a.companyId === c.id);
          const cTx = transactions.filter((t) => t.companyId === c.id);
          const cash = cAcc.reduce((s, a) => s + toMGA(a.balance, a.currency), 0);
          const income = cTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
          const expense = cTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
          return (
            <div key={c.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/40 transition">
              <div className="flex items-center gap-3 mb-5">
                <div className="h-10 w-10 rounded-lg grid place-items-center text-sm font-display font-bold text-primary-foreground" style={{ background: c.color }}>
                  {c.shortName}
                </div>
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">Base · {c.baseCurrency}</div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <Row label="Cash" value={fmtCompact(cash, "MGA")} accent />
                <Row label="Income · 30d" value={fmtCompact(income, "MGA")} />
                <Row label="Spend · 30d" value={fmtCompact(expense, "MGA")} />
                <Row label="Net" value={fmtCompact(income - expense, "MGA")} accent={income - expense >= 0} />
                <Row label="Accounts" value={cAcc.length.toString()} />
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className={`font-tnum font-medium ${accent ? "text-primary font-display" : ""}`}>{value}</span>
    </div>
  );
}
