import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { journalEntries, pcgAccounts, pcgIndex, fmtMoney, usesPcg, classNames, type PcgClass } from "@/lib/pcg";
import { companies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";

export const Route = createFileRoute("/_authenticated/balance")({ component: BalancePage });

function BalancePage() {
  return (
    <AppShell>
      <PageHeader title="Balance générale" description="Totaux débit / crédit et solde par compte — PCG Madagascar 2005." />
      <Body />
    </AppShell>
  );
}

function Body() {
  const { scope } = useCompany();
  const entries = journalEntries.filter((e) => {
    if (!usesPcg(e.companyId)) return false;
    if (scope.id === "company" && scope.companyId !== e.companyId) return false;
    return true;
  });

  // Aggregate per account
  const totals = new Map<string, { debit: number; credit: number }>();
  entries.forEach((e) => {
    e.lines.forEach((l) => {
      const cur = totals.get(l.account) ?? { debit: 0, credit: 0 };
      cur.debit += l.debit;
      cur.credit += l.credit;
      totals.set(l.account, cur);
    });
  });

  // Pick a display currency: if a single company scope, its base; else MGA aggregate (note: simplified, treats numbers as same unit per company).
  const displayCo = scope.id === "company" ? companies.find((c) => c.id === scope.companyId)! : companies.find((c) => c.id === "log")!;

  const rows = pcgAccounts
    .filter((a) => totals.has(a.code))
    .sort((a, b) => a.code.localeCompare(b.code));

  let totD = 0, totC = 0;
  rows.forEach((a) => {
    const t = totals.get(a.code)!;
    totD += t.debit; totC += t.credit;
  });

  // Group by class
  const byClass = new Map<PcgClass, typeof rows>();
  rows.forEach((a) => {
    if (!byClass.has(a.class)) byClass.set(a.class, []);
    byClass.get(a.class)!.push(a);
  });

  return (
    <div className="p-8 space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total débit" value={fmtMoney(totD, displayCo.baseCurrency)} />
        <Stat label="Total crédit" value={fmtMoney(totC, displayCo.baseCurrency)} />
        <Stat label="Équilibre" value={Math.round(totD - totC) === 0 ? "✓ Équilibrée" : `Écart ${fmtMoney(totD - totC, displayCo.baseCurrency)}`} ok={Math.round(totD - totC) === 0} />
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
                      <td className={`px-5 py-2 text-right font-tnum ${solde >= 0 ? "" : "text-muted-foreground"}`}>
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
                  <td className="px-5 py-2 text-right font-tnum">{fmtMoney(subD - subC, displayCo.baseCurrency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-1 font-tnum ${ok ? "text-emerald-600" : ""}`}>{value}</div>
    </div>
  );
}
