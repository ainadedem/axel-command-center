import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useClients, useCompanies, useProjects, useInvoices, useTransactions,
  clientsStore, fmtCompact, toMGA, type Client,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients")({ component: ClientsPage });

function ClientsPage() {
  const clients = useClients();
  const companies = useCompanies();
  const projects = useProjects();
  const invoices = useInvoices();
  const transactions = useTransactions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <AppShell>
      <PageHeader title="Clients" description="Who pays you, and how much they're worth." />
      <div className="p-8 space-y-5">
        <CrudToolbar count={clients.length} label="clients" onCreate={openCreate} />
        {clients.length === 0 ? (
          <EmptyState label="clients" onCreate={openCreate} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clients.map((cl) => {
              const co = companies.find((c) => c.id === cl.companyId);
              const cliProjects = projects.filter((p) => p.clientId === cl.id);
              const cliInvoices = invoices.filter((i) => i.clientId === cl.id);
              const cliTx = transactions.filter((t) => t.clientId === cl.id);
              // Revenue: prefer invoices when present, else project revenue, else income transactions.
              const invoicedMGA = cliInvoices.reduce((s, i) => s + toMGA(i.amount, i.currency), 0);
              const paidMGA = cliInvoices.reduce((s, i) => s + toMGA(i.paid, i.currency), 0);
              const projectRevenue = cliProjects.reduce((s, p) => s + toMGA(p.revenue, p.currency), 0);
              const incomeTxMGA = cliTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
              const expenseTxMGA = cliTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
              const revenue = invoicedMGA || projectRevenue || incomeTxMGA;
              const projectCost = cliProjects.reduce((s, p) => s + toMGA(p.cost, p.currency), 0);
              const cost = projectCost + expenseTxMGA;
              const margin = revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0;
              const outstanding = Math.max(0, invoicedMGA - paidMGA);
              return (
                <div key={cl.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/40 transition group">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="font-medium text-base">{cl.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{cl.country}</div>
                      {cl.acquisition && (
                        <div className="mt-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20" title="Client acquisition">
                          Acq · {cl.acquisition}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {co && (
                        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                          {co.shortName}
                        </span>
                      )}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5">
                        <button onClick={() => { setEditing(cl); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm(`Delete ${cl.name}?`) && clientsStore.remove(cl.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/60">
                    <Stat label="Revenue" value={fmtCompact(revenue, "MGA")} />
                    <Stat label="Outstanding" value={fmtCompact(outstanding, "MGA")} />
                    <Stat label="Margin" value={`${margin.toFixed(0)}%`} accent />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <div>{cliInvoices.length} invoice{cliInvoices.length === 1 ? "" : "s"}</div>
                    <div>{cliTx.length} txn{cliTx.length === 1 ? "" : "s"}</div>
                    <div>{cliProjects.length} project{cliProjects.length === 1 ? "" : "s"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ClientDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppShell>
  );
}

function ClientDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Client | null }) {
  const companies = useCompanies();
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [acquisition, setAcquisition] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name); setCountry(editing.country);
      setAcquisition(editing.acquisition ?? "");
    } else {
      setCompanyId(companies[0]?.id ?? ""); setName(""); setCountry(""); setAcquisition("");
    }
  }, [open, editing, companies]);

  const submit = () => {
    if (!name.trim() || !companyId) return;
    const data = { companyId, name, country, acquisition: acquisition.trim() || undefined };
    if (editing) clientsStore.update(editing.id, data);
    else clientsStore.add({ id: newId("cli"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Company</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Client name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
          <div>
            <Label>Acquisition</Label>
            <Input value={acquisition} onChange={(e) => setAcquisition(e.target.value)} placeholder="Who brought this client" />
            <p className="text-[11px] text-muted-foreground mt-1">Single person across all opportunities, invoices and projects for this client.</p>
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-tnum font-medium mt-1 text-sm ${accent ? "text-primary font-display" : ""}`}>{value}</div>
    </div>
  );
}
