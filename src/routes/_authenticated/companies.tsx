import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useCompanies, useAccounts, useTransactions,
  companiesStore, toMGA, fmtCompact, type Company, type Currency,
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
import { AvatarUpload } from "@/components/avatar-upload";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/companies")({ component: CompaniesPage });

const PALETTE = [
  // Row 1
  "#5B5BD6", // indigo
  "#3B82F6", // blue
  "#1E9FE0", // sky
  "#16A394", // teal
  "#2EC4B6", // mint
  "#0F7A3E", // green
  "#E8A317", // amber
  "#DD6B20", // orange
  // Row 2
  "#D9342B", // red
  "#E84A8E", // pink
  "#B95FD9", // purple
  "#A88876", // taupe
  "#4D5666", // slate
  "#8593A8", // light slate
  "#1F2937", // charcoal (extra)
  "#6B7280", // gray (extra)
  // Corporate / muted
  "oklch(0.38 0.08 250)", // navy
  "oklch(0.45 0.06 250)", // steel blue
  "oklch(0.35 0.04 260)", // graphite
  "oklch(0.55 0.10 30)",  // brick
  "oklch(0.50 0.08 145)", // forest
  "oklch(0.60 0.09 85)",  // bronze
  "oklch(0.42 0.05 280)", // indigo
  "oklch(0.30 0.02 250)", // charcoal
];

function CompaniesPage() {
  const companies = useCompanies();
  const accounts = useAccounts();
  const transactions = useTransactions();
  const [editing, setEditing] = useState<Company | null>(null);
  const [open, setOpen] = useState(false);

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Company) => { setEditing(c); setOpen(true); };

  return (
    <AppShell>
      <PageHeader title="Companies" description="Group entities under your control." />
      <div className="p-8 space-y-5">
        <CrudToolbar count={companies.length} label="companies" onCreate={openCreate} />
        {companies.length === 0 ? (
          <EmptyState label="companies" onCreate={openCreate} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {companies.map((c) => {
              const cAcc = accounts.filter((a) => a.companyId === c.id);
              const cTx = transactions.filter((t) => t.companyId === c.id);
              const cash = cAcc.reduce((s, a) => s + toMGA(a.balance, a.currency), 0);
              const income = cTx.filter((t) => t.type === "income").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
              const expense = cTx.filter((t) => t.type === "expense").reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
              return (
                <div key={c.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5 hover:border-primary/40 transition group">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-10 w-10 rounded-lg grid place-items-center text-sm font-display font-bold text-primary-foreground" style={{ background: c.color }}>
                      {c.shortName}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground">Base · {c.baseCurrency}</div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition flex gap-1">
                      <button onClick={() => openEdit(c)} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => { if (confirm(`Delete ${c.name}?`)) companiesStore.remove(c.id); }} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <Row label="Cash" value={fmtCompact(cash, "MGA")} accent />
                    <Row label="Income · 30d" value={fmtCompact(income, "MGA")} />
                    <Row label="Spend · 30d" value={fmtCompact(expense, "MGA")} />
                    <Row label="Net" value={fmtCompact(income - expense, "MGA")} accent={income - expense >= 0} />
                    <Row label="Accounts" value={cAcc.length.toString()} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <CompanyDialog open={open} onOpenChange={setOpen} editing={editing} />
    </AppShell>
  );
}

function CompanyDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: Company | null }) {
  const [name, setName] = useState("");
  const [shortName, setShortName] = useState("");
  const [code, setCode] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [baseCurrency, setBaseCurrency] = useState<Currency>("MGA");
  const [legalName, setLegalName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [nif, setNif] = useState("");
  const [stat, setStat] = useState("");
  const [rcs, setRcs] = useState("");
  const [taxId, setTaxId] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankSwift, setBankSwift] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name); setShortName(editing.shortName); setCode(editing.code ?? editing.shortName); setColor(editing.color); setBaseCurrency(editing.baseCurrency);
      setLegalName(editing.legalName ?? ""); setAddress(editing.address ?? "");
      setEmail(editing.email ?? ""); setPhone(editing.phone ?? ""); setWebsite(editing.website ?? "");
      setNif(editing.nif ?? ""); setStat(editing.stat ?? ""); setRcs(editing.rcs ?? ""); setTaxId(editing.taxId ?? "");
      setBankName(editing.bankName ?? ""); setBankAccount(editing.bankAccount ?? ""); setBankSwift(editing.bankSwift ?? "");
      setLogoUrl(editing.logoUrl);
    } else {
      setName(""); setShortName(""); setCode(""); setColor(PALETTE[0]); setBaseCurrency("MGA");
      setLegalName(""); setAddress(""); setEmail(""); setPhone(""); setWebsite("");
      setNif(""); setStat(""); setRcs(""); setTaxId(""); setBankName(""); setBankAccount(""); setBankSwift("");
      setLogoUrl(undefined);
    }
  }, [open, editing]);

  const submit = () => {
    if (!name.trim() || !shortName.trim()) return;
    const finalCode = (code.trim() || shortName.trim()).toUpperCase();
    const data = {
      name, shortName, code: finalCode, color, baseCurrency,
      legalName: legalName || undefined, address: address || undefined,
      email: email || undefined, phone: phone || undefined, website: website || undefined,
      nif: nif || undefined, stat: stat || undefined, rcs: rcs || undefined, taxId: taxId || undefined,
      bankName: bankName || undefined, bankAccount: bankAccount || undefined, bankSwift: bankSwift || undefined,
      logoUrl,
    };
    if (editing) companiesStore.update(editing.id, data);
    else companiesStore.add({ id: newId("co"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-4">
            <div>
              <Label>Logo</Label>
              <div className="mt-2"><AvatarUpload value={logoUrl} onChange={setLogoUrl} name={name || "Logo"} size={72} square /></div>
              <p className="text-[10px] text-muted-foreground mt-1">Shown on invoice / PO / quote PDFs.</p>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-3">
              <div className="col-span-3"><Label>Trading name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Logia Madagascar" /></div>
              <div><Label>Short name</Label><Input value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 4))} placeholder="LOG" /></div>
              <div>
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder={shortName || "LOG"} />
                <p className="text-[10px] text-muted-foreground mt-1">Used as a compact tag across the app.</p>
              </div>
            </div>
          </div>
          <div><Label>Legal name (on invoices)</Label><Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="LOGIA SARL" /></div>
          <div><Label>Registered address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Lot II M 73 ter Antananarivo 101" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@logia.mg" /></div>
            <div><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+261 20 22 000 00" /></div>
          </div>
          <div><Label>Website</Label><Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://logia.mg" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>NIF</Label><Input value={nif} onChange={(e) => setNif(e.target.value)} /></div>
            <div><Label>STAT</Label><Input value={stat} onChange={(e) => setStat(e.target.value)} /></div>
            <div><Label>RCS</Label><Input value={rcs} onChange={(e) => setRcs(e.target.value)} /></div>
          </div>
          <div><Label>Tax / VAT ID (intl.)</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Bank name</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} /></div>
            <div><Label>Account / IBAN</Label><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} /></div>
            <div><Label>SWIFT / BIC</Label><Input value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Base currency</Label>
              <Select value={baseCurrency} onValueChange={(v) => setBaseCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MGA">MGA — Ariary</SelectItem>
                  <SelectItem value="EUR">EUR — Euro</SelectItem>
                  <SelectItem value="USD">USD — Dollar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-8 gap-2">
                  {PALETTE.slice(0, 16).map((p) => (
                    <button key={p} type="button" onClick={() => setColor(p)} className={`h-7 w-7 rounded-md border-2 transition ${color === p ? "border-foreground" : "border-transparent"}`} style={{ background: p }} />
                  ))}
                </div>
                <div className="grid grid-cols-8 gap-2">
                  {PALETTE.slice(16).map((p) => (
                    <button key={p} type="button" onClick={() => setColor(p)} className={`h-7 w-7 rounded-md border-2 transition ${color === p ? "border-foreground" : "border-transparent"}`} style={{ background: p }} />
                  ))}
                </div>
              </div>
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

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className={`font-tnum font-medium ${accent ? "text-primary font-display" : ""}`}>{value}</span>
    </div>
  );
}
