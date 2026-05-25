import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useCompanies, useAccounts, useTransactions,
  companiesStore, toMGA, fmtCompact, type Company, type Currency,
} from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/companies")({ component: CompaniesPage });

const PALETTE = [
  "oklch(0.78 0.14 165)", "oklch(0.72 0.13 220)", "oklch(0.78 0.13 75)",
  "oklch(0.72 0.18 25)", "oklch(0.72 0.15 300)", "oklch(0.78 0.13 130)",
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
  const [color, setColor] = useState(PALETTE[0]);
  const [baseCurrency, setBaseCurrency] = useState<Currency>("MGA");

  // sync when dialog opens
  if (open && editing && name !== editing.name && shortName !== editing.shortName) {
    setName(editing.name); setShortName(editing.shortName); setColor(editing.color); setBaseCurrency(editing.baseCurrency);
  }

  const reset = () => { setName(""); setShortName(""); setColor(PALETTE[0]); setBaseCurrency("MGA"); };

  const submit = () => {
    if (!name.trim() || !shortName.trim()) return;
    if (editing) companiesStore.update(editing.id, { name, shortName, color, baseCurrency });
    else companiesStore.add({ id: newId("co"), name, shortName, color, baseCurrency });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Logia Madagascar" /></div>
          <div><Label>Short name</Label><Input value={shortName} onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 4))} placeholder="LOG" /></div>
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
            <div className="flex gap-2 mt-2">
              {PALETTE.map((p) => (
                <button key={p} type="button" onClick={() => setColor(p)} className={`h-8 w-8 rounded-md border-2 transition ${color === p ? "border-foreground" : "border-transparent"}`} style={{ background: p }} />
              ))}
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
