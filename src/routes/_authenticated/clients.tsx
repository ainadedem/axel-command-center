import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useClients, useCompanies, useProjects, useInvoices, useTransactions,
  useSalesPeople,
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
import { Avatar, AvatarUpload } from "@/components/avatar-upload";
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
                  <div className="flex items-start justify-between mb-4 gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Avatar src={cl.avatarUrl} name={cl.name} size={44} />
                      <div className="min-w-0">
                        <div className="font-medium text-base truncate">{cl.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{cl.country}</div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {cl.acquisition && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20" title="Client acquisition">
                              Acq · {cl.acquisition}
                            </span>
                          )}
                          {cl.acquiredAt && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 border border-violet-500/20" title="Acquired on">
                              Since {cl.acquiredAt}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
  const acqPeople = useSalesPeople("acquisition");
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [acquisition, setAcquisition] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [contacts, setContacts] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name); setCountry(editing.country);
      setAcquisition(editing.acquisition ?? "");
      setAcquiredAt(editing.acquiredAt ?? "");
      setWebsite(editing.website ?? "");
      setEmail(editing.email ?? "");
      setPhone(editing.phone ?? "");
      setAddress(editing.address ?? "");
      setIndustry(editing.industry ?? "");
      setContacts(editing.contacts ?? "");
      setAvatarUrl(editing.avatarUrl);
    } else {
      setCompanyId(companies[0]?.id ?? ""); setName(""); setCountry(""); setAcquisition("");
      setAcquiredAt(new Date().toISOString().slice(0, 10));
      setWebsite(""); setEmail(""); setPhone(""); setAddress(""); setIndustry(""); setContacts("");
      setAvatarUrl(undefined);
    }
  }, [open, editing, companies]);

  const submit = () => {
    if (!name.trim() || !companyId) return;
    const data = {
      companyId, name, country,
      acquisition: acquisition.trim() || undefined,
      acquiredAt: acquiredAt || undefined,
      website: website.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      industry: industry.trim() || undefined,
      contacts: contacts.trim() || undefined,
      avatarUrl,
    };
    if (editing) clientsStore.update(editing.id, data);
    else clientsStore.add({ id: newId("cli"), ...data });
    onOpenChange(false);
  };

  const acqOptions = (() => {
    const names = acqPeople.map((p) => p.name);
    if (acquisition && !names.includes(acquisition)) names.push(acquisition);
    return names.sort();
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{editing ? "Edit client" : "New client"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          <div className="flex items-start gap-4">
            <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} name={name} size={72} />
            <div className="flex-1 space-y-3">
              <div><Label>Client name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div>
                <Label>Company</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
            <div><Label>Acquired on</Label><Input type="date" value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Industry</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Telecom, Finance, …" /></div>
            <div><Label>Website</Label><Input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <div><Label>HQ address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div><Label>Key contacts</Label><Input value={contacts} onChange={(e) => setContacts(e.target.value)} placeholder="Name, role; Name, role…" /></div>
          <div>
            <Label>Acquisition</Label>
            {acqOptions.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
                No acquisition people in the sales team yet — <Link to="/sales-team" className="text-primary underline">add one</Link>.
              </div>
            ) : (
              <Select value={acquisition || "__none__"} onValueChange={(v) => setAcquisition(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select acquisition person" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Unassigned —</SelectItem>
                  {acqOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Sourced from the <Link to="/sales-team" className="text-primary underline">Sales team</Link>. Same person across all opportunities, invoices and projects for this client.
            </p>
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
