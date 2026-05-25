import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useSuppliers, useCompanies, suppliersStore,
  type Supplier,
} from "@/lib/mock-data";
import { useJournalEntries, fmtAr } from "@/lib/pcg";
import { newId } from "@/lib/data-store";
import { inScope, useCompany } from "@/lib/company-context";
import { Fragment, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Avatar, AvatarUpload } from "@/components/avatar-upload";
import { Pencil, Trash2, Building2, User } from "lucide-react";
import { useDataView, type FieldDef } from "@/hooks/use-data-view";
import { DataToolbar, GroupHeaderRow } from "@/components/data-toolbar";

export const Route = createFileRoute("/_authenticated/suppliers")({ component: SuppliersPage });

function SuppliersPage() {
  return (
    <AppShell>
      <PageHeader title="Fournisseurs" description="Vendors and internal payees derived from the Grand-livre (401xxx)." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const suppliers = useSuppliers();
  const companies = useCompanies();
  const entries = useJournalEntries();
  const list = inScope(suppliers, scope);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  // Compute outstanding payable per supplier from journal entries (credit - debit on 401xxx).
  const balances = new Map<string, number>();
  for (const s of list) {
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

  return (
    <div className="p-8 space-y-5">
      <CrudToolbar count={list.length} label="suppliers" onCreate={() => { setEditing(null); setOpen(true); }} />
      {list.length === 0 ? (
        <EmptyState label="suppliers" onCreate={() => { setEditing(null); setOpen(true); }} />
      ) : (
        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-elevated/40 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Supplier</th>
                <th className="text-left px-4 py-3 font-medium">Kind</th>
                <th className="text-left px-4 py-3 font-medium">PCG account</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-right px-4 py-3 font-medium">Outstanding</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const co = companies.find((c) => c.id === s.companyId);
                const bal = balances.get(s.id) ?? 0;
                const Icon = s.kind === "internal" ? User : Building2;
                return (
                  <tr key={s.id} className="border-t border-border/60 hover:bg-surface-elevated/30 group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar src={s.avatarUrl} name={s.name} size={32} />
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{s.kind === "internal" ? "Interne" : "Externe"}</td>
                    <td className="px-4 py-3 font-tnum text-muted-foreground">{s.account}</td>
                    <td className="px-4 py-3">
                      {co && (
                        <span className="inline-flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 rounded-full" style={{ background: co.color }} />
                          {co.shortName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-tnum">{fmtAr(bal)}</td>
                    <td className="px-4 py-3">
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 justify-end">
                        <button onClick={() => { setEditing(s); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => confirm(`Delete ${s.name}?`) && suppliersStore.remove(s.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <SupplierDialog open={open} onOpenChange={setOpen} editing={editing} />
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
    } else {
      setName(""); setCompanyId(companies[0]?.id ?? ""); setAccount("401000"); setKind("external");
      setAvatarUrl(undefined); setContactPerson(""); setEmail(""); setPhone(""); setWebsite("");
      setAddress(""); setCountry(""); setPaymentTerms(""); setTaxId(""); setNif(""); setStat(""); setRcs("");
      setBankName(""); setBankAccount(""); setBankSwift(""); setNotes("");
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
    };
    if (editing) suppliersStore.update(editing.id, data);
    else suppliersStore.add({ id: newId("sup"), ...data });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-start gap-4">
            <AvatarUpload value={avatarUrl} onChange={setAvatarUrl} name={name} size={64} square={kind === "external"} />
            <div className="flex-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
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
