import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { invoices, companies, clients, fmtCompact, toMGA } from "@/lib/mock-data";
import { inScope, useCompany } from "@/lib/company-context";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

const statusStyles: Record<string, string> = {
  draft: "border-muted text-muted-foreground bg-muted/30",
  sent: "border-chart-2/40 text-chart-2 bg-chart-2/10",
  partial: "border-warning/40 text-warning bg-warning/10",
  paid: "border-success/40 text-success bg-success/10",
  overdue: "border-destructive/40 text-destructive bg-destructive/10",
};

function InvoicesPage() {
  return (
    <AppShell>
      <PageHeader title="Invoices" description="What's owed and when it lands." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const list = inScope(invoices, scope);

  const totalOpen = list.filter(i => i.status !== "paid").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalOverdue = list.filter(i => i.status === "overdue").reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
  const totalPaid = list.filter(i => i.status === "paid").reduce((s, i) => s + toMGA(i.amount, i.currency), 0);

  return (
    <div className="p-8 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Open receivables" value={fmtCompact(totalOpen, "MGA")} />
        <Stat label="Overdue" value={fmtCompact(totalOverdue, "MGA")} danger />
        <Stat label="Collected (period)" value={fmtCompact(totalPaid, "MGA")} good />
      </div>

      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-5 py-3">Number</th>
              <th className="text-left font-medium px-5 py-3">Client</th>
              <th className="text-left font-medium px-5 py-3">Company</th>
              <th className="text-left font-medium px-5 py-3">Due</th>
              <th className="text-left font-medium px-5 py-3">Status</th>
              <th className="text-right font-medium px-5 py-3">Amount</th>
              <th className="text-right font-medium px-5 py-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => {
              const co = companies.find(c => c.id === inv.companyId)!;
              const cl = clients.find(c => c.id === inv.clientId);
              const days = differenceInDays(parseISO(inv.dueDate), new Date());
              const balance = inv.amount - inv.paid;
              return (
                <tr key={inv.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40">
                  <td className="px-5 py-3.5 font-tnum text-xs text-muted-foreground">{inv.number}</td>
                  <td className="px-5 py-3.5 font-medium">{cl?.name}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                      {co.shortName}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground text-xs font-tnum">
                    {format(parseISO(inv.dueDate), "MMM d")}
                    {days < 0 && <span className="ml-2 text-destructive">{Math.abs(days)}d late</span>}
                    {days >= 0 && days < 14 && <span className="ml-2 text-warning">in {days}d</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", statusStyles[inv.status])}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(inv.amount, inv.currency)}</td>
                  <td className="px-5 py-3.5 text-right font-tnum font-medium">
                    {balance > 0 ? fmtCompact(balance, inv.currency) : <span className="text-muted-foreground">—</span>}
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

function Stat({ label, value, danger, good }: { label: string; value: string; danger?: boolean; good?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn(
        "font-display text-2xl font-bold mt-2 font-tnum",
        danger && "text-destructive",
        good && "text-success",
      )}>{value}</div>
    </div>
  );
}
