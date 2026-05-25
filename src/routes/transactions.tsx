import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { transactions, companies, fmtCompact } from "@/lib/mock-data";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transactions")({ component: TransactionsPage });

const types = ["all", "income", "expense", "transfer", "intercompany"] as const;

function TransactionsPage() {
  return (
    <AppShell>
      <PageHeader title="Transactions" description="Every flow of money — income, expense, transfer, intercompany." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const [filter, setFilter] = useState<(typeof types)[number]>("all");
  let list = inScope(transactions, scope);
  if (filter !== "all") list = list.filter((t) => t.type === filter);
  list = [...list].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center gap-2">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm capitalize transition border",
              filter === t
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-surface hover:bg-surface-elevated text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-5 py-3">Date</th>
              <th className="text-left font-medium px-5 py-3">Description</th>
              <th className="text-left font-medium px-5 py-3">Company</th>
              <th className="text-left font-medium px-5 py-3">Category</th>
              <th className="text-left font-medium px-5 py-3">Type</th>
              <th className="text-right font-medium px-5 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {list.map((t) => {
              const co = companies.find((c) => c.id === t.companyId)!;
              return (
                <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40">
                  <td className="px-5 py-3.5 text-muted-foreground font-tnum text-xs">{format(parseISO(t.date), "MMM d, yyyy")}</td>
                  <td className="px-5 py-3.5 font-medium">{t.description}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                      {co.shortName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{t.category}</td>
                  <td className="px-5 py-3.5">
                    <span className={cn(
                      "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border",
                      t.type === "income" && "border-success/40 text-success bg-success/10",
                      t.type === "expense" && "border-destructive/30 text-destructive bg-destructive/10",
                      t.type === "transfer" && "border-chart-2/30 text-chart-2 bg-chart-2/10",
                      t.type === "intercompany" && "border-chart-4/30 text-chart-4 bg-chart-4/10",
                    )}>
                      {t.type}
                    </span>
                  </td>
                  <td className={cn(
                    "px-5 py-3.5 text-right font-tnum font-medium",
                    t.type === "income" && "text-success",
                  )}>
                    {t.type === "income" ? "+" : t.type === "expense" ? "−" : ""}{fmtCompact(t.amount, t.currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
