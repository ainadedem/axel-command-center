import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useJournalEntries, journalEntriesStore, journals, pcgAccounts, pcgIndex,
  fmtMoney, fmtDateFR, usesPcg, type JournalEntry, type JournalLine,
} from "@/lib/pcg";
import { useCompanies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { newId } from "@/lib/data-store";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CrudToolbar, EmptyState } from "@/components/crud-toolbar";
import { Pencil, Trash2, Plus, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/journal")({ component: JournalPage });

function JournalPage() {
  return (
    <AppShell>
      <PageHeader title="Journal" description="Écritures comptables en partie double — PCG Madagascar 2005." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const journalEntries = useJournalEntries();
  const companies = useCompanies();
  const [journalFilter, setJournalFilter] = useState<string>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);

  const entries = journalEntries.filter((e) => {
    if (!usesPcg(e.companyId)) return false;
    if (scope.id === "company" && scope.companyId !== e.companyId) return false;
    if (journalFilter !== "ALL" && e.journal !== journalFilter) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalDebit = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0);
  const openCreate = () => { setEditing(null); setOpen(true); };

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setJournalFilter("ALL")} className={`h-8 px-3 rounded-md text-xs border ${journalFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border"}`}>
            Tous les journaux
          </button>
          {journals.map((j) => (
            <button key={j.code} onClick={() => setJournalFilter(j.code)} className={`h-8 px-3 rounded-md text-xs border ${journalFilter === j.code ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border"}`} title={j.name}>
              {j.code}
            </button>
          ))}
        </div>
        <CrudToolbar count={entries.length} label={`écritures · Total débit ≈ ${totalDebit.toLocaleString("fr-FR")}`} onCreate={openCreate} />
      </div>

      {entries.length === 0 ? (
        <EmptyState label="journal entries" onCreate={openCreate} />
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const co = companies.find((c) => c.id === e.companyId);
            const tot = e.lines.reduce((s, l) => s + l.debit, 0);
            const equilibre = tot === e.lines.reduce((s, l) => s + l.credit, 0);
            return (
              <div key={e.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden group">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                  <span className="h-6 px-2 rounded text-[10px] font-bold tracking-wider grid place-items-center bg-surface-elevated">{e.journal}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.description}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span>Pièce {e.piece}</span><span>·</span><span>{fmtDateFR(e.date)}</span>
                      {co && (<><span>·</span><span className="inline-flex items-center gap-1.5 font-mono" title={co.name}><span className="h-1.5 w-1.5 rounded-full" style={{ background: co.color }} />{co.code || co.shortName}</span></>)}
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${equilibre ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" : "text-red-600 bg-red-50"}`}>
                    {equilibre ? "Équilibrée" : "Déséquilibrée"}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button onClick={() => { setEditing(e); setOpen(true); }} className="h-7 w-7 grid place-items-center rounded hover:bg-surface-elevated text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => confirm(`Supprimer l'écriture ${e.piece} ?`) && journalEntriesStore.remove(e.id)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="text-left font-medium px-5 py-2 w-24">Compte</th>
                      <th className="text-left font-medium px-5 py-2">Libellé</th>
                      <th className="text-right font-medium px-5 py-2 w-36">Débit</th>
                      <th className="text-right font-medium px-5 py-2 w-36">Crédit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.lines.map((l, i) => {
                      const acc = pcgIndex.get(l.account);
                      return (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="px-5 py-2 font-tnum">{l.account}</td>
                          <td className="px-5 py-2">
                            <span className="text-muted-foreground">{acc?.name ?? "—"}</span>
                            {l.label && <span className="ml-2 text-xs">· {l.label}</span>}
                          </td>
                          <td className="px-5 py-2 text-right font-tnum">{l.debit ? fmtMoney(l.debit, co?.baseCurrency ?? "MGA") : ""}</td>
                          <td className="px-5 py-2 text-right font-tnum">{l.credit ? fmtMoney(l.credit, co?.baseCurrency ?? "MGA") : ""}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-surface-elevated/40">
                      <td className="px-5 py-2"></td>
                      <td className="px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                      <td className="px-5 py-2 text-right font-tnum font-semibold">{fmtMoney(tot, co?.baseCurrency ?? "MGA")}</td>
                      <td className="px-5 py-2 text-right font-tnum font-semibold">{fmtMoney(tot, co?.baseCurrency ?? "MGA")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      <JournalEntryDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}

function emptyLine(): JournalLine { return { account: "", label: "", debit: 0, credit: 0 }; }

function JournalEntryDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (v: boolean) => void; editing: JournalEntry | null }) {
  const companies = useCompanies();
  const pcgCompanies = companies.filter((c) => usesPcg(c.id));
  const [companyId, setCompanyId] = useState("");
  const [journal, setJournal] = useState("VTE");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [piece, setPiece] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<JournalLine[]>([emptyLine(), emptyLine()]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setCompanyId(editing.companyId); setJournal(editing.journal); setDate(editing.date);
      setPiece(editing.piece); setDescription(editing.description);
      setLines(editing.lines.map((l) => ({ ...l })));
    } else {
      setCompanyId(pcgCompanies[0]?.id ?? ""); setJournal("VTE"); setDate(new Date().toISOString().slice(0, 10));
      setPiece(`P-${Date.now().toString().slice(-6)}`); setDescription("");
      setLines([emptyLine(), emptyLine()]);
    }
  }, [open, editing, companies]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  const updateLine = (i: number, patch: Partial<JournalLine>) => {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const submit = () => {
    if (!companyId || !description.trim() || !balanced) return;
    const cleaned = lines.filter((l) => l.account && (l.debit > 0 || l.credit > 0));
    if (cleaned.length < 2) return;
    const data = { companyId, journal, date, piece, description, lines: cleaned };
    if (editing) journalEntriesStore.update(editing.id, data);
    else journalEntriesStore.add({ id: newId("je"), ...data });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{editing ? "Modifier l'écriture" : "Nouvelle écriture"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Société</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Société" /></SelectTrigger>
                <SelectContent>{pcgCompanies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Journal</Label>
              <Select value={journal} onValueChange={setJournal}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{journals.map((j) => <SelectItem key={j.code} value={j.code}>{j.code} — {j.name.replace("Journal ", "")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><Label>N° pièce</Label><Input value={piece} onChange={(e) => setPiece(e.target.value)} /></div>
          </div>
          <div><Label>Libellé</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Facture client — Octobre" /></div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground bg-surface-elevated/40">
              <div className="col-span-3">Compte PCG</div>
              <div className="col-span-4">Libellé</div>
              <div className="col-span-2 text-right">Débit</div>
              <div className="col-span-2 text-right">Crédit</div>
              <div className="col-span-1" />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-t border-border/40 items-center">
                <div className="col-span-3">
                  <Select value={l.account} onValueChange={(v) => updateLine(i, { account: v })}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Compte" /></SelectTrigger>
                    <SelectContent className="max-h-[260px]">
                      {pcgAccounts.map((a) => <SelectItem key={a.code} value={a.code}>{a.code} — {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4"><Input className="h-8" value={l.label ?? ""} onChange={(e) => updateLine(i, { label: e.target.value })} placeholder="auxiliaire" /></div>
                <div className="col-span-2"><Input className="h-8 text-right font-tnum" type="number" value={l.debit || ""} onChange={(e) => updateLine(i, { debit: Number(e.target.value) || 0, credit: 0 })} /></div>
                <div className="col-span-2"><Input className="h-8 text-right font-tnum" type="number" value={l.credit || ""} onChange={(e) => updateLine(i, { credit: Number(e.target.value) || 0, debit: 0 })} /></div>
                <div className="col-span-1 text-right">
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setLines((ls) => [...ls, emptyLine()])} className="w-full text-xs px-3 py-2 border-t border-border/40 hover:bg-surface-elevated/40 inline-flex items-center justify-center gap-1.5 text-muted-foreground">
              <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
            </button>
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <div className="text-muted-foreground">Total débit · <span className="font-tnum text-foreground">{totalDebit.toLocaleString("fr-FR")}</span> &nbsp;|&nbsp; Total crédit · <span className="font-tnum text-foreground">{totalCredit.toLocaleString("fr-FR")}</span></div>
            <span className={`uppercase tracking-wider px-2 py-1 rounded ${balanced ? "text-emerald-600 bg-emerald-500/10" : "text-destructive bg-destructive/10"}`}>
              {balanced ? "Équilibrée" : "Déséquilibrée"}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={!balanced}>{editing ? "Enregistrer" : "Créer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
