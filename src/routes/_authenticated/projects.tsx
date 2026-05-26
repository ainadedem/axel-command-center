import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useProjects, useClients, useCompanies, useInvoices, useTransactions, invoicesStore, projectsStore,
  fmtCompact, toMGA, type Project, type Currency,
  contactBelongsTo,
} from "@/lib/mock-data";
import { upsertProject, deleteProjectDb } from "@/lib/db-sync";

import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { ReconcileButton, type ReconcileCheck } from "@/components/reconcile-button";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { cn } from "@/lib/utils";
import { KpiCard } from "@/components/kpi-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/projects")({ component: ProjectsPage });

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
  const projects = useProjects();
  const clients = useClients();
  const companies = useCompanies();
  const invoices = useInvoices();
  const transactions = useTransactions();
  const baseList = inScope(projects, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mainTab, setMainTab] = useState<"projects" | "clients">("projects");
  const openCreate = () => { setEditing(null); setOpen(true); };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const projectIds = new Set(projects.map((p) => p.id));
  const orphanInvoices = inScope(invoices, scope).filter((i) => !i.projectId || !projectIds.has(i.projectId));
  const backfillFromInvoices = () => {
    if (orphanInvoices.length === 0) return;
    const groups = new Map<string, typeof orphanInvoices>();
    orphanInvoices.forEach((inv) => {
      const k = `${inv.companyId}::${inv.clientId}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(inv);
    });
    let created = 0;
    groups.forEach((invs, k) => {
      const [companyId, clientId] = k.split("::");
      const cl = clients.find((c) => c.id === clientId);
      let proj = projects.find((p) => p.companyId === companyId && p.clientId === clientId);
      if (!proj) {
        const revenue = invs.reduce((s, i) => s + i.amount, 0);
        const currency = invs[0].currency;
        const newProj: Project = {
          id: newId("prj"), companyId, clientId,
          name: cl ? `${cl.name} — engagement` : "Untitled engagement",
          revenue, cost: 0, currency,
        };
        projectsStore.add(newProj); proj = newProj; created++;
      }
      invs.forEach((inv) => invoicesStore.update(inv.id, { projectId: proj!.id }));
    });
    alert(`Linked ${orphanInvoices.length} invoice(s) to ${created} new project(s).`);
  };

  const reconcileChecks: ReconcileCheck[] = [
    {
      id: "orphan-invoices",
      label: "Invoices without a valid project",
      description: "Invoices with no project link, or pointing to a deleted project. Creates one project per (company, client) and relinks.",
      count: orphanInvoices.length,
      fix: () => { const n = orphanInvoices.length; if (n > 0) backfillFromInvoices(); return n; },
    },
  ];

  const fields: FieldDef<Project>[] = [
    { key: "name", label: "Project", type: "string", accessor: (p) => p.name, noGroup: true },
    { key: "client", label: "Client", type: "enum", accessor: (p) => clients.find((c) => c.id === p.clientId)?.name ?? "" },
    { key: "salesRep", label: "Sales rep", type: "enum", accessor: (p) => clients.find((c) => c.id === p.clientId)?.acquisition ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (p) => companies.find((c) => c.id === p.companyId)?.shortName ?? "" },
    { key: "currency", label: "Currency", type: "enum", accessor: (p) => p.currency },
    { key: "revenue", label: "Revenue", type: "number", accessor: (p) => p.revenue, noGroup: true },
    { key: "cost", label: "Cost", type: "number", accessor: (p) => p.cost, noGroup: true },
    { key: "profit", label: "Profit", type: "number", accessor: (p) => p.revenue - p.cost, noGroup: true },
    { key: "margin", label: "Margin %", type: "number", accessor: (p) => p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0, noGroup: true },
  ];
  const view = useDataView<Project>("projects", fields);
  const groups = view.apply(baseList);
  const list = groups.flatMap((g) => g.items);

  // Portfolio KPIs (all MGA)
  const kpi = useMemo(() => {
    let rev = 0, invoiced = 0, collected = 0, spend = 0;
    for (const p of list) {
      rev += toMGA(p.revenue, p.currency);
      const pi = invoices.filter((i) => i.projectId === p.id);
      invoiced += pi.reduce((s, i) => s + toMGA(i.amount, i.currency), 0);
      collected += pi.reduce((s, i) => s + toMGA(i.paid, i.currency), 0);
      spend += transactions.filter((t) => t.projectId === p.id && t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
    }
    const margin = invoiced > 0 ? ((invoiced - spend) / invoiced) * 100 : rev > 0 ? ((rev - spend) / rev) * 100 : 0;
    return { rev, invoiced, collected, spend, margin };
  }, [list, invoices, transactions]);

  // Client P&L rollup
  const clientRollup = useMemo(() => {
    const map = new Map<string, { projects: Project[]; revMGA: number; invoicedMGA: number; collectedMGA: number; spendMGA: number }>();
    for (const p of list) {
      if (!map.has(p.clientId)) map.set(p.clientId, { projects: [], revMGA: 0, invoicedMGA: 0, collectedMGA: 0, spendMGA: 0 });
      const e = map.get(p.clientId)!;
      e.projects.push(p);
      e.revMGA += toMGA(p.revenue, p.currency);
      const pi = invoices.filter((i) => i.projectId === p.id);
      e.invoicedMGA += pi.reduce((s, i) => s + toMGA(i.amount, i.currency), 0);
      e.collectedMGA += pi.reduce((s, i) => s + toMGA(i.paid, i.currency), 0);
      e.spendMGA += transactions.filter((t) => t.projectId === p.id && t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
    }
    return [...map.entries()]
      .map(([clientId, d]) => ({
        clientId,
        cl: clients.find((c) => c.id === clientId),
        co: companies.find((c) => c.id === d.projects[0]?.companyId),
        ...d,
        margin: d.invoicedMGA > 0
          ? ((d.invoicedMGA - d.spendMGA) / d.invoicedMGA) * 100
          : d.revMGA > 0 ? ((d.revMGA - d.spendMGA) / d.revMGA) * 100 : 0,
      }))
      .sort((a, b) => b.invoicedMGA - a.invoicedMGA);
  }, [list, invoices, transactions, clients, companies]);

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <CrudToolbar count={list.length} label="projects" onCreate={openCreate} />
        <div className="flex items-center gap-2">
          <DataToolbar view={view} items={baseList} />
          <ReconcileButton checks={reconcileChecks} />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState label="projects" onCreate={openCreate} />
      ) : (
        <>
          {/* Portfolio KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Portfolio revenue" value={fmtCompact(kpi.rev, "MGA")} />
            <KpiCard label="Invoiced" value={fmtCompact(kpi.invoiced, "MGA")} />
            <KpiCard label="Collected" value={fmtCompact(kpi.collected, "MGA")} tone="success" />
            <KpiCard label="Logged spend" value={fmtCompact(kpi.spend, "MGA")} tone="danger" />
            <KpiCard
              label="Gross margin"
              value={kpi.invoiced > 0 || kpi.rev > 0 ? `${kpi.margin.toFixed(0)}%` : "—"}
              tone={kpi.margin >= 30 ? "success" : kpi.margin >= 0 ? "default" : "danger"}
            />
          </div>

          <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as typeof mainTab)}>
            <TabsList>
              <TabsTrigger value="projects">By project</TabsTrigger>
              <TabsTrigger value="clients">By client</TabsTrigger>
            </TabsList>
          </Tabs>

          {mainTab === "projects" ? (
            <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-3 py-3 w-8" />
                    <th className="text-left font-medium px-5 py-3">Project</th>
                    <th className="text-left font-medium px-5 py-3">Client</th>
                    <th className="text-left font-medium px-5 py-3">Sales rep</th>
                    <th className="text-left font-medium px-5 py-3">Company</th>
                    <th className="text-right font-medium px-5 py-3">Revenue</th>
                    <th className="text-right font-medium px-5 py-3">Cost</th>
                    <th className="text-right font-medium px-5 py-3">Profit</th>
                    <th className="text-right font-medium px-5 py-3">Margin</th>
                    <th className="text-right font-medium px-5 py-3">Invoiced</th>
                    <th className="text-right font-medium px-5 py-3">Collected</th>
                    <th className="text-right font-medium px-5 py-3">Logged spend</th>
                    <th className="text-right font-medium px-5 py-3">Net P&amp;L</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.key}>
                      {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={14} />}
                      {g.items.map((p) => {
                        const cl = clients.find((c) => c.id === p.clientId);
                        const co = companies.find((c) => c.id === p.companyId);
                        const profit = p.revenue - p.cost;
                        const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                        const projInvoices = invoices.filter((i) => i.projectId === p.id);
                        const invoiced = projInvoices.reduce((s, i) => s + i.amount, 0);
                        const collected = projInvoices.reduce((s, i) => s + i.paid, 0);
                        const projTx = transactions.filter((t) => t.projectId === p.id);
                        const fxToProject = (mga: number) => mga / (p.currency === "MGA" ? 1 : p.currency === "EUR" ? 4850 : 4480);
                        const spendMGA = projTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
                        const incomeMGA = projTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
                        const spend = fxToProject(spendMGA);
                        const netPL = fxToProject(incomeMGA - spendMGA);
                        const isExp = expanded.has(p.id);
                        return (
                          <Fragment key={p.id}>
                            <tr
                              className="border-b border-border/40 hover:bg-surface-elevated/40 group cursor-pointer"
                              onClick={() => toggleExpanded(p.id)}
                            >
                              <td className="px-3 py-3.5 text-muted-foreground w-8">
                                {isExp ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </td>
                              <td className="px-5 py-3.5 font-medium" onClick={(e) => e.stopPropagation()}>
                                {p.name}
                                <div className="flex gap-1 mt-1">
                                  {projInvoices.length > 0 && (
                                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">{projInvoices.length} inv</span>
                                  )}
                                  {projTx.length > 0 && (
                                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-chart-2/30 text-chart-2 bg-chart-2/5">{projTx.length} tx</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-muted-foreground">{cl?.name ?? "—"}</td>
                              <td className="px-5 py-3.5 text-xs text-muted-foreground">{cl?.acquisition ?? <span className="text-muted-foreground/50">—</span>}</td>
                              <td className="px-5 py-3.5">
                                {co && <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: co.color }} />{co.shortName}</span>}
                              </td>
                              <td className="px-5 py-3.5 text-right font-tnum">{fmtCompact(p.revenue, p.currency)}</td>
                              <td className="px-5 py-3.5 text-right font-tnum text-muted-foreground">{fmtCompact(p.cost, p.currency)}</td>
                              <td className={`px-5 py-3.5 text-right font-tnum font-medium ${profit > 0 ? "text-success" : profit < 0 ? "text-destructive" : ""}`}>{fmtCompact(profit, p.currency)}</td>
                              <td className="px-5 py-3.5 text-right"><span className="font-display text-primary font-tnum">{margin.toFixed(0)}%</span></td>
                              <td className="px-5 py-3.5 text-right font-tnum text-xs">{invoiced > 0 ? fmtCompact(invoiced, p.currency) : <span className="text-muted-foreground/50">—</span>}</td>
                              <td className="px-5 py-3.5 text-right font-tnum text-xs text-success">{collected > 0 ? fmtCompact(collected, p.currency) : <span className="text-muted-foreground/50">—</span>}</td>
                              <td className="px-5 py-3.5 text-right font-tnum text-xs text-destructive">{spend > 0 ? fmtCompact(spend, p.currency) : <span className="text-muted-foreground/50">—</span>}</td>
                              <td className="px-5 py-3.5 text-right font-tnum text-xs font-medium">
                                {projTx.length > 0
                                  ? <span className={netPL >= 0 ? "text-success" : "text-destructive"}>{fmtCompact(netPL, p.currency)}</span>
                                  : <span className="text-muted-foreground/50">—</span>}
                              </td>
                              <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                                  <button onClick={() => { setEditing(p); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                                  <button onClick={() => { if (confirm(`Delete ${p.name}?`)) { projectsStore.remove(p.id); void deleteProjectDb(p.id); } }} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </td>
                            </tr>
                            {isExp && (
                              <tr className="border-b border-border/40 bg-surface-elevated/10">
                                <td colSpan={14} className="p-0">
                                  <ProjectDetail projInvoices={projInvoices} projTx={projTx} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Client P&L rollup */
            clientRollup.length === 0 ? (
              <div className="rounded-xl border border-border bg-[var(--gradient-surface)] px-5 py-8 text-center text-sm text-muted-foreground">
                No client data. Link invoices and transactions to projects to see profitability by client.
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-5 py-3">Client</th>
                      <th className="text-left font-medium px-5 py-3">Company</th>
                      <th className="text-right font-medium px-5 py-3">Projects</th>
                      <th className="text-right font-medium px-5 py-3">Invoiced</th>
                      <th className="text-right font-medium px-5 py-3">Collected</th>
                      <th className="text-right font-medium px-5 py-3">Logged spend</th>
                      <th className="text-right font-medium px-5 py-3">Outstanding</th>
                      <th className="text-right font-medium px-5 py-3">Gross margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientRollup.map((row) => {
                      const outstanding = row.invoicedMGA - row.collectedMGA;
                      return (
                        <tr key={row.clientId} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40">
                          <td className="px-5 py-3.5 font-medium">{row.cl?.name ?? <span className="text-muted-foreground/50">—</span>}</td>
                          <td className="px-5 py-3.5">
                            {row.co && <span className="inline-flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ background: row.co.color }} />{row.co.shortName}</span>}
                          </td>
                          <td className="px-5 py-3.5 text-right font-tnum text-muted-foreground">{row.projects.length}</td>
                          <td className="px-5 py-3.5 text-right font-tnum">{row.invoicedMGA > 0 ? fmtCompact(row.invoicedMGA, "MGA") : <span className="text-muted-foreground/50">—</span>}</td>
                          <td className="px-5 py-3.5 text-right font-tnum text-success">{row.collectedMGA > 0 ? fmtCompact(row.collectedMGA, "MGA") : <span className="text-muted-foreground/50">—</span>}</td>
                          <td className="px-5 py-3.5 text-right font-tnum text-destructive">{row.spendMGA > 0 ? fmtCompact(row.spendMGA, "MGA") : <span className="text-muted-foreground/50">—</span>}</td>
                          <td className="px-5 py-3.5 text-right font-tnum text-warning">{outstanding > 0 ? fmtCompact(outstanding, "MGA") : <span className="text-muted-foreground/50">—</span>}</td>
                          <td className="px-5 py-3.5 text-right">
                            {row.invoicedMGA > 0 || row.revMGA > 0 ? (
                              <span className={cn("font-display font-tnum", row.margin >= 30 ? "text-success" : row.margin >= 0 ? "text-primary" : "text-destructive")}>
                                {row.margin.toFixed(0)}%
                              </span>
                            ) : <span className="text-muted-foreground/50">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </>
      )}
      <ProjectDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

/* ── Project drill-down panel ── */

const INV_STATUS_TONE: Record<string, string> = {
  draft: "text-muted-foreground",
  sent: "text-chart-2",
  partial: "text-warning",
  paid: "text-success",
  overdue: "text-destructive",
  cancelled: "text-muted-foreground/50 line-through",
};

function ProjectDetail({
  projInvoices,
  projTx,
}: {
  projInvoices: ReturnType<typeof useInvoices>;
  projTx: ReturnType<typeof useTransactions>;
}) {
  const expenses = projTx.filter((t) => t.type === "expense");

  const byCategory = new Map<string, number>();
  for (const t of expenses) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + toMGA(t.amount, t.currency));
  }

  const totalInvoiced = projInvoices.reduce((s, i) => s + toMGA(i.amount, i.currency), 0);
  const totalCollected = projInvoices.reduce((s, i) => s + toMGA(i.paid, i.currency), 0);
  const totalSpend = expenses.reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
  const grossMargin = totalInvoiced > 0 ? ((totalInvoiced - totalSpend) / totalInvoiced) * 100 : 0;

  return (
    <div className="px-5 py-5 grid grid-cols-3 gap-6 text-sm border-t border-border">
      {/* Mini P&L */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">P&L summary</div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Invoiced</span><span className="font-tnum">{fmtCompact(totalInvoiced, "MGA")}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Collected</span><span className="font-tnum text-success">{fmtCompact(totalCollected, "MGA")}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Outstanding</span><span className="font-tnum text-warning">{fmtCompact(Math.max(0, totalInvoiced - totalCollected), "MGA")}</span></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Expenses logged</span><span className="font-tnum text-destructive">{fmtCompact(totalSpend, "MGA")}</span></div>
          <div className="flex justify-between text-xs border-t border-border/40 pt-2 font-semibold">
            <span>Gross margin</span>
            <span className={cn("font-tnum", grossMargin >= 30 ? "text-success" : grossMargin >= 0 ? "" : "text-destructive")}>
              {totalInvoiced > 0 ? `${grossMargin.toFixed(0)}%` : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
          Invoices {projInvoices.length > 0 && <span className="font-tnum">({projInvoices.length})</span>}
        </div>
        {projInvoices.length === 0 ? (
          <div className="text-xs text-muted-foreground/50">None linked</div>
        ) : (
          <div className="space-y-1.5">
            {projInvoices.slice(0, 7).map((inv) => (
              <div key={inv.id} className="flex items-center gap-2 text-xs">
                <span className="font-tnum text-muted-foreground w-28 shrink-0">{inv.number}</span>
                <span className={cn("text-[9px] uppercase font-semibold tracking-wide", INV_STATUS_TONE[inv.status])}>{inv.status}</span>
                <span className="font-tnum ml-auto shrink-0">{fmtCompact(inv.amount, inv.currency)}</span>
              </div>
            ))}
            {projInvoices.length > 7 && (
              <div className="text-[11px] text-muted-foreground mt-0.5">+{projInvoices.length - 7} more</div>
            )}
          </div>
        )}
      </div>

      {/* Expense breakdown */}
      <div>
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
          Expenses by category {byCategory.size > 0 && <span className="font-tnum">({expenses.length} tx)</span>}
        </div>
        {byCategory.size === 0 ? (
          <div className="text-xs text-muted-foreground/50">
            No expense transactions linked yet.<br />
            Tag transactions with this project in the Transactions page.
          </div>
        ) : (
          <div className="space-y-1.5">
            {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{cat}</span>
                <span className="font-tnum text-destructive/80 shrink-0">{fmtCompact(amt, "MGA")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Project dialog (unchanged) ── */

function ProjectDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Project | null }) {
  const companies = useCompanies();
  const clients = useClients();
  const [companyId, setCompanyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [revenue, setRevenue] = useState("0");
  const [cost, setCost] = useState("0");
  const [currency, setCurrency] = useState<Currency>("EUR");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setClientId(editing.clientId); setName(editing.name);
      setRevenue(String(editing.revenue)); setCost(String(editing.cost)); setCurrency(editing.currency);
    } else {
      setCompanyId(companies[0]?.id ?? ""); setClientId(""); setName(""); setRevenue("0"); setCost("0"); setCurrency("EUR");
    }
  }, [open, editing, companies]);

  const companyClients = clients.filter((c) => contactBelongsTo(c, companyId));

  const submit = () => {
    if (!name.trim() || !companyId || !clientId) return;
    const data = { companyId, clientId, name, revenue: Number(revenue) || 0, cost: Number(cost) || 0, currency };
    if (editing) {
      projectsStore.update(editing.id, data);
      void upsertProject({ ...editing, ...data } as Project);
    } else {
      const localId = newId("prj");
      const local = { id: localId, ...data } as Project;
      projectsStore.add(local);
      void upsertProject(local).then((dbId) => {
        if (dbId && dbId !== localId) {
          projectsStore.replaceAll(projectsStore.items.map((p) => p.id === localId ? { ...p, id: dbId } : p));
        }
      });
    }
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit project" : "New project"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Company</Label>
            <Select value={companyId} onValueChange={(v) => { setCompanyId(v); setClientId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder={companyClients.length ? "Select client" : "Create a client first"} /></SelectTrigger>
              <SelectContent>{companyClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Project name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Revenue</Label><Input type="number" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></div>
            <div><Label>Cost</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MGA">MGA</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
