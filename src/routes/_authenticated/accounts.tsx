import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { accounts, companies, fmtCompact, toMGA } from "@/lib/mock-data";
import { inScope, useCompany } from "@/lib/company-context";
import { Landmark, Smartphone, Banknote } from "lucide-react";

export const Route = createFileRoute("/_authenticated/accounts")({ component: AccountsPage });

const iconFor = (t: string) => t === "bank" ? Landmark : t === "mobile" ? Smartphone : Banknote;

function AccountsPage() {
  return (
    <AppShell>
      <PageHeader title="Accounts" description="Bank, mobile and cash accounts across all companies." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const list = inScope(accounts, scope);
  const totalMGA = list.reduce((s, a) => s + toMGA(a.balance, a.currency), 0);

  return (
    <div className="p-8 space-y-5">
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 flex items-center justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Total liquidity</div>
          <div className="font-display text-3xl font-bold mt-1 font-tnum">{fmtCompact(totalMGA, "MGA")}</div>
        </div>
        <div className="text-xs text-muted-foreground">{list.length} accounts</div>
      </div>

      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-5 py-3">Account</th>
              <th className="text-left font-medium px-5 py-3">Company</th>
              <th className="text-left font-medium px-5 py-3">Type</th>
              <th className="text-right font-medium px-5 py-3">Balance</th>
              <th className="text-right font-medium px-5 py-3">MGA equiv.</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const co = companies.find((c) => c.id === a.companyId)!;
              const Icon = iconFor(a.type);
              return (
                <tr key={a.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/50">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md bg-surface-elevated grid place-items-center text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-xs text-muted-foreground uppercase">{a.currency}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                      {co.name}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 capitalize text-muted-foreground">{a.type}</td>
                  <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(a.balance, a.currency)}</td>
                  <td className="px-5 py-3.5 text-right font-tnum text-muted-foreground">{fmtCompact(toMGA(a.balance, a.currency), "MGA")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
