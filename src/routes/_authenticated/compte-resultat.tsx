import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { journalEntries, pcgIndex, fmtMoney, usesPcg } from "@/lib/pcg";
import { companies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";

export const Route = createFileRoute("/_authenticated/compte-resultat")({ component: CompteResultatPage });

function CompteResultatPage() {
  const { scope } = useCompany();
  const entries = journalEntries.filter((e) => {
    if (!usesPcg(e.companyId)) return false;
    if (scope.id === "company" && scope.companyId !== e.companyId) return false;
    return true;
  });
  const co = scope.id === "company" ? companies.find((c) => c.id === scope.companyId)! : companies.find((c) => c.id === "log")!;

  // Aggregate by 2-digit code
  const byCode = new Map<string, number>();
  entries.forEach((e) =>
    e.lines.forEach((l) => {
      const k = l.account.slice(0, 2);
      byCode.set(k, (byCode.get(k) ?? 0) + l.debit - l.credit);
    }),
  );

  // Produits = crédit normal → on inverse le solde
  const produitsRows = ["70", "71", "72", "73", "74", "75", "76", "77"].map((k) => ({
    code: k, label: pcgIndex.get(k)?.name ?? k, value: -(byCode.get(k) ?? 0),
  }));
  // Charges = débit normal
  const chargesRows = ["60", "61", "62", "63", "64", "65", "66", "67", "68", "69"].map((k) => ({
    code: k, label: pcgIndex.get(k)?.name ?? k, value: byCode.get(k) ?? 0,
  }));

  const totProduits = produitsRows.reduce((s, r) => s + r.value, 0);
  const totCharges = chargesRows.reduce((s, r) => s + r.value, 0);

  // Sous-totaux
  const produitsExpl = produitsRows.filter((r) => ["70", "71", "72", "73", "74", "75"].includes(r.code)).reduce((s, r) => s + r.value, 0);
  const chargesExpl = chargesRows.filter((r) => ["60", "61", "62", "63", "64", "65", "68"].includes(r.code)).reduce((s, r) => s + r.value, 0);
  const resultatExpl = produitsExpl - chargesExpl;

  const produitsFin = produitsRows.filter((r) => r.code === "76").reduce((s, r) => s + r.value, 0);
  const chargesFin = chargesRows.filter((r) => r.code === "66").reduce((s, r) => s + r.value, 0);
  const resultatFin = produitsFin - chargesFin;

  const produitsExtra = produitsRows.filter((r) => r.code === "77").reduce((s, r) => s + r.value, 0);
  const chargesExtra = chargesRows.filter((r) => r.code === "67").reduce((s, r) => s + r.value, 0);
  const resultatExtra = produitsExtra - chargesExtra;

  const impots = chargesRows.filter((r) => r.code === "69").reduce((s, r) => s + r.value, 0);
  const resultatNet = totProduits - totCharges;

  return (
    <AppShell>
      <PageHeader title="Compte de résultat" description={`Présentation par nature — PCG Madagascar 2005 · ${co.name}`} />
      <div className="p-8 space-y-5">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Produits totaux" value={fmtMoney(totProduits, co.baseCurrency)} tone={totProduits > 0 ? "success" : totProduits < 0 ? "destructive" : undefined} />
          <Stat label="Charges totales" value={fmtMoney(totCharges, co.baseCurrency)} tone="destructive" />
          <Stat label="Résultat d'exploitation" value={fmtMoney(resultatExpl, co.baseCurrency)} tone={resultatExpl > 0 ? "success" : resultatExpl < 0 ? "destructive" : undefined} />
          <Stat label="Résultat net" value={fmtMoney(resultatNet, co.baseCurrency)} tone={resultatNet > 0 ? "success" : resultatNet < 0 ? "destructive" : undefined} />
        </div>

        <Section title="Produits" rows={produitsRows} co={co} />
        <SubTotal label="Total produits" value={totProduits} co={co} />

        <Section title="Charges" rows={chargesRows} co={co} />
        <SubTotal label="Total charges" value={totCharges} co={co} />

        <div className="rounded-xl border border-border bg-[var(--gradient-surface)] divide-y divide-border/40">
          <Line label="RÉSULTAT D'EXPLOITATION" value={resultatExpl} co={co} bold />
          <Line label="RÉSULTAT FINANCIER" value={resultatFin} co={co} bold />
          <Line label="RÉSULTAT EXTRAORDINAIRE" value={resultatExtra} co={co} bold />
          <Line label="Impôts sur les bénéfices" value={-impots} co={co} />
          <Line label="RÉSULTAT NET DE L'EXERCICE" value={resultatNet} co={co} highlight />
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-5">
      <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-bold mt-1 font-tnum ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({ title, rows, co }: any) {
  const filtered = rows.filter((r: any) => r.value !== 0);
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-border text-xs uppercase tracking-[0.16em] text-muted-foreground font-semibold">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {filtered.length === 0 && (
            <tr><td className="px-5 py-3 text-muted-foreground text-xs">—</td></tr>
          )}
          {filtered.map((r: any) => (
            <tr key={r.code} className="border-b border-border/30 last:border-0">
              <td className="px-5 py-2 font-tnum w-16 text-muted-foreground">{r.code}</td>
              <td className="px-5 py-2">{r.label}</td>
              <td className="px-5 py-2 text-right font-tnum">{fmtMoney(r.value, co.baseCurrency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function SubTotal({ label, value, co }: any) {
  return (
    <div className="flex items-center justify-between px-5 py-2 text-sm bg-surface-elevated/40 rounded-md border border-border/40">
      <div className="font-semibold uppercase tracking-wider text-xs">{label}</div>
      <div className="font-tnum font-semibold">{fmtMoney(value, co.baseCurrency)}</div>
    </div>
  );
}
function Line({ label, value, co, bold, highlight }: any) {
  return (
    <div className={`flex items-center justify-between px-5 py-3 ${highlight ? "bg-primary/5" : ""}`}>
      <div className={`${bold || highlight ? "font-display font-bold uppercase tracking-wider text-sm" : "text-sm"}`}>{label}</div>
      <div className={`font-tnum ${highlight ? "font-bold text-lg" : bold ? "font-semibold" : ""} ${value < 0 ? "text-red-600" : ""}`}>
        {fmtMoney(value, co.baseCurrency)}
      </div>
    </div>
  );
}
