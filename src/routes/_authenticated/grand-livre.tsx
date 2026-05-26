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
import { useCompanies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { PeriodPicker, defaultAccountingPeriod, type Period } from "@/components/period-picker";
import { exportCsvRows } from "@/lib/export-csv";
import { parseISO } from "date-fns";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Download, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/grand-livre")({ component: GrandLivrePage });

function inPeriod(date: string, p: Period) {
  const d = parseISO(date);
  return d >= p.from && d <= p.to;
}

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
  const [period, setPeriod] = useState<Period>(defaultAccountingPeriod);
  const [accountSearch, setAccountSearch] = useState("");
  const { scope } = useCompany();
  const companies = useCompanies();
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

  const filteredAccountList = useMemo(() => {
    const q = accountSearch.toLowerCase();
    if (!q) return accountList;
    return accountList.filter(
      (a) => a.code.includes(q) || a.name.toLowerCase().includes(q),
    );
  }, [accountList, accountSearch]);

  const [selected, setSelected] = useState<string>("");
  const activeCode = selected || filteredAccountList[0]?.code || "";

  const co =
    (scope.id === "company"
      ? companies.find((c) => c.id === scope.companyId)
      : companies.find((c) => c.id === "log")) ??
    companies[0] ?? { id: "_", name: "—", shortName: "—", code: "—", color: "#999", baseCurrency: "MGA" as const };

  const movements = useMemo(() => {
    const out: { date: string; piece: string; journal: string; description: string; debit: number; credit: number; partner?: string }[] = [];
    entries.forEach((e) => {
      if (!inPeriod(e.date, period)) return;
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
  }, [entries, activeCode, period]);

  const totD = movements.reduce((s, m) => s + m.debit, 0);
  const totC = movements.reduce((s, m) => s + m.credit, 0);
  const activeLabel = accountLabel(activeCode);
  const activeCls = accountClass(activeCode);

  const handleExport = () => {
    let running = 0;
    exportCsvRows(
      `grand-livre-${activeCode}-${period.label.replace(/\s/g, "-")}.csv`,
      ["Date", "Journal", "Pièce", "Description", "Débit", "Crédit", "Solde cumulé"],
      movements.map((m) => {
        running += m.debit - m.credit;
        return [m.date, m.journal, m.piece, m.description, m.debit || "", m.credit || "", running];
      }),
    );
  };

  return (
    <div className="p-8 space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <PeriodPicker value={period} onChange={setPeriod} />
        <button
          onClick={handleExport}
          disabled={movements.length === 0}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-surface hover:bg-surface-elevated text-sm transition disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Exporter CSV
        </button>
        <span className="text-xs text-muted-foreground ml-auto">
          {movements.length} mouvement{movements.length !== 1 ? "s" : ""} · {period.label}
        </span>
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-5">
        <aside className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden h-fit max-h-[75vh] flex flex-col">
          <div className="px-3 py-2 border-b border-border">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                placeholder="Rechercher un compte…"
                className="w-full h-8 pl-8 pr-3 rounded-md bg-background border border-border text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 px-0.5">
              {filteredAccountList.length} / {accountList.length} comptes
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {filteredAccountList.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground">Aucun compte trouvé.</div>
            )}
            {filteredAccountList.map((a) => (
              <button
                key={a.code}
                onClick={() => setSelected(a.code)}
                className={`w-full text-left px-4 py-2 text-sm border-b border-border/30 hover:bg-surface-elevated/50 ${
                  activeCode === a.code ? "bg-surface-elevated border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="font-tnum text-xs text-muted-foreground">
                  {a.code} {a.cls ? `· cl.${a.cls}` : ""}
                </div>
                <div className="truncate">{a.name}</div>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Compte sélectionné {activeCls ? `— ${classNames[activeCls]}` : ""}
              </div>
              <div className="font-display text-lg font-semibold">
                {activeCode} — {activeLabel}
              </div>
            </div>
            <div className="text-xs text-muted-foreground text-right shrink-0">
              <div className="font-tnum">D {fmtMoney(totD, co.baseCurrency)}</div>
              <div className="font-tnum">C {fmtMoney(totC, co.baseCurrency)}</div>
            </div>
          </div>
          <div className="max-h-[68vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--gradient-surface)] z-10">
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
                {movements.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-sm">
                      Aucun mouvement sur ce compte pour la période sélectionnée.
                    </td>
                  </tr>
                )}
                {(() => {
                  let solde = 0;
                  return movements.map((m, i) => {
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
                        <td className={`px-5 py-2 text-right font-tnum ${solde > 0 ? "text-success" : solde < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {fmtMoney(solde, co.baseCurrency)}
                        </td>
                      </tr>
                    );
                  });
                })()}
                <tr className="bg-surface-elevated/40 font-semibold sticky bottom-0">
                  <td className="px-5 py-2" colSpan={4}>Total · {period.label}</td>
                  <td className="px-5 py-2 text-right font-tnum">{fmtMoney(totD, co.baseCurrency)}</td>
                  <td className="px-5 py-2 text-right font-tnum">{fmtMoney(totC, co.baseCurrency)}</td>
                  <td className={`px-5 py-2 text-right font-tnum ${(totD - totC) > 0 ? "text-success" : (totD - totC) < 0 ? "text-destructive" : ""}`}>
                    {fmtMoney(totD - totC, co.baseCurrency)} {totD - totC >= 0 ? "D" : "C"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
