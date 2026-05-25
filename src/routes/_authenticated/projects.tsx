import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useProjects, useClients, useCompanies, useInvoices, useTransactions, invoicesStore, projectsStore,
  fmtCompact, toMGA, type Project, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2 } from "lucide-react";
import { ReconcileButton, type ReconcileCheck } from "@/components/reconcile-button";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";

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
  const openCreate = () => { setEditing(null); setOpen(true); };

  // Count invoices for this scope with no project link OR pointing to a missing project → backfill candidates.
  const projectIds = new Set(projects.map((p) => p.id));
  const orphanInvoices = inScope(invoices, scope).filter((i) => !i.projectId || !projectIds.has(i.projectId));
  const backfillFromInvoices = () => {
    if (orphanInvoices.length === 0) return;
    // Group orphans by (companyId, clientId); one project per group.
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
      // Find an existing project for this client if any — otherwise create one.
      let proj = projects.find((p) => p.companyId === companyId && p.clientId === clientId);
      if (!proj) {
        const revenue = invs.reduce((s, i) => s + i.amount, 0);
        const currency = invs[0].currency;
        const newProj: Project = {
          id: newId("prj"),
          companyId,
          clientId,
          name: cl ? `${cl.name} — engagement` : "Untitled engagement",
          revenue,
          cost: 0,
          currency,
        };
        projectsStore.add(newProj);
        proj = newProj;
        created++;
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
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
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
                  {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={13} />}
                  {g.items.map((p) => {
                const cl = clients.find((c) => c.id === p.clientId);
                const co = companies.find((c) => c.id === p.companyId);
                const profit = p.revenue - p.cost;
                const margin = p.revenue > 0 ? (profit / p.revenue) * 100 : 0;
                const projInvoices = invoices.filter((i) => i.projectId === p.id);
                const invoiced = projInvoices.reduce((s, i) => s + i.amount, 0);
                const collected = projInvoices.reduce((s, i) => s + i.paid, 0);
                const projTx = transactions.filter((t) => t.projectId === p.id);
                // Sum tx in MGA then convert back to project currency for display parity.
                const fxToProject = (mga: number) => mga / (p.currency === "MGA" ? 1 : (p.currency === "EUR" ? 4850 : 4480));
                const spendMGA = projTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
                const incomeMGA = projTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
                const spend = fxToProject(spendMGA);
                const netPL = fxToProject(incomeMGA - spendMGA);
                return (
                  <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 group">
                    <td className="px-5 py-3.5 font-medium">
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
                    <td className="px-5 py-3.5 text-right">
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end">
                        <button onClick={() => { setEditing(p); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm(`Delete ${p.name}?`) && projectsStore.remove(p.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ProjectDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

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

  const companyClients = clients.filter((c) => c.companyId === companyId);

  const submit = () => {
    if (!name.trim() || !companyId || !clientId) return;
    const data = { companyId, clientId, name, revenue: Number(revenue) || 0, cost: Number(cost) || 0, currency };
    if (editing) projectsStore.update(editing.id, data);
    else projectsStore.add({ id: newId("prj"), ...data });
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
