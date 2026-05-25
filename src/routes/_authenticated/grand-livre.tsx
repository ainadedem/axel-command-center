import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { journalEntries, pcgAccounts, pcgIndex, fmtMoney, fmtDateFR, usesPcg } from "@/lib/pcg";
import { companies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/grand-livre")({ component: GrandLivrePage });

function GrandLivrePage() {
  return (
    <AppShell>
      <PageHeader title="Grand-livre" description="Détail des écritures par compte — PCG Madagascar 2005." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const entries = useMemo(() => journalEntries.filter((e) => {
    if (!usesPcg(e.companyId)) return false;
    if (scope.id === "company" && scope.companyId !== e.companyId) return false;
    return true;
  }), [scope]);

  const usedCodes = new Set<string>();
  entries.forEach((e) => e.lines.forEach((l) => usedCodes.add(l.account)));
  const accountList = pcgAccounts.filter((a) => usedCodes.has(a.code)).sort((a, b) => a.code.localeCompare(b.code));
  const [selected, setSelected] = useState(accountList[0]?.code ?? "");
  const co = scope.id === "company" ? companies.find((c) => c.id === scope.companyId)! : companies.find((c) => c.id === "log")!;

  // Build movements for the selected account, in chronological order
  const movements: { date: string; piece: string; journal: string; description: string; debit: number; credit: number; coId: string }[] = [];
  entries.forEach((e) => {
    e.lines.forEach((l) => {
      if (l.account === selected) {
        movements.push({
          date: e.date, piece: e.piece, journal: e.journal, description: e.description,
          debit: l.debit, credit: l.credit, coId: e.companyId,
        });
      }
    });
  });
  movements.sort((a, b) => a.date.localeCompare(b.date));

  let solde = 0;
  const totD = movements.reduce((s, m) => s + m.debit, 0);
  const totC = movements.reduce((s, m) => s + m.credit, 0);

  return (
    <div className="p-8 grid grid-cols-[260px_1fr] gap-5">
      <aside className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden h-fit max-h-[70vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Comptes mouvementés
        </div>
        {accountList.map((a) => (
          <button
            key={a.code}
            onClick={() => setSelected(a.code)}
            className={`w-full text-left px-4 py-2 text-sm border-b border-border/30 hover:bg-surface-elevated/50 ${selected === a.code ? "bg-surface-elevated" : ""}`}
          >
            <div className="font-tnum text-xs text-muted-foreground">{a.code}</div>
            <div className="truncate">{a.name}</div>
          </button>
        ))}
      </aside>

      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Compte sélectionné</div>
          <div className="font-display text-lg font-semibold">
            {selected} — {pcgIndex.get(selected)?.name}
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="text-left font-medium px-5 py-2 w-28">Date</th>
              <th className="text-left font-medium px-5 py-2 w-20">Jrnl</th>
              <th className="text-left font-medium px-5 py-2 w-32">Pièce</th>
              <th className="text-left font-medium px-5 py-2">Libellé</th>
              <th className="text-right font-medium px-5 py-2 w-32">Débit</th>
              <th className="text-right font-medium px-5 py-2 w-32">Crédit</th>
              <th className="text-right font-medium px-5 py-2 w-32">Solde</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m, i) => {
              solde += m.debit - m.credit;
              return (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="px-5 py-2 font-tnum">{fmtDateFR(m.date)}</td>
                  <td className="px-5 py-2 text-xs">{m.journal}</td>
                  <td className="px-5 py-2 text-xs text-muted-foreground">{m.piece}</td>
                  <td className="px-5 py-2 truncate">{m.description}</td>
                  <td className="px-5 py-2 text-right font-tnum">{m.debit ? fmtMoney(m.debit, co.baseCurrency) : ""}</td>
                  <td className="px-5 py-2 text-right font-tnum">{m.credit ? fmtMoney(m.credit, co.baseCurrency) : ""}</td>
                  <td className="px-5 py-2 text-right font-tnum text-muted-foreground">{fmtMoney(solde, co.baseCurrency)}</td>
                </tr>
              );
            })}
            <tr className="bg-surface-elevated/40 font-semibold">
              <td className="px-5 py-2" colSpan={4}>Total</td>
              <td className="px-5 py-2 text-right font-tnum">{fmtMoney(totD, co.baseCurrency)}</td>
              <td className="px-5 py-2 text-right font-tnum">{fmtMoney(totC, co.baseCurrency)}</td>
              <td className="px-5 py-2 text-right font-tnum">{fmtMoney(totD - totC, co.baseCurrency)} {totD - totC >= 0 ? "D" : "C"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
