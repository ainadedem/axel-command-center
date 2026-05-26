import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useJournalEntries, pcgIndex, fmtMoney, usesPcg } from "@/lib/pcg";
import { useCompanies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { PeriodPicker, defaultAccountingPeriod, type Period } from "@/components/period-picker";
import { exportCsvRows } from "@/lib/export-csv";
import { parseISO, subMonths, subQuarters, subYears, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from "date-fns";
import { useState, useMemo } from "react";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/compte-resultat")({ component: CompteResultatPage });

function priorPeriod(p: Period): Period {
  const duration = p.to.getTime() - p.from.getTime();
  return { from: new Date(p.from.getTime() - duration - 1), to: new Date(p.from.getTime() - 1), label: "Période préc." };
}

function inPeriod(date: string, p: Period) {
  const d = parseISO(date);
  return d >= p.from && d <= p.to;
}

function useAggregate(entries: ReturnType<typeof useJournalEntries>, period: Period) {
  return useMemo(() => {
    const filtered = entries.filter((e) => inPeriod(e.date, period));
    const byCode = new Map<string, number>();
    filtered.forEach((e) =>
      e.lines.forEach((l) => {
        const k = l.account.slice(0, 2);
        byCode.set(k, (byCode.get(k) ?? 0) + l.debit - l.credit);
      }),
    );
    return byCode;
  }, [entries, period]);
}

function buildStatement(byCode: Map<string, number>) {
  const produits = ["70", "71", "72", "73", "74", "75", "76", "77"].map((k) => ({
    code: k, label: pcgIndex.get(k)?.name ?? k, value: -(byCode.get(k) ?? 0),
  }));
  const charges = ["60", "61", "62", "63", "64", "65", "66", "67", "68", "69"].map((k) => ({
    code: k, label: pcgIndex.get(k)?.name ?? k, value: byCode.get(k) ?? 0,
  }));
  const totProduits = produits.reduce((s, r) => s + r.value, 0);
  const totCharges = charges.reduce((s, r) => s + r.value, 0);
  const produitsExpl = produits.filter((r) => ["70","71","72","73","74","75"].includes(r.code)).reduce((s, r) => s + r.value, 0);
  const chargesExpl = charges.filter((r) => ["60","61","62","63","64","65","68"].includes(r.code)).reduce((s, r) => s + r.value, 0);
  const resultatExpl = produitsExpl - chargesExpl;
  const produitsFin = produits.find((r) => r.code === "76")?.value ?? 0;
  const chargesFin = charges.find((r) => r.code === "66")?.value ?? 0;
  const resultatFin = produitsFin - chargesFin;
  const produitsExtra = produits.find((r) => r.code === "77")?.value ?? 0;
  const chargesExtra = charges.find((r) => r.code === "67")?.value ?? 0;
  const resultatExtra = produitsExtra - chargesExtra;
  const impots = charges.find((r) => r.code === "69")?.value ?? 0;
  const resultatNet = totProduits - totCharges;
  return { produits, charges, totProduits, totCharges, resultatExpl, resultatFin, resultatExtra, impots, resultatNet };
}

function varPct(cur: number, prev: number) {
  if (prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function CompteResultatPage() {
  return (
    <AppShell>
      <CompteResultatBody />
    </AppShell>
  );
}

function CompteResultatBody() {
  const [period, setPeriod] = useState<Period>(defaultAccountingPeriod);
  const { scope } = useCompany();
  const companies = useCompanies();
  const allEntries = useJournalEntries();

  const entries = useMemo(() =>
    allEntries.filter((e) => {
      if (!usesPcg(e.companyId)) return false;
      if (scope.id === "company" && scope.companyId !== e.companyId) return false;
      return true;
    }), [allEntries, scope]);

  const co = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId) ?? companies.find((c) => c.id === "log")!
    : companies.find((c) => c.id === "log")!;

  const prior = priorPeriod(period);
  const byCode = useAggregate(entries, period);
  const byCodePrior = useAggregate(entries, prior);

  const cur = buildStatement(byCode);
  const prev = buildStatement(byCodePrior);

  const hasPrior = byCodePrior.size > 0;

  const handleExport = () => {
    const rows: (string | number)[][] = [];
    [...cur.produits, ...cur.charges].forEach((r) => {
      if (r.value !== 0) rows.push([r.code, r.label, r.value]);
    });
    rows.push(["", "TOTAL PRODUITS", cur.totProduits]);
    rows.push(["", "TOTAL CHARGES", cur.totCharges]);
    rows.push(["", "RÉSULTAT EXPLOITATION", cur.resultatExpl]);
    rows.push(["", "RÉSULTAT FINANCIER", cur.resultatFin]);
    rows.push(["", "RÉSULTAT EXTRAORDINAIRE", cur.resultatExtra]);
    rows.push(["", "RÉSULTAT NET", cur.resultatNet]);
    exportCsvRows(
      `compte-resultat-${period.label.replace(/\s/g, "-")}.csv`,
      ["Code", "Libellé", `Montant ${period.label} (${co.baseCurrency})`],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title="Compte de résultat"
        description={`Présentation par nature — PCG Madagascar 2005 · ${co.name}`}
        actions={
          <div className="flex items-center gap-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-surface hover:bg-surface-elevated text-sm transition"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        }
      />
      <div className="p-8 space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Produits" value={fmtMoney(cur.totProduits, co.baseCurrency)} prev={hasPrior ? prev.totProduits : undefined} tone={cur.totProduits > 0 ? "success" : undefined} co={co} />
          <Stat label="Charges" value={fmtMoney(cur.totCharges, co.baseCurrency)} prev={hasPrior ? prev.totCharges : undefined} tone="destructive" co={co} invertTrend />
          <Stat label="Résultat exploitation" value={fmtMoney(cur.resultatExpl, co.baseCurrency)} prev={hasPrior ? prev.resultatExpl : undefined} tone={cur.resultatExpl > 0 ? "success" : cur.resultatExpl < 0 ? "destructive" : undefined} co={co} />
          <Stat label="Résultat net" value={fmtMoney(cur.resultatNet, co.baseCurrency)} prev={hasPrior ? prev.resultatNet : undefined} tone={cur.resultatNet > 0 ? "success" : cur.resultatNet < 0 ? "destructive" : undefined} co={co} />
        </div>

        <Section title="Produits" rows={cur.produits} prevRows={hasPrior ? prev.produits : undefined} co={co} />
        <SubTotal label="Total produits" value={cur.totProduits} prev={hasPrior ? prev.totProduits : undefined} co={co} />

        <Section title="Charges" rows={cur.charges} prevRows={hasPrior ? prev.charges : undefined} co={co} />
        <SubTotal label="Total charges" value={cur.totCharges} prev={hasPrior ? prev.totCharges : undefined} co={co} />

        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] divide-y divide-border/40">
          <SummaryLine label="RÉSULTAT D'EXPLOITATION" value={cur.resultatExpl} prev={hasPrior ? prev.resultatExpl : undefined} co={co} bold />
          <SummaryLine label="RÉSULTAT FINANCIER" value={cur.resultatFin} prev={hasPrior ? prev.resultatFin : undefined} co={co} bold />
          <SummaryLine label="RÉSULTAT EXTRAORDINAIRE" value={cur.resultatExtra} prev={hasPrior ? prev.resultatExtra : undefined} co={co} bold />
          <SummaryLine label="Impôts sur les bénéfices" value={-cur.impots} prev={hasPrior ? -prev.impots : undefined} co={co} />
          <SummaryLine label="RÉSULTAT NET DE L'EXERCICE" value={cur.resultatNet} prev={hasPrior ? prev.resultatNet : undefined} co={co} highlight />
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, prev, tone, co, invertTrend }: any) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-bold mt-1 font-tnum ${toneClass}`}>{value}</div>
      {prev !== undefined && <PrevBadge cur={parseFloat(value.replace(/[^0-9.-]/g, ""))} prevVal={prev} co={co} invertTrend={invertTrend} />}
    </div>
  );
}

function PrevBadge({ prevVal, co, invertTrend, cur: _cur }: any) {
  if (prevVal === 0) return null;
  return (
    <div className="text-[11px] text-muted-foreground mt-1 font-tnum">
      Préc. {fmtMoney(prevVal, co.baseCurrency)}
    </div>
  );
}

function Section({ title, rows, prevRows, co }: any) {
  const filtered = rows.filter((r: any) => r.value !== 0);
  const prevMap = new Map((prevRows ?? []).map((r: any) => [r.code, r.value]));
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold gap-4">
          <span>{title}</span>
          {prevRows && <span className="text-right w-28">Période préc.</span>}
          <span className="text-right w-28">Période act.</span>
          {prevRows && <span className="text-right w-20">Var.</span>}
        </div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {filtered.length === 0 && (
            <tr><td className="px-5 py-3 text-muted-foreground text-xs" colSpan={5}>—</td></tr>
          )}
          {filtered.map((r: any) => {
            const pv = prevMap.get(r.code) as number | undefined;
            const v = varPct(r.value, pv ?? 0);
            return (
              <tr key={r.code} className="border-b border-border/30 last:border-0">
                <td className="px-5 py-2 font-tnum w-16 text-muted-foreground">{r.code}</td>
                <td className="px-5 py-2 flex-1">{r.label}</td>
                {prevRows && (
                  <td className="px-5 py-2 text-right font-tnum w-32 text-muted-foreground">
                    {pv !== undefined && pv !== 0 ? fmtMoney(pv, co.baseCurrency) : "—"}
                  </td>
                )}
                <td className={`px-5 py-2 text-right font-tnum w-32 ${r.value > 0 ? "text-success" : r.value < 0 ? "text-destructive" : ""}`}>
                  {fmtMoney(r.value, co.baseCurrency)}
                </td>
                {prevRows && (
                  <td className={`px-5 py-2 text-right font-tnum w-20 text-xs ${v === null ? "" : v >= 0 ? "text-success" : "text-destructive"}`}>
                    {v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function SubTotal({ label, value, prev, co }: any) {
  const v = varPct(value, prev ?? 0);
  return (
    <div className="flex items-center justify-between px-5 py-2 text-sm bg-surface-elevated/40 rounded-md border border-border/40 gap-4">
      <div className="font-semibold uppercase tracking-wider text-xs flex-1">{label}</div>
      {prev !== undefined && (
        <div className="text-muted-foreground font-tnum text-xs w-32 text-right">{fmtMoney(prev, co.baseCurrency)}</div>
      )}
      <div className={`font-tnum font-semibold w-32 text-right ${value > 0 ? "text-success" : value < 0 ? "text-destructive" : ""}`}>
        {fmtMoney(value, co.baseCurrency)}
      </div>
      {prev !== undefined && (
        <div className={`font-tnum text-xs w-16 text-right ${v !== null && v >= 0 ? "text-success" : "text-destructive"}`}>
          {v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` : "—"}
        </div>
      )}
    </div>
  );
}

function SummaryLine({ label, value, prev, co, bold, highlight }: any) {
  const tone = value > 0 ? "text-success" : value < 0 ? "text-destructive" : "";
  const v = prev !== undefined ? varPct(value, prev) : null;
  return (
    <div className={`flex items-center gap-4 px-5 py-3 ${highlight ? "bg-primary/5" : ""}`}>
      <div className={`flex-1 ${bold || highlight ? "font-display font-bold uppercase tracking-wider text-sm" : "text-sm"}`}>
        {label}
      </div>
      {prev !== undefined && (
        <div className="text-muted-foreground font-tnum text-sm w-32 text-right">{fmtMoney(prev, co.baseCurrency)}</div>
      )}
      <div className={`font-tnum w-32 text-right ${highlight ? "font-bold text-lg" : bold ? "font-semibold" : ""} ${tone}`}>
        {fmtMoney(value, co.baseCurrency)}
      </div>
      {prev !== undefined && (
        <div className={`font-tnum text-xs w-16 text-right ${v !== null && v >= 0 ? "text-success" : "text-destructive"}`}>
          {v !== null ? `${v >= 0 ? "+" : ""}${v.toFixed(0)}%` : "—"}
        </div>
      )}
    </div>
  );
}
