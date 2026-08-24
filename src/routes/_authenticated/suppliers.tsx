import { useCreateAction } from "@/lib/create-action";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useSuppliers, useCompanies, useClients, suppliersStore, contactCompanyIds,
  type Supplier, type ContactCategory,
} from "@/lib/mock-data";
import { upsertSupplier, deleteSupplierDb } from "@/lib/db-sync";

import { useJournalEntries, fmtAr } from "@/lib/pcg";
import { newId } from "@/lib/data-store";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { PaymentDetailsFields, paymentFrom, paymentValues, emptyPayment, type PaymentFormState } from "@/components/payment-details-fields";

import { Avatar, AvatarUpload } from "@/components/avatar-upload";
import {
  Pencil, Trash2, Building2, User, LayoutGrid, List as ListIcon,
} from "lucide-react";
import {
  CategoryChips, CategoryMultiSelect, CategoryFilterTabs, CompanyTags, defaultCategoriesFor,
} from "@/components/category-chips";
import { FormErrorBanner, invalidFieldClassName, RequiredLabel, useSingleFlightSubmit } from "@/components/form-ux";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";
import { useColumnPrefs, type ColumnDef } from "@/lib/column-prefs";
import { MasterDetail, DetailPanel, DetailSection, DetailField } from "@/components/master-detail";
import { ListTableShell, ListTable, ListHeadRow, ListTh, ListTd, ListRowActions, ListActionsTh, RowAction, ColumnPicker } from "@/components/list-table";
import { KpiCard } from "@/components/kpi-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: SuppliersPage });

function SuppliersPage() {
  return (
    <AppShell>
      <PageHeader title="Suppliers" description="Vendors, partners, referrals and internal payees — same database, multi-category." />
      <Body />
    </AppShell>
  );
}

const SUPPLIER_COLUMNS: ColumnDef[] = [
  { key: "categories", label: "Categories" },
  { key: "company", label: "Company" },
  { key: "kind", label: "Kind", priority: "optional" },
  { key: "country", label: "Country", priority: "optional" },
  { key: "email", label: "Email", priority: "optional" },
  { key: "account", label: "PCG account" },
  { key: "outstanding", label: "Outstanding" },
];

function Body() {
  const suppliers = useSuppliers();
  const clients = useClients();
  const companies = useCompanies();
  const entries = useJournalEntries();

  // Synthesize Supplier-shaped entries from clients tagged "supplier".
  // These appear automatically here so users don't double-enter contacts.
  const derived: Supplier[] = useMemo(() => {
    return clients
      .filter((c) => (c.categories ?? []).includes("supplier"))
      .map((c) => ({
        id: `client:${c.id}`,
        companyId: c.companyId,
        companyIds: contactCompanyIds(c),
        name: c.name,
        account: "401000",
        kind: "external" as const,
        avatarUrl: c.avatarUrl,
        email: c.email,
        phone: c.phone,
        website: c.website,
        address: c.address,
        country: c.country,
        taxId: c.taxId, nif: c.nif, stat: c.stat, rcs: c.rcs,
        categories: c.categories,
      }));
  }, [clients]);

  const fromClientIds = useMemo(() => new Set(derived.map((d) => d.id)), [derived]);
  const baseList = useMemo(() => {
    // Avoid duplicates if a real supplier with the same name already exists for the same primary company.
    const realKeys = new Set(suppliers.map((s) => `${s.companyId}::${s.name.toLowerCase()}`));
    const filteredDerived = derived.filter((d) => !realKeys.has(`${d.companyId}::${d.name.toLowerCase()}`));
    return [...suppliers, ...filteredDerived];
  }, [suppliers, derived]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [view, setView] = useState<"grid" | "list">("list");
  const [filter, setFilter] = useState<ContactCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Compute outstanding payable per supplier from journal entries.
  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of baseList) {
      const ids = new Set(contactCompanyIds(s));
      let bal = 0;
      for (const e of entries) {
        if (!ids.has(e.companyId)) continue;
        for (const l of e.lines) {
          if (l.account === s.account && (l.label || "").trim() === s.name) {
            bal += l.credit - l.debit;
          }
        }
      }
      map.set(s.id, bal);
    }
    return map;
  }, [baseList, entries]);

  const tagged = useMemo(
    () => baseList.map((s) => ({ ...s, categories: defaultCategoriesFor("supplier", s.categories) })),
    [baseList],
  );

  const counts = useMemo(() => {
    const c: Record<ContactCategory | "all", number> = {
      all: tagged.length, client: 0, supplier: 0, referral: 0, partner: 0,
    };
    for (const s of tagged) for (const k of s.categories) c[k]++;
    return c;
  }, [tagged]);

  const catFiltered = useMemo(
    () => (filter === "all" ? tagged : tagged.filter((s) => s.categories.includes(filter))),
    [tagged, filter],
  );

  const companyName = (s: Supplier) => companies.find((c) => c.id === s.companyId)?.shortName ?? companies.find((c) => c.id === s.companyId)?.name ?? "—";

  const fields = useMemo<FieldDef<Supplier>[]>(() => [
    { key: "name", label: "Name", type: "string", accessor: (s) => s.name },
    { key: "categories", label: "Category", type: "enum", accessor: (s) => (s.categories ?? [])[0] ?? "" },
    { key: "company", label: "Company", type: "enum", accessor: (s) => companyName(s) },
    { key: "kind", label: "Kind", type: "enum", accessor: (s) => (s.kind === "internal" ? "Internal" : "External") },
    { key: "country", label: "Country", type: "string", accessor: (s) => s.country ?? "" },
    { key: "email", label: "Email", type: "string", accessor: (s) => s.email ?? "" },
    { key: "account", label: "PCG account", type: "string", accessor: (s) => s.account },
    { key: "outstanding", label: "Outstanding", type: "number", accessor: (s) => balances.get(s.id) ?? 0, noGroup: true },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [companies, balances]);

  const dataView = useDataView<Supplier>("suppliers", fields);
  const groups = useMemo(() => dataView.apply(catFiltered), [dataView, catFiltered]);
  const rows = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const cp = useColumnPrefs("suppliers", SUPPLIER_COLUMNS);
  const colCount = 2 + 1 + cp.count;

  const kpi = useMemo(() => {
    let outstanding = 0;
    let internal = 0;
    for (const s of rows) {
      outstanding += balances.get(s.id) ?? 0;
      if (s.kind === "internal") internal++;
    }
    return { outstanding, internal };
  }, [rows, balances]);

  const openCreate = () => { setEditing(null); setOpen(true); };
  useCreateAction(openCreate);

  const selected = selectedId ? rows.find((s) => s.id === selectedId) ?? null : null;
  const detail = selected ? (
    <DetailPanel
      eyebrow={companyName(selected)}
      title={selected.name}
      subtitle={[selected.kind === "internal" ? "Internal payee" : "External vendor", selected.country].filter(Boolean).join(" · ")}
      onClose={() => setSelectedId(null)}
      actions={
        fromClientIds.has(selected.id) ? undefined : (
          <Button size="sm" className="gap-1.5" onClick={() => { setEditing(selected); setOpen(true); }}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )
      }
    >
      <DetailSection>
        <DetailField label="Outstanding" value={fmtAr(balances.get(selected.id) ?? 0)} mono />
        <DetailField label="PCG account" value={selected.account} mono />
        <DetailField label="Categories" value={<CategoryChips value={defaultCategoriesFor("supplier", selected.categories)} size="xs" />} />
        <DetailField label="Companies" value={<CompanyTags ids={contactCompanyIds(selected)} companies={companies} size="xs" />} />
      </DetailSection>
      <DetailSection title="Contact">
        <DetailField label="Contact person" value={selected.contactPerson} />
        <DetailField label="Email" value={selected.email} />
        <DetailField label="Phone" value={selected.phone} />
        <DetailField label="Website" value={selected.website} />
        <DetailField label="Address" value={selected.address} />
        <DetailField label="Payment terms" value={selected.paymentTerms != null ? `${selected.paymentTerms} days` : undefined} mono />
      </DetailSection>
      <DetailSection title="Legal IDs">
        <DetailField label="NIF" value={selected.nif} mono />
        <DetailField label="STAT" value={selected.stat} mono />
        <DetailField label="RCS" value={selected.rcs} mono />
        <DetailField label="Tax / VAT" value={selected.taxId} mono />
      </DetailSection>
      {selected.notes && (
        <DetailSection title="Notes">
          <p className="text-sm text-muted-foreground break-words">{selected.notes}</p>
        </DetailSection>
      )}
    </DetailPanel>
  ) : null;

  const removeSupplier = (s: Supplier) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    suppliersStore.remove(s.id);
    void deleteSupplierDb(s.id);
    if (selectedId === s.id) setSelectedId(null);
  };

  return (
    <div className="p-5 sm:p-10 lg:p-12">
      <MasterDetail detail={detail}>
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CrudToolbar createLabel="New supplier" count={rows.length} label="contacts" onCreate={openCreate} />
            <div className="flex items-center gap-2 flex-wrap">
              {view === "list" && <ColumnPicker prefs={cp} />}
              <DataToolbar view={dataView} items={catFiltered} />
              <div className="flex items-center rounded-full overflow-hidden h-8 bg-surface">
                <button onClick={() => setView("grid")} aria-label="Grid view" className={`h-8 w-8 grid place-items-center ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><LayoutGrid className="h-3.5 w-3.5" /></button>
                <button onClick={() => setView("list")} aria-label="List view" className={`h-8 w-8 grid place-items-center ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}><ListIcon className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Contacts" value={String(rows.length)} />
            <KpiCard label="Outstanding payable" value={fmtAr(kpi.outstanding)} tone={kpi.outstanding > 0 ? "warning" : "default"} />
            <KpiCard label="Suppliers" value={String(counts.supplier)} />
            <KpiCard label="Internal payees" value={String(kpi.internal)} />
          </div>

          <CategoryFilterTabs value={filter} onChange={setFilter} counts={counts} />

          {rows.length === 0 ? (
            <EmptyState label="contacts" onCreate={openCreate} />
          ) : view === "grid" ? (
            <SupplierGridView
              suppliers={rows}
              companies={companies}
              balances={balances}
              onEdit={(s) => { setEditing(s); setOpen(true); }}
              group={groups.length > 1 ? "on" : "none"}
              grouped={groups}
              fromClientIds={fromClientIds}
            />
          ) : (
            <ListTableShell>
              <ListTable>
                <thead>
                  <ListHeadRow>
                    <ListActionsTh />
                    <ListTh width="26%">Contact</ListTh>
                    {cp.on("categories") && <ListTh width="14%">Categories</ListTh>}
                    {cp.on("company") && <ListTh width="12%">Company</ListTh>}
                    {cp.on("kind") && <ListTh width="9%">Kind</ListTh>}
                    {cp.on("country") && <ListTh width="10%">Country</ListTh>}
                    {cp.on("email") && <ListTh width="16%">Email</ListTh>}
                    {cp.on("account") && <ListTh width="10%" align="right">PCG</ListTh>}
                    {cp.on("outstanding") && <ListTh width="13%" align="right">Outstanding</ListTh>}
                  </ListHeadRow>
                </thead>
                <tbody>
                  {groups.map((g) => (
                    <Fragment key={g.key}>
                      {groups.length > 1 && <GroupHeaderRow label={g.label} count={g.items.length} colSpan={colCount} />}
                      {g.items.map((s) => {
                        const co = companies.find((c) => c.id === s.companyId);
                        const bal = balances.get(s.id) ?? 0;
                        const Icon = s.kind === "internal" ? User : Building2;
                        const fromClient = fromClientIds.has(s.id);
                        return (
                          <tr
                            key={s.id}
                            data-selected={selectedId === s.id ? "true" : undefined}
                            onClick={() => setSelectedId(s.id)}
                            className="border-b border-border/40 last:border-0 hover:bg-surface-elevated/40 data-[selected=true]:bg-[var(--primary-container)]/40 cursor-pointer transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                          >
                            <ListRowActions colSpan={colCount}>
                              {!fromClient && (
                                <>
                                  <RowAction icon={<Pencil className="h-3.5 w-3.5" />} label="Edit" onClick={() => { setEditing(s); setOpen(true); }} />
                                  <RowAction icon={<Trash2 className="h-3.5 w-3.5" />} label="Delete" tone="danger" onClick={() => removeSupplier(s)} />
                                </>
                              )}
                            </ListRowActions>
                            <ListTd className="font-medium" title={s.name}>
                              <span className="inline-flex items-center gap-2 max-w-full">
                                <span className="relative shrink-0">
                                  <Avatar src={s.avatarUrl} name={s.name} size={22} />
                                  {co && <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full border border-background" style={{ background: co.color }} />}
                                </span>
                                <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                                <span className="truncate">{s.name}</span>
                                {fromClient && <span className="shrink-0 text-[8px] uppercase tracking-wider px-1 py-px rounded bg-accent/60 text-muted-foreground font-mono">from clients</span>}
                              </span>
                            </ListTd>
                            {cp.on("categories") && <ListTd><CategoryChips value={defaultCategoriesFor("supplier", s.categories)} size="xs" /></ListTd>}
                            {cp.on("company") && (
                              <ListTd title={co?.name}>
                                {co && <span className="inline-flex items-center gap-2 text-xs max-w-full"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: co.color }} /><span className="truncate">{co.shortName}</span></span>}
                              </ListTd>
                            )}
                            {cp.on("kind") && <ListTd className="text-xs text-muted-foreground">{s.kind === "internal" ? "Internal" : "External"}</ListTd>}
                            {cp.on("country") && <ListTd className="text-xs text-muted-foreground" title={s.country}>{s.country || <span className="text-muted-foreground/50">—</span>}</ListTd>}
                            {cp.on("email") && <ListTd className="text-xs text-muted-foreground" title={s.email}>{s.email || <span className="text-muted-foreground/50">—</span>}</ListTd>}
                            {cp.on("account") && <ListTd align="right" className="font-tnum text-muted-foreground">{s.account}</ListTd>}
                            {cp.on("outstanding") && <ListTd align="right" className={cn("font-tnum", bal > 0 && "text-warning font-medium")}>{fmtAr(bal)}</ListTd>}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </ListTable>
            </ListTableShell>
          )}

          <SupplierDialog open={open} onOpenChange={setOpen} editing={editing} />
        </div>
      </MasterDetail>
    </div>
  );
}

/* ── Grid View ── */
function SupplierGridView({
  suppliers, companies, balances, onEdit, group, grouped, fromClientIds,
}: {
  suppliers: Supplier[];
  companies: ReturnType<typeof useCompanies>;
  balances: Map<string, number>;
  onEdit: (s: Supplier) => void;
  group: string;
  grouped: { key: string; label: string; items: Supplier[] }[];
  fromClientIds: Set<string>;
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
                <SupplierCard key={s.id} s={s} companies={companies} balances={balances} onEdit={onEdit} fromClient={fromClientIds.has(s.id)} />
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
        <SupplierCard key={s.id} s={s} companies={companies} balances={balances} onEdit={onEdit} fromClient={fromClientIds.has(s.id)} />
      ))}
    </div>
  );
}

function SupplierCard({
  s, companies, balances, onEdit, fromClient,
}: {
  s: Supplier;
  companies: ReturnType<typeof useCompanies>;
  balances: Map<string, number>;
  onEdit: (s: Supplier) => void;
  fromClient?: boolean;
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
            {fromClient && <span className="ml-1 text-[8px] uppercase tracking-wider px-1 py-px rounded bg-accent/60 text-muted-foreground font-mono" title="Linked from Clients">from clients</span>}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {[s.kind === "internal" ? "Interne" : "Externe", s.country].filter(Boolean).join(" · ")}
          </div>
          {(s.email || s.phone) && (
            <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">
              {s.email} {s.phone && `· ${s.phone}`}
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1"><CategoryChips value={s.categories} /><CompanyTags ids={contactCompanyIds(s)} companies={companies} /></div>
        </div>
        {!fromClient && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(s)} aria-label="Edit" className="h-6 w-6 grid place-items-center rounded hover:bg-surface text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /></button>
            <button onClick={() => { if (confirm(`Delete ${s.name}?`)) { suppliersStore.remove(s.id); void deleteSupplierDb(s.id); } }} aria-label="Delete" className="h-6 w-6 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
          </div>
        )}
      </div>
      <div className="mt-2 border-t border-border/50 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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


function SupplierDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Supplier | null }) {
  const companies = useCompanies();
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [companyIds, setCompanyIds] = useState<string[]>([]);
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
  const [pay, setPay] = useState<PaymentFormState>(emptyPayment);
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<ContactCategory[]>(["supplier"]);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name); setCompanyId(editing.companyId); setCompanyIds(contactCompanyIds(editing)); setAccount(editing.account); setKind(editing.kind);
      setAvatarUrl(editing.avatarUrl);
      setContactPerson(editing.contactPerson ?? ""); setEmail(editing.email ?? ""); setPhone(editing.phone ?? "");
      setWebsite(editing.website ?? ""); setAddress(editing.address ?? ""); setCountry(editing.country ?? "");
      setPaymentTerms(editing.paymentTerms != null ? String(editing.paymentTerms) : "");
      setTaxId(editing.taxId ?? ""); setNif(editing.nif ?? ""); setStat(editing.stat ?? ""); setRcs(editing.rcs ?? "");
      setPay(paymentFrom(editing));
      setNotes(editing.notes ?? "");
      setCategories(defaultCategoriesFor("supplier", editing.categories));
    } else {
      const fallback = companies[0]?.id ?? "";
      setName(""); setCompanyId(fallback); setCompanyIds(fallback ? [fallback] : []); setAccount("401000"); setKind("external");
      setAvatarUrl(undefined); setContactPerson(""); setEmail(""); setPhone(""); setWebsite("");
      setAddress(""); setCountry(""); setPaymentTerms(""); setTaxId(""); setNif(""); setStat(""); setRcs("");
      setPay(emptyPayment); setNotes("");
      setCategories(["supplier"]);
    }
    setShowErrors(false);
  }, [open, editing, companies]);

  function submit() {
    const invalid = !name.trim() || !companyId;
    if (invalid) {
      setShowErrors(true);
      return;
    }
    const ids = Array.from(new Set([companyId, ...companyIds].filter(Boolean)));
    const data: Omit<Supplier, "id"> = {
      name, companyId, companyIds: ids, account, kind, avatarUrl,
      contactPerson: contactPerson || undefined, email: email || undefined, phone: phone || undefined,
      website: website || undefined, address: address || undefined, country: country || undefined,
      paymentTerms: paymentTerms ? Number(paymentTerms) : undefined,
      taxId: taxId || undefined, nif: nif || undefined, stat: stat || undefined, rcs: rcs || undefined,
      ...paymentValues(pay),
      notes: notes || undefined,
      categories: categories.length > 0 ? categories : undefined,
    };
    if (editing) {
      suppliersStore.update(editing.id, data);
      void upsertSupplier({ ...editing, ...data } as Supplier);
    } else {
      const localId = newId("sup");
      const local = { id: localId, ...data } as Supplier;
      suppliersStore.add(local);
      void upsertSupplier(local).then((dbId) => {
        if (dbId && dbId !== localId) {
          suppliersStore.replaceAll(suppliersStore.items.map((s) => s.id === localId ? { ...s, id: dbId } : s));
        }
      });
    }
    onOpenChange(false);
  }
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <FormErrorBanner show={showErrors} />
          <div className="flex items-start gap-4">
            <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} name={name} size={64} square={kind === "external"} />
            <div className="flex-1">
              <Label><RequiredLabel>Name</RequiredLabel></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className={invalidFieldClassName(showErrors && !name.trim())} aria-invalid={showErrors && !name.trim()} />
            </div>
          </div>
          <div>
            <Label><RequiredLabel>Categories</RequiredLabel></Label>
            <div className="mt-1.5"><CategoryMultiSelect value={categories} onChange={setCategories} /></div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Tag this contact with one or more roles. Defaults to <span className="font-medium text-foreground">Supplier</span>.</p>
          </div>
          <div>
            <Label><RequiredLabel>Linked companies</RequiredLabel></Label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {companies.map((c) => {
                const active = companyIds.includes(c.id);
                const isPrimary = c.id === companyId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (active) {
                        if (isPrimary) return;
                        setCompanyIds(companyIds.filter((x) => x !== c.id));
                      } else {
                        const next = [...companyIds, c.id];
                        setCompanyIds(next);
                        if (!companyId) setCompanyId(c.id);
                      }
                    }}
                    onDoubleClick={() => active && setCompanyId(c.id)}
                    title={isPrimary ? "Primary company" : active ? "Double-click to make primary" : "Click to link"}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider px-2 py-1 rounded-full border transition ${active ? "border-primary bg-primary/10 text-foreground" : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                    {c.code || c.shortName}
                    {isPrimary && <span className="text-[9px] text-primary">★</span>}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Click to link, double-click to set primary (★).</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>PCG account</Label><Input value={account} onChange={(e) => setAccount(e.target.value)} /></div>
            <div><Label>Payment terms (days)</Label><Input type="number" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="30" /></div>
          </div>
          <div className="pt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Contact</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Contact person</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div><Label>Country</Label><Input value={country} onChange={(e) => setCountry(e.target.value)} /></div>
          </div>
          <div className="pt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Legal IDs</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>NIF</Label><Input value={nif} onChange={(e) => setNif(e.target.value)} /></div>
            <div><Label>STAT</Label><Input value={stat} onChange={(e) => setStat(e.target.value)} /></div>
            <div><Label>RCS</Label><Input value={rcs} onChange={(e) => setRcs(e.target.value)} /></div>
            <div><Label>Tax / VAT ID</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
          </div>
          <PaymentDetailsFields value={pay} onChange={setPay} />
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{editing ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
