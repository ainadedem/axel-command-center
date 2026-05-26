import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { useJournalEntries, pcgIndex, fmtMoney, usesPcg } from "@/lib/pcg";
import { useCompanies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";
import { PeriodPicker, defaultAccountingPeriod, type Period } from "@/components/period-picker";
import { exportCsvRows } from "@/lib/export-csv";
import { parseISO } from "date-fns";
import { useState, useMemo } from "react";
import { Download, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bilan")({ component: BilanPage });

function inPeriod(date: string, p: Period) {
  const d = parseISO(date);
  return d >= p.from && d <= p.to;
}

function useSoldes(period: Period) {
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

  const soldes = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) =>
      e.lines.forEach((l) => {
        map.set(l.account, (map.get(l.account) ?? 0) + l.debit - l.credit);
      }),
    );
    return map;
  }, [entries]);

  const co = scope.id === "company"
    ? companies.find((c) => c.id === scope.companyId) ?? companies.find((c) => c.id === "log")!
    : companies.find((c) => c.id === "log")!;

  return { soldes, co };
}

function sumPrefix(soldes: Map<string, number>, prefixes: string[]) {
  let s = 0;
  soldes.forEach((v, k) => { if (prefixes.some((p) => k.startsWith(p))) s += v; });
  return s;
}

function BilanPage() {
  return (
    <AppShell>
      <BilanBody />
    </AppShell>
  );
}

function BilanBody() {
  const [period, setPeriod] = useState<Period>(defaultAccountingPeriod);
  const { soldes, co } = useSoldes(period);

  // ACTIF
  const immoIncorp = sumPrefix(soldes, ["20"]);
  const immoCorp = sumPrefix(soldes, ["21", "23"]);
  const immoFin = sumPrefix(soldes, ["26", "27"]);
  const amortissements = -sumPrefix(soldes, ["28", "29"]);
  const stocks = sumPrefix(soldes, ["3"]);
  const clients = sumPrefix(soldes, ["41"]);
  const tvaDed = sumPrefix(soldes, ["4456"]);
  const autresCrea = sumPrefix(soldes, ["46", "48"]);
  const banques = sumPrefix(soldes, ["51", "512"]);
  const caisseEtRegies = sumPrefix(soldes, ["53", "54"]);
  const vmp = sumPrefix(soldes, ["50"]);

  const totalActifImmo = immoIncorp + immoCorp + immoFin - amortissements;
  const totalActifCir = stocks + clients + tvaDed + autresCrea;
  const totalTreso = banques + caisseEtRegies + vmp;
  const totalActif = totalActifImmo + totalActifCir + totalTreso;

  // PASSIF
  const inv = (n: number) => -n;
  const capital = inv(sumPrefix(soldes, ["10", "11"]));
  const subventions = inv(sumPrefix(soldes, ["13"]));
  const provisions = inv(sumPrefix(soldes, ["15"]));
  const emprunts = inv(sumPrefix(soldes, ["16", "17"]));
  const fournisseurs = inv(sumPrefix(soldes, ["40"]));
  const personnel = inv(sumPrefix(soldes, ["42"]));
  const orgSociaux = inv(sumPrefix(soldes, ["43"]));
  const etat = inv(sumPrefix(soldes, ["44"])) - tvaDed;
  const groupe = inv(sumPrefix(soldes, ["45"]));

  const produits = inv(sumPrefix(soldes, ["7"]));
  const charges = sumPrefix(soldes, ["6"]);
  const resultatNet = produits - charges;

  const totalCapitaux = capital + resultatNet + subventions;
  const totalDettesFin = provisions + emprunts;
  const totalDettesExpl = fournisseurs + personnel + orgSociaux + etat + groupe;
  const totalPassif = totalCapitaux + totalDettesFin + totalDettesExpl;

  const balanced = Math.abs(totalActif - totalPassif) < 1;

  const handleExport = () => {
    exportCsvRows(
      `bilan-${period.label.replace(/\s/g, "-")}.csv`,
      ["Rubrique", "Libellé", `Montant (${co.baseCurrency})`],
      [
        ["ACTIF", "Immobilisations incorporelles", immoIncorp],
        ["ACTIF", "Immobilisations corporelles", immoCorp],
        ["ACTIF", "Immobilisations financières", immoFin],
        ["ACTIF", "Amortissements (à déduire)", -amortissements],
        ["ACTIF", "Stocks et en-cours", stocks],
        ["ACTIF", "Clients", clients],
        ["ACTIF", "TVA déductible", tvaDed],
        ["ACTIF", "Autres créances", autresCrea],
        ["ACTIF", "Banques", banques],
        ["ACTIF", "Caisse / Mobile Money", caisseEtRegies],
        ["ACTIF", "VMP", vmp],
        ["ACTIF", "TOTAL ACTIF", totalActif],
        ["PASSIF", "Capital et réserves", capital],
        ["PASSIF", "Résultat de l'exercice", resultatNet],
        ["PASSIF", "Subventions d'investissement", subventions],
        ["PASSIF", "Provisions pour risques et charges", provisions],
        ["PASSIF", "Emprunts et dettes financières", emprunts],
        ["PASSIF", "Fournisseurs", fournisseurs],
        ["PASSIF", "Personnel", personnel],
        ["PASSIF", "Organismes sociaux (CNAPS, OSTIE)", orgSociaux],
        ["PASSIF", "État (TVA, IRSA, IS)", etat],
        ["PASSIF", "Comptes courants associés", groupe],
        ["PASSIF", "TOTAL PASSIF", totalPassif],
      ],
    );
  };

  return (
    <>
      <PageHeader
        title="Bilan"
        description={`État du patrimoine — PCG Madagascar 2005 · ${co.name}`}
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

      <div className="px-8 pb-3">
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${balanced ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
          {balanced
            ? <><CheckCircle2 className="h-4 w-4" /> Bilan équilibré — Actif ({fmtMoney(totalActif, co.baseCurrency)}) = Passif ({fmtMoney(totalPassif, co.baseCurrency)})</>
            : <><AlertTriangle className="h-4 w-4" /> Déséquilibre : Actif {fmtMoney(totalActif, co.baseCurrency)} ≠ Passif {fmtMoney(totalPassif, co.baseCurrency)} · écart {fmtMoney(Math.abs(totalActif - totalPassif), co.baseCurrency)}</>
          }
        </div>
      </div>

      <div className="p-8 pt-3 grid lg:grid-cols-2 gap-5">
        <Panel title="ACTIF">
          <Group title="Actif non courant" total={totalActifImmo} co={co}>
            <Row label="Immobilisations incorporelles" value={immoIncorp} co={co} />
            <Row label="Immobilisations corporelles" value={immoCorp} co={co} />
            <Row label="Immobilisations financières" value={immoFin} co={co} />
            <Row label="Amortissements (à déduire)" value={-amortissements} co={co} muted />
          </Group>
          <Group title="Actif courant" total={totalActifCir} co={co}>
            <Row label="Stocks et en-cours" value={stocks} co={co} />
            <Row label={`Clients (${pcgIndex.get("411")?.name})`} value={clients} co={co} />
            <Row label="TVA déductible" value={tvaDed} co={co} />
            <Row label="Autres créances" value={autresCrea} co={co} />
          </Group>
          <Group title="Trésorerie active" total={totalTreso} co={co}>
            <Row label="Banques" value={banques} co={co} />
            <Row label="Caisse / Mobile Money" value={caisseEtRegies} co={co} />
            <Row label="VMP" value={vmp} co={co} />
          </Group>
          <Total label="TOTAL ACTIF" value={totalActif} co={co} />
        </Panel>

        <Panel title="PASSIF">
          <Group title="Capitaux propres" total={totalCapitaux} co={co}>
            <Row label="Capital et réserves" value={capital} co={co} />
            <Row label="Résultat de l'exercice" value={resultatNet} co={co} />
            <Row label="Subventions d'investissement" value={subventions} co={co} />
          </Group>
          <Group title="Passifs non courants" total={totalDettesFin} co={co}>
            <Row label="Provisions pour risques et charges" value={provisions} co={co} />
            <Row label="Emprunts et dettes financières" value={emprunts} co={co} />
          </Group>
          <Group title="Passifs courants" total={totalDettesExpl} co={co}>
            <Row label="Fournisseurs" value={fournisseurs} co={co} />
            <Row label="Personnel" value={personnel} co={co} />
            <Row label="Organismes sociaux (CNAPS, OSTIE)" value={orgSociaux} co={co} />
            <Row label="État (TVA, IRSA, IS)" value={etat} co={co} />
            <Row label="Comptes courants associés" value={groupe} co={co} />
          </Group>
          <Total label="TOTAL PASSIF" value={totalPassif} co={co} />
        </Panel>
      </div>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-[var(--gradient-surface)] overflow-hidden">
      <div className="px-5 py-3 border-b border-border">
        <div className="font-display text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}
function Group({ title, total, co, children }: any) {
  return (
    <div>
      <div className="flex items-center justify-between px-5 py-2 bg-surface-elevated/40">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
        <div className="text-sm font-tnum font-semibold">{fmtMoney(total, co.baseCurrency)}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}
function Row({ label, value, co, muted }: any) {
  const tone = value > 0 ? "text-success" : value < 0 ? "text-destructive" : "";
  return (
    <div className="flex items-center justify-between px-5 py-2 text-sm">
      <div className={muted ? "text-muted-foreground" : ""}>{label}</div>
      <div className={`font-tnum ${muted ? "text-muted-foreground" : tone}`}>{fmtMoney(value, co.baseCurrency)}</div>
    </div>
  );
}
function Total({ label, value, co }: any) {
  const tone = value > 0 ? "text-success" : value < 0 ? "text-destructive" : "";
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t-2 border-border bg-primary/5">
      <div className="font-display font-bold uppercase tracking-wider text-sm">{label}</div>
      <div className={`font-tnum font-bold text-lg ${tone}`}>{fmtMoney(value, co.baseCurrency)}</div>
    </div>
  );
}
