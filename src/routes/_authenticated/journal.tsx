import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { journalEntries, journals, pcgIndex, fmtMoney, fmtDateFR, usesPcg } from "@/lib/pcg";
import { companies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { useState } from "react";

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
  const [journalFilter, setJournalFilter] = useState<string>("ALL");

  const entries = journalEntries.filter((e) => {
    if (!usesPcg(e.companyId)) return false;
    if (scope.id === "company" && scope.companyId !== e.companyId) return false;
    if (journalFilter !== "ALL" && e.journal !== journalFilter) return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const totalDebit = entries.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0);

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setJournalFilter("ALL")}
          className={`h-8 px-3 rounded-md text-xs border ${journalFilter === "ALL" ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border"}`}
        >
          Tous les journaux
        </button>
        {journals.map((j) => (
          <button
            key={j.code}
            onClick={() => setJournalFilter(j.code)}
            className={`h-8 px-3 rounded-md text-xs border ${journalFilter === j.code ? "bg-primary text-primary-foreground border-primary" : "bg-surface border-border"}`}
            title={j.name}
          >
            {j.code} — {j.name.replace("Journal ", "").replace(/^d['eée] /, "")}
          </button>
        ))}
        <div className="ml-auto text-xs text-muted-foreground">
          {entries.length} écritures · Total débit ≈ {totalDebit.toLocaleString("fr-FR")}
        </div>
      </div>

      <div className="space-y-3">
        {entries.map((e) => {
          const co = companies.find((c) => c.id === e.companyId)!;
          const tot = e.lines.reduce((s, l) => s + l.debit, 0);
          const equilibre = tot === e.lines.reduce((s, l) => s + l.credit, 0);
          return (
            <div key={e.id} className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-border">
                <span className="h-6 px-2 rounded text-[10px] font-bold tracking-wider grid place-items-center bg-surface-elevated">
                  {e.journal}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.description}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span>Pièce {e.piece}</span>
                    <span>·</span>
                    <span>{fmtDateFR(e.date)}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: co.color }} />
                      {co.name}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${equilibre ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" : "text-red-600 bg-red-50"}`}>
                  {equilibre ? "Équilibrée" : "Déséquilibrée"}
                </span>
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
                        <td className="px-5 py-2 text-right font-tnum">{l.debit ? fmtMoney(l.debit, co.baseCurrency) : ""}</td>
                        <td className="px-5 py-2 text-right font-tnum">{l.credit ? fmtMoney(l.credit, co.baseCurrency) : ""}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-surface-elevated/40">
                    <td className="px-5 py-2"></td>
                    <td className="px-5 py-2 text-xs uppercase tracking-wider text-muted-foreground">Total</td>
                    <td className="px-5 py-2 text-right font-tnum font-semibold">{fmtMoney(tot, co.baseCurrency)}</td>
                    <td className="px-5 py-2 text-right font-tnum font-semibold">{fmtMoney(tot, co.baseCurrency)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          );
        })}
        {entries.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-12 border border-dashed border-border rounded-xl">
            Aucune écriture pour ce filtre.
          </div>
        )}
      </div>
    </div>
  );
}
