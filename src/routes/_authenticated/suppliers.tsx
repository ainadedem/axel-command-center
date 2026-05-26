import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useSuppliers, useCompanies, suppliersStore,
  type Supplier, type ContactCategory,
} from "@/lib/mock-data";
import { useJournalEntries, fmtAr } from "@/lib/pcg";
import { newId } from "@/lib/data-store";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/crud-toolbar";
import { Avatar, AvatarUpload } from "@/components/avatar-upload";
import {
  Pencil, Trash2, Building2, User, LayoutGrid, List as ListIcon,
  Search, ArrowUpDown, ChevronDown, Plus,
} from "lucide-react";
import {
  CategoryChips, CategoryMultiSelect, CategoryFilterTabs, defaultCategoriesFor,
} from "@/components/category-chips";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: SuppliersPage });

function SuppliersPage() {
  return (
    <AppShell>
      <PageHeader title="Suppliers" description="Vendors, partners, referrals and internal payees — same database, multi-category." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const suppliers = useSuppliers();
  const companies = useCompanies();
  const entries = useJournalEntries();
  const baseList = suppliers;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<ContactCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "outstanding_desc">("name_asc");
  const [group, setGroup] = useState<"none" | "company" | "category" | "kind">("none");

  // Compute outstanding payable per supplier from journal entries.
  const balances = new Map<string, number>();
  for (const s of baseList) {
    let bal = 0;
    for (const e of entries) {
      if (e.companyId !== s.companyId) continue;
      for (const l of e.lines) {
        if (l.account === s.account && (l.label || "").trim() === s.name) {
          bal += l.credit - l.debit;
        }
      }
    }
    balances.set(s.id, bal);
  }

  const tagged = baseList.map((s) => ({
    ...s,
    categories: defaultCategoriesFor("supplier", s.categories),
  }));

  const counts = useMemo(() => {
    const c: Record<ContactCategory | "all", number> = {
      all: tagged.length, client: 0, supplier: 0, referral: 0, partner: 0,
    };
    for (const s of tagged) for (const k of s.categories) c[k]++;
    return c;
  }, [tagged]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? tagged : tagged.filter((s) => s.categories.includes(filter));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        (s.country ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tagged, filter, search]);

  const sorted = useMemo(() => {
    const arr = filtered.map((s) => ({ s, bal: balances.get(s.id) ?? 0 }));
    switch (sort) {
      case "name_asc": return arr.sort((a, b) => a.s.name.localeCompare(b.s.name));
      case "name_desc": return arr.sort((a, b) => b.s.name.localeCompare(a.s.name));
      case "outstanding_desc": return arr.sort((a, b) => b.bal - a.bal);
      default: return arr;
    }
  }, [filtered, sort, balances]);

  const grouped = useMemo(() => {
    if (group === "none") return [{ key: "", label: "", items: sorted.map((s) => s.s) }];
    const map = new Map<string, Supplier[]>();
    for (const { s } of sorted) {
      let key = "";
      switch (group) {
        case "company": key = companies.find((c) => c.id === s.companyId)?.name ?? "—"; break;
        case "category": key = s.categories[0] ? (s.categories[0][0].toUpperCase() + s.categories[0].slice(1)) : "—"; break;
        case "kind": key = s.kind === "internal" ? "Internal" : "External"; break;
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, items]) => ({ key, label: key, items }));
  }, [sorted, group, companies]);

  const visibleCount = sorted.length;
  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <div className="p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search contacts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-44"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="h-8 text-xs w-36 gap-1"><ArrowUpDown className="h-3 w-3" /><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Name A-Z</SelectItem>
              <SelectItem value="name_desc">Name Z-A</SelectItem>
              <SelectItem value="outstanding_desc">Outstanding ↓</SelectItem>
            </SelectContent>
          </Select>
          <Select value={group} onValueChange={(v) => setGroup(v as typeof group)}>
            <SelectTrigger className="h-8 text-xs w-32 gap-1"><ChevronDown className="h-3 w-3" /><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No group</SelectItem>
              <SelectItem value="company">By company</SelectItem>
              <SelectItem value="category">By category</SelectItem>
              <SelectItem value="kind">By kind</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <CategoryFilterTabs value={filter} onChange={setFilter} counts={counts} />
          <div className="flex items-center border rounded-md overflow-hidden h-8">
            <button onClick={() => setView("grid")} className={`h-8 w-8 grid place-items-center ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated"}`} title="Grid view"><LayoutGrid className="h-3.5 w-3.5" /></button>
            <button onClick={() => setView("list")} className={`h-8 w-8 grid place-items-center ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-elevated"}`} title="List view"><ListIcon className="h-3.5 w-3.5" /></button>
          </div>
          <Button size="sm" onClick={openCreate} className="h-8 gap-1 text-xs"><Plus className="h-3.5 w-3.5" /> New</Button>
        </div>
        <div className="text-[11px] text-muted-foreground font-tnum">{visibleCount} contacts</div>
      </div>

      {visibleCount === 0 ? (
        <EmptyState label="contacts" onCreate={openCreate} />
      ) : view === "grid" ? (
        <SupplierGridView suppliers={sorted.map((s) => s.s)} companies={companies} balances={balances} onEdit={(s) => { setEditing(s); setOpen(true); }} group={group} grouped={grouped} />
      ) : (
        <SupplierListView suppliers={sorted.map((s) => s.s)} companies={companies} balances={balances} onEdit={(s) => { setEditing(s); setOpen(true); }} group={group} grouped={grouped} />
      )}

      <SupplierDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

/* ── Grid View ── */
function SupplierGridView({
  suppliers, companies, balances, onEdit, group, grouped,
}: {
  suppliers: Supplier[];
  companies: ReturnType<typeof useCompanies>;
  balances: Map<string, number>;
  onEdit: (s: Supplier) => void;
  group: string;
  grouped: { key: string; label: string; items: Supplier[] }[];
}) {
  if (group !== "none") {
    return (
      <div className="space-y-5">
        {grouped.map((g) => (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.label}</h3>
              <span className="text-[10px] text-muted-foreground/60 font-tnum">{g.items.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              {g.items.map((s) => (
                <SupplierCard key={s.id} s={s} companies={companies} balances={balances} onEdit={onEdit} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
      {suppliers.map((s) => (
        <SupplierCard key={s.id} s={s} companies={companies} balances={balances} onEdit={onEdit} />
      ))}
    </div>
  );
}

function SupplierCard({
  s, companies, balances, onEdit,
}: {
  s: Supplier;
  companies: ReturnType<typeof useCompanies>;
  balances: Map<string, number>;
  onEdit: (s: Supplier) => void;
}) {
  const co = companies.find((c) => c.id === s.companyId);
  const bal = balances.get(s.id) ?? 0;
  const Icon = s.kind === "internal" ? User : Building2;
  return (
    <div className="relative rounded-lg border border-border bg-surface-elevated p-3 hover:border-primary/40 transition group">
      <div className="flex items-start gap-2">
        <div className="relative shrink-0">
          <Avatar src={s.avatarUrl} name={s.name} size={32} />
          {co && <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background" style={{ background: co.color }} title={co.name} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display font-semibold text-[13px] truncate flex items-center gap-1">
            <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
            {s.name}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {[s.kind === "internal" ? "Interne" : "Externe", s.country].filter(Boolean).join(" · ")}
          </div>
          {(s.email || s.phone) && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
              {s.email} {s.phone && `· ${s.phone}`}
            </div>
          )}
          <div className="mt-1"><CategoryChips value={s.categories} /></div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(s)} className="h-6 w-6 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
          <button onClick={() => confirm(`Delete ${s.name}?`) && suppliersStore.remove(s.id)} className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
        </div>
      </div>
      <div className="mt-2 border-t border-border/50 pt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Outstanding</div>
          <div className={`font-tnum font-semibold mt-0.5 text-xs ${bal > 0 ? "text-amber-600" : "text-foreground"}`}>{fmtAr(bal)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">PCG account</div>
          <div className="font-tnum text-xs mt-0.5">{s.account}</div>
        </div>
      </div>
    </div>
  );
}

/* ── List View ── */
function SupplierListView({
  suppliers, companies, balances, onEdit, group, grouped,
}: {
  suppliers: Supplier[];
  companies: ReturnType<typeof useCompanies>;
  balances: Map<string, number>;
  onEdit: (s: Supplier) => void;
  group: string;
  grouped: { key: string; label: string; items: Supplier[] }[];
}) {
  const renderRow = (s: Supplier) => {
    const co = companies.find((c) => c.id === s.companyId);
    const bal = balances.get(s.id) ?? 0;
    const Icon = s.kind === "internal" ? User : Building2;
    return (
      <div key={s.id} className="grid grid-cols-[1fr_140px_100px_120px_40px] gap-3 px-4 py-2.5 items-center border-b border-border/50 last:border-b-0 hover:bg-accent/40 transition group">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <Avatar src={s.avatarUrl} name={s.name} size={28} />
            {co && <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-background" style={{ background: co.color }} title={co.name} />}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-[13px] truncate flex items-center gap-1">
              <Icon className="h-3 w-3 text-muted-foreground" />
              {s.name}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">{[s.country, s.email].filter(Boolean).join(" · ")}</div>
          </div>
        </div>
        <div><CategoryChips value={s.categories} size="xs" /></div>
        <div className="text-right font-tnum text-[13px] text-muted-foreground">{s.account}</div>
        <div className={`text-right font-tnum text-[13px] ${bal > 0 ? "text-amber-600" : ""}`}>{fmtAr(bal)}</div>
        <div className="flex justify-end">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(s)} className="h-6 w-6 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => confirm(`Delete ${s.name}?`) && suppliersStore.remove(s.id)} className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          </div>
        </div>
      </div>
    );
  };

  if (group !== "none") {
    return (
      <div className="rounded-xl border border-border bg-surface-elevated overflow-hidden space-y-0">
        {grouped.map((g, gi) => (
          <div key={g.key}>
            <div className={`px-4 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-background/60 ${gi > 0 ? "border-t" : ""}`}>
              {g.label} <span className="text-muted-foreground/50 font-tnum">{g.items.length}</span>
            </div>
            {g.items.map((s) => renderRow(s))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface-elevated overflow-hidden">
      <div className="grid grid-cols-[1fr_140px_100px_120px_40px] gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-background/50">
        <div>Contact</div>
        <div>Categories</div>
        <div className="text-right">PCG</div>
        <div className="text-right">Outstanding</div>
        <div />
      </div>
      {suppliers.map((s) => renderRow(s))}
    </div>
  );
}

function SupplierDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Supplier | null }) {
  const companies = useCompanies();
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [account, setAccount] = useState("401000");
  const [kind, setKind] = useState<Supplier["kind"]>("external");
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [contactPerson, setContactPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [taxId, setTaxId] = useState("");
  const [nif, setNif] = useState("");
  const [stat, setStat] = useState("");
  const [rcs, setRcs] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<ContactCategory[]>(["supplier"]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name); setCompanyId(editing.companyId); setAccount(editing.account); setKind(editing.kind);
      setAvatarUrl(editing.avatarUrl);
      setContactPerson(editing.contactPerson ?? ""); setEmail(editing.email ?? ""); setPhone(editing.phone ?? "");
      setWebsite(editing.website ?? ""); setAddress(editing.address ?? ""); setCountry(editing.country ?? "");
      setPaymentTerms(editing.paymentTerms != null ? String(editing.paymentTerms) : "");
      setTaxId(editing.taxId ?? ""); setNif(editing.nif ?? ""); setStat(editing.stat ?? ""); setRcs(editing.rcs ?? "");
      setBankName(editing.bankName ?? ""); setBankAccount(editing.bankAccount ?? ""); setBankSwift(editing.bankSwift ?? "");
      setNotes(editing.notes ?? "");
      setCategories(defaultCategoriesFor("supplier", editing.categories));
    } else {
      setName(""); setCompanyId(companies[0]?.id ?? ""); setAccount("401000"); setKind("external");
      setAvatarUrl(undefined); setContactPerson(""); setEmail(""); setPhone(""); setWebsite("");
      setAddress(""); setCountry(""); setPaymentTerms(""); setTaxId(""); setNif(""); setStat(""); setRcs("");
      setBankName(""); setBankAccount(""); setBankSwift(""); setNotes("");
      setCategories(["supplier"]);
    }
  }, [open, editing, companies]);

  function submit() {
    if (!name.trim() || !companyId) return;
    const data: Omit<Supplier, "id"> = {
      name, companyId, account, kind, avatarUrl,
      contactPerson: contactPerson || undefined, email: email || undefined, phone: phone || undefined,
      website: website || undefined, address: address || undefined, country: country || undefined,
      paymentTerms: paymentTerms ? Number(paymentTerms) : undefined,
      taxId: taxId || undefined, nif: nif || undefined, stat: stat || undefined, rcs: rcs || undefined,
      bankName: bankName || undefined, bankAccount: bankAccount || undefined, bankSwift: bankSwift || undefined,
      notes: notes || undefined,
      categories: categories.length > 0 ? categories : undefined,
    };
    if (editing) suppliersStore.update(editing.id, data);
    else suppliersStore.add({ id: newId("sup"), ...data });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-start gap-4">
            <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} name={name} size={64} square={kind === "external"} />
            <div className="flex-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Categories</Label>
            <div className="mt-1.5"><CategoryMultiSelect value={categories} onChange={setCategories} /></div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Tag this contact with one or more roles. Defaults to <span className="font-medium text-foreground">Supplier</span>.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Company</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as Supplier["kind"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="external">External (401000)</SelectItem>
                  <SelectItem value="internal">Internal (401200)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>PCG account</Label><Input value={account} onChange={(e) => setAccount(e.target.value)} /></div>
            <div><Label>Payment terms (days)</Label><Input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="30" /></div>
          </div>
          <div className="pt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Contact</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact person</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
          </div>
          <div className="pt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Legal IDs</div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>NIF</Label><Input value={nif} onChange={(e) => setNif(e.target.value)} /></div>
            <div><Label>STAT</Label><Input value={stat} onChange={(e) => setStat(e.target.value)} /></div>
            <div><Label>RCS</Label><Input value={rcs} onChange={(e) => setRcs(e.target.value)} /></div>
            <div><Label>Tax / VAT ID</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
          </div>
          <div className="pt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Bank</div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
            <div><Label>Account / IBAN</Label><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} /></div>
            <div><Label>SWIFT / BIC</Label><Input value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
