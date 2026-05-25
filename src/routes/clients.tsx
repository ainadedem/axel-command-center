import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { clients, companies, projects, fmtCompact, toMGA } from "@/lib/mock-data";

export const Route = createFileRoute("/clients")({ component: ClientsPage });

function ClientsPage() {
  return (
    <AppShell>
      <PageHeader title="Clients" description="Who pays you, and how much they're worth." />
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {clients.map((cl) => {
          const co = companies.find(c => c.id === cl.companyId)!;
          const cliProjects = projects.filter(p => p.clientId === cl.id);
          const revenue = cliProjects.reduce((s, p) => s + toMGA(p.revenue, p.currency), 0);
          const cost = cliProjects.reduce((s, p) => s + toMGA(p.cost, p.currency), 0);
          const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
          return (
            <div key={cl.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/40 transition">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-medium text-base">{cl.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{cl.country}</div>
                </div>
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                  {co.shortName}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/60">
                <Stat label="Revenue" value={fmtCompact(revenue, "MGA")} />
                <Stat label="Cost" value={fmtCompact(cost, "MGA")} />
                <Stat label="Margin" value={`${margin.toFixed(0)}%`} accent />
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-tnum font-medium mt-1 text-sm ${accent ? "text-primary font-display" : ""}`}>{value}</div>
    </div>
  );
}
