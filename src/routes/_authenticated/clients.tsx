import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useClients, useCompanies, useProjects, useInvoices, useTransactions,
  useSalesPeople, useTeamMembers,
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
import { Pencil, Trash2, Wallet, AlertCircle, TrendingUp, ArrowUpRight, UserCheck, Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/clients")({ component: ClientsPage });

/** True when a client should be treated as a real (won) client, not a lead. */
function isWonClient(cl: Client, hasActivity: boolean): boolean {
  // Explicit status wins; otherwise infer from activity to keep legacy data working.
  if (cl.status === "client") return true;
  if (cl.status === "lead") return false;
  return hasActivity || true; // undefined defaults to "client" for backward compatibility
}

function ClientsPage() {
  const clients = useClients();
  const companies = useCompanies();
  const projects = useProjects();
  const invoices = useInvoices();
  const transactions = useTransactions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [tab, setTab] = useState<"all" | "clients" | "leads">("clients");
  const openCreate = () => { setEditing(null); setOpen(true); };

  // Partition clients into "leads" vs "clients" using explicit status + activity fallback.
  const partitioned = clients.map((cl) => {
    const hasActivity =
      invoices.some((i) => i.clientId === cl.id) ||
      projects.some((p) => p.clientId === cl.id) ||
      transactions.some((t) => t.clientId === cl.id);
    return { cl, isLead: !isWonClient(cl, hasActivity) };
  });
  const wonClients = partitioned.filter((p) => !p.isLead).map((p) => p.cl);
  const leadClients = partitioned.filter((p) => p.isLead).map((p) => p.cl);

  // Aggregate KPIs across won clients (revenue numbers don't make sense for leads)
  const totals = wonClients.reduce(
    (acc, cl) => {
      const cliInvoices = invoices.filter((i) => i.clientId === cl.id);
      const cliProjects = projects.filter((p) => p.clientId === cl.id);
      const cliTx = transactions.filter((t) => t.clientId === cl.id);
      const invoicedMGA = cliInvoices.reduce((s, i) => s + toMGA(i.amount, i.currency), 0);
      const paidMGA = cliInvoices.reduce((s, i) => s + toMGA(i.paid, i.currency), 0);
      const projectRevenue = cliProjects.reduce((s, p) => s + toMGA(p.revenue, p.currency), 0);
      const incomeTxMGA = cliTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
      acc.revenue += invoicedMGA || projectRevenue || incomeTxMGA;
      acc.outstanding += Math.max(0, invoicedMGA - paidMGA);
      acc.overdue += cliInvoices.filter((i) => i.status === "overdue").length;
      return acc;
    },
    { revenue: 0, outstanding: 0, overdue: 0 },
  );
  const topClient = wonClients
    .map((cl) => {
      const cliInvoices = invoices.filter((i) => i.clientId === cl.id);
      const cliProjects = projects.filter((p) => p.clientId === cl.id);
      const r =
        cliInvoices.reduce((s, i) => s + toMGA(i.amount, i.currency), 0) ||
        cliProjects.reduce((s, p) => s + toMGA(p.revenue, p.currency), 0);
      return { cl, r };
    })
    .sort((a, b) => b.r - a.r)[0];

  const visible: Client[] = tab === "clients" ? wonClients : tab === "leads" ? leadClients : clients;

  const promote = (cl: Client) => {
    clientsStore.update(cl.id, {
      status: "client",
      acquiredAt: cl.acquiredAt ?? new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <AppShell>
      <PageHeader title="Clients" description="Leads from the pipeline and won clients — kept separate." />
      <div className="p-8 space-y-6">
        {/* High-contrast KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiTile icon={<UserCheck className="h-4 w-4" />} label="Won clients" value={String(wonClients.length)} sub={`${leadClients.length} lead${leadClients.length === 1 ? "" : "s"}`} tint="from-primary/25 to-primary/5" ring="ring-primary/30" />
          <KpiTile icon={<Wallet className="h-4 w-4" />} label="Revenue booked" value={fmtCompact(totals.revenue, "MGA")} tint="from-emerald-500/25 to-emerald-500/5" ring="ring-emerald-500/30" />
          <KpiTile icon={<AlertCircle className="h-4 w-4" />} label="Outstanding" value={fmtCompact(totals.outstanding, "MGA")} sub={`${totals.overdue} overdue`} tint="from-amber-500/25 to-amber-500/5" ring="ring-amber-500/30" />
          <KpiTile icon={<TrendingUp className="h-4 w-4" />} label="Top client" value={topClient?.cl.name ?? "—"} sub={topClient ? fmtCompact(topClient.r, "MGA") : undefined} tint="from-sky-500/25 to-sky-500/5" ring="ring-sky-500/30" />
        </div>

        <CrudToolbar count={visible.length} label={tab === "leads" ? "leads" : "clients"} onCreate={openCreate} />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="clients"><UserCheck className="h-3.5 w-3.5 mr-1.5" />Clients <span className="ml-1.5 text-[10px] opacity-70 font-tnum">{wonClients.length}</span></TabsTrigger>
            <TabsTrigger value="leads"><Sparkles className="h-3.5 w-3.5 mr-1.5" />Leads <span className="ml-1.5 text-[10px] opacity-70 font-tnum">{leadClients.length}</span></TabsTrigger>
            <TabsTrigger value="all">All <span className="ml-1.5 text-[10px] opacity-70 font-tnum">{clients.length}</span></TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="mt-4">
            {visible.length === 0 ? (
              <EmptyState label={tab === "leads" ? "leads" : "clients"} onCreate={openCreate} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visible.map((cl) => {
                  const co = companies.find((c) => c.id === cl.companyId);
                  const cliProjects = projects.filter((p) => p.clientId === cl.id);
                  const cliInvoices = invoices.filter((i) => i.clientId === cl.id);
                  const cliTx = transactions.filter((t) => t.clientId === cl.id);
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
                  const overdue = cliInvoices.some((i) => i.status === "overdue");
                  const isLead = cl.status === "lead";
                  return (
                    <div key={cl.id} className={`relative rounded-2xl border-2 ${isLead ? "border-dashed border-amber-500/40 bg-amber-500/5" : "border-border bg-surface-elevated"} p-5 hover:border-primary hover:shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_15%,transparent)] transition-all group`}>
                      {co && <div className="absolute top-0 left-5 right-5 h-1 rounded-b-full" style={{ background: co.color }} />}
                      <div className="flex items-start justify-between mb-4 gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <Avatar src={cl.avatarUrl} name={cl.name} size={48} />
                          <div className="min-w-0">
                            <div className="font-display font-semibold text-base truncate flex items-center gap-2">
                              {cl.name}
                              {isLead && <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 border border-amber-500/30 font-semibold"><Sparkles className="h-2.5 w-2.5" />Lead</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 truncate">
                              {[cl.industry, cl.country].filter(Boolean).join(" · ")}
                            </div>
                            {(cl.email || cl.phone || cl.website) && (
                              <div className="text-[11px] text-muted-foreground/80 mt-1 truncate space-x-2">
                                {cl.website && <a href={cl.website} target="_blank" rel="noopener noreferrer" className="hover:text-primary underline-offset-2 hover:underline">{cl.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a>}
                                {cl.email && <span>· {cl.email}</span>}
                                {cl.phone && <span>· {cl.phone}</span>}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {cl.acquisition && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 border border-sky-500/30 font-medium">Acq · {cl.acquisition}</span>}
                              {cl.referral && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 border border-emerald-500/30 font-medium">Ref · {cl.referral}</span>}
                              {cl.acquiredAt && !isLead && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-700 border border-violet-500/30 font-medium">Since {cl.acquisitionYear ?? cl.acquiredAt}</span>}
                              {overdue && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/40 font-semibold uppercase tracking-wider">Overdue</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {co && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-background border border-border">
                              <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                              {co.shortName}
                            </span>
                          )}
                          <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                            {isLead && (
                              <button onClick={() => promote(cl)} title="Promote to client" className="h-7 w-7 grid place-items-center rounded hover:bg-emerald-500/15 text-muted-foreground hover:text-emerald-700"><UserCheck className="h-3.5 w-3.5" /></button>
                            )}
                            <button onClick={() => { setEditing(cl); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-background text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                            <button onClick={() => confirm(`Delete ${cl.name}?`) && clientsStore.remove(cl.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                      {isLead ? (
                        <div className="rounded-xl bg-background/60 border border-dashed border-amber-500/30 p-4 mt-4 text-center text-xs text-muted-foreground">
                          Lead from the pipeline. Promote to a client when the deal is won.
                        </div>
                      ) : (
                        <div className="rounded-xl bg-background border border-border p-4 mt-4">
                          <div className="grid grid-cols-3 gap-3">
                            <StatBold label="Revenue" value={fmtCompact(revenue, "MGA")} />
                            <StatBold label="Outstanding" value={fmtCompact(outstanding, "MGA")} tone={outstanding > 0 ? "warn" : "default"} />
                            <StatBold label="Margin" value={`${margin.toFixed(0)}%`} tone={margin >= 30 ? "good" : margin >= 0 ? "default" : "bad"} />
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3 mt-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        <div>{cliInvoices.length} invoice{cliInvoices.length === 1 ? "" : "s"}</div>
                        <div>{cliTx.length} txn{cliTx.length === 1 ? "" : "s"}</div>
                        <div>{cliProjects.length} project{cliProjects.length === 1 ? "" : "s"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      <ClientDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppShell>
  );
}

function KpiTile({ icon, label, value, sub, tint, ring }: { icon: React.ReactNode; label: string; value: string; sub?: string; tint: string; ring: string }) {
  return (
    <div className={`relative rounded-2xl border-2 border-border bg-gradient-to-br ${tint} p-5 ring-1 ${ring} overflow-hidden`}>
      <div className="flex items-center justify-between mb-3">
        <div className="h-9 w-9 rounded-xl bg-background/80 backdrop-blur grid place-items-center text-foreground border border-border">{icon}</div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">{label}</div>
      <div className="font-display text-2xl font-bold tracking-tight font-tnum mt-1 truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground font-tnum mt-1">{sub}</div>}
    </div>
  );
}

function ClientDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Client | null }) {
  const companies = useCompanies();
  const acqPeople = useSalesPeople("acquisition");
  const teamMembers = useTeamMembers();
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [acquisition, setAcquisition] = useState("");
  const [referral, setReferral] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState("");
  const [contacts, setContacts] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"lead" | "client">("client");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setName(editing.name); setCountry(editing.country);
      setAcquisition(editing.acquisition ?? "");
      setReferral(editing.referral ?? "");
      setAcquiredAt(editing.acquiredAt ?? "");
      setWebsite(editing.website ?? "");
      setEmail(editing.email ?? "");
      setPhone(editing.phone ?? "");
      setAddress(editing.address ?? "");
      setIndustry(editing.industry ?? "");
      setContacts(editing.contacts ?? "");
      setAvatarUrl(editing.avatarUrl);
      setStatus(editing.status ?? "client");
    } else {
      setCompanyId(companies[0]?.id ?? ""); setName(""); setCountry(""); setAcquisition(""); setReferral("");
      setAcquiredAt(new Date().toISOString().slice(0, 10));
      setWebsite(""); setEmail(""); setPhone(""); setAddress(""); setIndustry(""); setContacts("");
      setAvatarUrl(undefined);
      setStatus("client");
    }
  }, [open, editing, companies]);

  const submit = () => {
    if (!name.trim() || !companyId) return;
    const data = {
      companyId, name, country,
      status,
      acquisition: acquisition.trim() || undefined,
      referral: referral.trim() || undefined,
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

  const refOptions = (() => {
    const names = teamMembers.map((t) => t.name).filter(Boolean);
    if (referral && !names.includes(referral)) names.push(referral);
    return Array.from(new Set(names)).sort();
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
          <div>
            <Label>Referral</Label>
            {refOptions.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-md border border-dashed border-border px-3 py-2">
                No team members yet — <Link to="/team" className="text-primary underline">add one</Link>.
              </div>
            ) : (
              <Select value={referral || "__none__"} onValueChange={(v) => setReferral(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select referral" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— None —</SelectItem>
                  {refOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground mt-1">
              Another team member credited for bringing this client. Sourced from the <Link to="/team" className="text-primary underline">Team</Link>.
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

function StatBold({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" | "bad" }) {
  const color =
    tone === "good" ? "text-emerald-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{label}</div>
      <div className={`font-display font-bold tracking-tight font-tnum mt-1 text-lg ${color}`}>{value}</div>
    </div>
  );
}
