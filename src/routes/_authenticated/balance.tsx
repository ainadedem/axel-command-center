import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useJournalEntries, pcgAccounts, pcgIndex, fmtMoney, usesPcg, classNames, type PcgClass } from "@/lib/pcg";
import { useCompanies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { PeriodPicker, defaultPeriod, type Period } from "@/components/period-picker";
import { exportCsvRows } from "@/lib/export-csv";
import { parseISO } from "date-fns";
import { useState, useMemo } from "react";
import { Download, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/balance")({ component: BalancePage });

function inPeriod(date: string, p: Period) {
  const d = parseISO(date);
  return d >= p.from && d <= p.to;
}

function BalancePage() {
  return (
    <AppShell>
      <PageHeader title="Balance générale" description="Totaux débit / crédit et solde par compte — PCG Madagascar 2005." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const [period, setPeriod] = useState<Period>(defaultPeriod);
  const { scope } = useCompany();
  const companies = useCompanies();
  const allEntries = useJournalEntries();

  const entries = useMemo(() =>
    allEntries.filter((e) => {
      if (!usesPcg(e.companyId)) return false;
      if (scope.id === "company" && scope.companyId !== e.companyId) return false;
      if (!inPeriod(e.date, period)) return false;
      return true;
    }), [allEntries, scope, period]);

  const totals = useMemo(() => {
    const map = new Map<string, { debit: number; credit: number }>();
    entries.forEach((e) => {
      e.lines.forEach((l) => {
        const cur = map.get(l.account) ?? { debit: 0, credit: 0 };
        cur.debit += l.debit;
        cur.credit += l.credit;
        map.set(l.account, cur);
      });
    });
    return map;
  }, [entries]);

  const displayCo = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId) ?? companies.find((c) => c.id === "log")!
    : companies.find((c) => c.id === "log")!;

  const rows = pcgAccounts
    .filter((a) => totals.has(a.code))
    .sort((a, b) => a.code.localeCompare(b.code));

  let totD = 0, totC = 0;
  rows.forEach((a) => { const t = totals.get(a.code)!; totD += t.debit; totC += t.credit; });
  const balanced = Math.round(totD - totC) === 0;

  const byClass = useMemo(() => {
    const map = new Map<PcgClass, typeof rows>();
    rows.forEach((a) => {
      if (!map.has(a.class)) map.set(a.class, []);
      map.get(a.class)!.push(a);
    });
    return map;
  }, [rows]);

  const handleExport = () => {
    exportCsvRows(
      `balance-${period.label.replace(/\s/g, "-")}.csv`,
      ["Compte", "Libellé", "Débit", "Crédit", "Solde"],
      rows.map((a) => {
        const t = totals.get(a.code)!;
        return [a.code, pcgIndex.get(a.code)?.name ?? a.code, t.debit, t.credit, t.debit - t.credit];
      }),
    );
  };

  return (
    <div className="p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PeriodPicker value={period} onChange={setPeriod} />
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-surface hover:bg-surface-elevated text-sm transition"
        >
          <Download className="h-4 w-4" /> Exporter CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total débit" value={fmtMoney(totD, displayCo.baseCurrency)} />
        <StatCard label="Total crédit" value={fmtMoney(totC, displayCo.baseCurrency)} />
        <StatCard
          label="Équilibre"
          value={balanced ? "✓ Équilibrée" : `Écart ${fmtMoney(totD - totC, displayCo.baseCurrency)}`}
          ok={balanced}
        />
      </div>

      {/* Equilibrium visual indicator */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${balanced ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
        {balanced
          ? <><CheckCircle2 className="h-4 w-4" /> La balance est équilibrée — total débit = total crédit sur la période.</>
          : <><AlertTriangle className="h-4 w-4" /> Déséquilibre détecté : écart de {fmtMoney(Math.abs(totD - totC), displayCo.baseCurrency)}. Vérifier les écritures de la période.</>
        }
      </div>

      {([1, 2, 3, 4, 5, 6, 7] as PcgClass[]).map((cls) => {
        const list = byClass.get(cls);
        if (!list?.length) return null;
        const subD = list.reduce((s, a) => s + (totals.get(a.code)?.debit ?? 0), 0);
        const subC = list.reduce((s, a) => s + (totals.get(a.code)?.credit ?? 0), 0);
        return (
          <div key={cls} className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Classe {cls}</div>
              <div className="font-display text-base font-semibold">{classNames[cls]}</div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-medium px-5 py-2 w-24">Compte</th>
                  <th className="text-left font-medium px-5 py-2">Libellé</th>
                  <th className="text-right font-medium px-5 py-2 w-36">Débit</th>
                  <th className="text-right font-medium px-5 py-2 w-36">Crédit</th>
                  <th className="text-right font-medium px-5 py-2 w-36">Solde</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const t = totals.get(a.code)!;
                  const solde = t.debit - t.credit;
                  return (
                    <tr key={a.code} className="border-b border-border/30 last:border-0">
                      <td className="px-5 py-2 font-tnum">{a.code}</td>
                      <td className="px-5 py-2">{pcgIndex.get(a.code)?.name}</td>
                      <td className="px-5 py-2 text-right font-tnum">{t.debit ? fmtMoney(t.debit, displayCo.baseCurrency) : ""}</td>
                      <td className="px-5 py-2 text-right font-tnum">{t.credit ? fmtMoney(t.credit, displayCo.baseCurrency) : ""}</td>
                      <td className={`px-5 py-2 text-right font-tnum ${solde > 0 ? "text-success" : solde < 0 ? "text-destructive" : ""}`}>
                        {fmtMoney(solde, displayCo.baseCurrency)} {solde >= 0 ? "D" : "C"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-surface-elevated/40 font-semibold">
                  <td className="px-5 py-2"></td>
                  <td className="px-5 py-2 text-xs uppercase tracking-wider">Sous-total classe {cls}</td>
                  <td className="px-5 py-2 text-right font-tnum">{fmtMoney(subD, displayCo.baseCurrency)}</td>
                  <td className="px-5 py-2 text-right font-tnum">{fmtMoney(subC, displayCo.baseCurrency)}</td>
                  <td className={`px-5 py-2 text-right font-tnum ${(subD - subC) > 0 ? "text-success" : (subD - subC) < 0 ? "text-destructive" : ""}`}>
                    {fmtMoney(subD - subC, displayCo.baseCurrency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Grand total footer */}
      <div className="rounded-xl border border-border bg-surface-elevated/60 overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            <tr className="font-bold">
              <td className="px-5 py-3 text-xs uppercase tracking-wider" colSpan={2}>TOTAL GÉNÉRAL</td>
              <td className="px-5 py-3 text-right font-tnum w-36">{fmtMoney(totD, displayCo.baseCurrency)}</td>
              <td className="px-5 py-3 text-right font-tnum w-36">{fmtMoney(totC, displayCo.baseCurrency)}</td>
              <td className={`px-5 py-3 text-right font-tnum w-36 ${balanced ? "text-success" : "text-destructive"}`}>
                {fmtMoney(totD - totC, displayCo.baseCurrency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-1 font-tnum ${ok ? "text-success" : ok === false ? "text-destructive" : ""}`}>{value}</div>
    </div>
  );
}
