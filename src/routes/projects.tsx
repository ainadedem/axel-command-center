import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { projects, clients, companies, fmtCompact, toMGA } from "@/lib/mock-data";
import { inScope, useCompany } from "@/lib/company-context";

export const Route = createFileRoute("/projects")({ component: ProjectsPage });

function ProjectsPage() {
  return (
    <AppShell>
      <PageHeader title="Projects" description="Profitability per engagement." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const list = inScope(projects, scope);
  return (
    <div className="p-8">
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-5 py-3">Project</th>
              <th className="text-left font-medium px-5 py-3">Client</th>
              <th className="text-left font-medium px-5 py-3">Company</th>
              <th className="text-right font-medium px-5 py-3">Revenue</th>
              <th className="text-right font-medium px-5 py-3">Cost</th>
              <th className="text-right font-medium px-5 py-3">Profit</th>
              <th className="text-right font-medium px-5 py-3">Margin</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const cl = clients.find(c => c.id === p.clientId);
              const co = companies.find(c => c.id === p.companyId)!;
              const profit = p.revenue - p.cost;
              const margin = (profit / p.revenue) * 100;
              return (
                <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40">
                  <td className="px-5 py-3.5 font-medium">{p.name}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{cl?.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                      {co.shortName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(p.revenue, p.currency)}</td>
                  <td className="px-5 py-3.5 text-right font-tnum text-muted-foreground">{fmtCompact(p.cost, p.currency)}</td>
                  <td className="px-5 py-3.5 text-right font-tnum font-medium text-success">{fmtCompact(profit, p.currency)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="font-display text-primary font-tnum">{margin.toFixed(0)}%</span>
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
