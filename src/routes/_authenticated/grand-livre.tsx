import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import {
  useJournalEntries,
  accountLabel,
  accountClass,
  classNames,
  fmtMoney,
  fmtDateFR,
  usesPcg,
  seedLogiaGrandLivre,
} from "@/lib/pcg";
import { companies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/grand-livre")({ component: GrandLivrePage });

function GrandLivrePage() {
  return (
    <AppShell>
      <PageHeader
        title="Grand-livre"
        description="Détail des écritures par compte — PCG Madagascar 2005."
        actions={
          <button
            onClick={() => {
              const n = seedLogiaGrandLivre(true);
              toast.success(`Grand-livre Logia rechargé (${n} écritures)`);
            }}
            className="text-xs px-3 py-1.5 rounded-md border border-border hover:bg-surface-elevated"
          >
            Recharger depuis Drive
          </button>
        }
      />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const allEntries = useJournalEntries();
  const entries = useMemo(
    () =>
      allEntries.filter((e) => {
        if (!usesPcg(e.companyId)) return false;
        if (scope.id === "company" && scope.companyId !== e.companyId) return false;
        return true;
      }),
    [allEntries, scope],
  );

  const accountList = useMemo(() => {
    const used = new Map<string, string>();
    entries.forEach((e) =>
      e.lines.forEach((l) => {
        if (!used.has(l.account)) used.set(l.account, accountLabel(l.account));
      }),
    );
    return Array.from(used.entries())
      .map(([code, name]) => ({ code, name, cls: accountClass(code) }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [entries]);

  const [selected, setSelected] = useState<string>("");
  const activeCode = selected || accountList[0]?.code || "";
  const co =
    (scope.id === "company"
      ? companies.find((c) => c.id === scope.companyId)
      : companies.find((c) => c.id === "log")) ??
    companies[0] ?? { id: "_", name: "—", shortName: "—", color: "#999", baseCurrency: "MGA" as const };

  const movements = useMemo(() => {
    const out: { date: string; piece: string; journal: string; description: string; debit: number; credit: number; partner?: string }[] = [];
    entries.forEach((e) => {
      e.lines.forEach((l) => {
        if (l.account === activeCode) {
          out.push({
            date: e.date,
            piece: e.piece,
            journal: e.journal,
            description: e.description,
            debit: l.debit,
            credit: l.credit,
            partner: l.label,
          });
        }
      });
    });
    out.sort((a, b) => a.date.localeCompare(b.date) || a.piece.localeCompare(b.piece));
    return out;
  }, [entries, activeCode]);

  let solde = 0;
  const totD = movements.reduce((s, m) => s + m.debit, 0);
  const totC = movements.reduce((s, m) => s + m.credit, 0);
  const activeLabel = accountLabel(activeCode);
  const activeCls = accountClass(activeCode);

  return (
    <div className="p-8 grid grid-cols-[280px_1fr] gap-5">
      <aside className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden h-fit max-h-[75vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Comptes mouvementés ({accountList.length})
        </div>
        {accountList.length === 0 && (
          <div className="px-4 py-6 text-sm text-muted-foreground">Aucune écriture.</div>
        )}
        {accountList.map((a) => (
          <button
            key={a.code}
            onClick={() => setSelected(a.code)}
            className={`w-full text-left px-4 py-2 text-sm border-b border-border/30 hover:bg-surface-elevated/50 ${
              activeCode === a.code ? "bg-surface-elevated" : ""
            }`}
          >
            <div className="font-tnum text-xs text-muted-foreground">
              {a.code} {a.cls ? `· cl.${a.cls}` : ""}
            </div>
            <div className="truncate">{a.name}</div>
          </button>
        ))}
      </aside>

      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            Compte sélectionné {activeCls ? `— ${classNames[activeCls]}` : ""}
          </div>
          <div className="font-display text-lg font-semibold">
            {activeCode} — {activeLabel}
          </div>
        </div>
        <div className="max-h-[68vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--gradient-surface)]">
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-5 py-2 w-28">Date</th>
                <th className="text-left font-medium px-5 py-2 w-16">Jrnl</th>
                <th className="text-left font-medium px-5 py-2 w-40">Pièce</th>
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
                    <td className="px-5 py-2">
                      <div className="truncate">{m.description}</div>
                      {m.partner && (
                        <div className="text-[11px] text-muted-foreground truncate">{m.partner}</div>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right font-tnum">{m.debit ? fmtMoney(m.debit, co.baseCurrency) : ""}</td>
                    <td className="px-5 py-2 text-right font-tnum">{m.credit ? fmtMoney(m.credit, co.baseCurrency) : ""}</td>
                    <td className="px-5 py-2 text-right font-tnum text-muted-foreground">
                      {fmtMoney(solde, co.baseCurrency)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-surface-elevated/40 font-semibold sticky bottom-0">
                <td className="px-5 py-2" colSpan={4}>
                  Total
                </td>
                <td className="px-5 py-2 text-right font-tnum">{fmtMoney(totD, co.baseCurrency)}</td>
                <td className="px-5 py-2 text-right font-tnum">{fmtMoney(totC, co.baseCurrency)}</td>
                <td className="px-5 py-2 text-right font-tnum">
                  {fmtMoney(totD - totC, co.baseCurrency)} {totD - totC >= 0 ? "D" : "C"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
