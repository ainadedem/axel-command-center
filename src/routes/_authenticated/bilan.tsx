import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { journalEntries, pcgIndex, fmtMoney, usesPcg } from "@/lib/pcg";
import { companies } from "@/lib/mock-data";
import { useCompany } from "@/lib/company-context";

export const Route = createFileRoute("/_authenticated/bilan")({ component: BilanPage });

// Aggregate solde (débit - crédit) per account, then map to bilan rubrics
function useSoldes() {
  const { scope } = useCompany();
  const entries = journalEntries.filter((e) => {
    if (!usesPcg(e.companyId)) return false;
    if (scope.id === "company" && scope.companyId !== e.companyId) return false;
    return true;
  });
  const soldes = new Map<string, number>();
  entries.forEach((e) =>
    e.lines.forEach((l) => {
      soldes.set(l.account, (soldes.get(l.account) ?? 0) + l.debit - l.credit);
    }),
  );
  const co = scope.id === "company" ? companies.find((c) => c.id === scope.companyId)! : companies.find((c) => c.id === "log")!;
  return { soldes, co };
}

// helper: sum solde for any account whose code starts with prefix(es)
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
  const { soldes, co } = useSoldes();


  // ACTIF (débiteur normal)
  const immoIncorp = sumPrefix(soldes, ["20"]);
  const immoCorp = sumPrefix(soldes, ["21", "23"]);
  const immoFin = sumPrefix(soldes, ["26", "27"]);
  const amortissements = -sumPrefix(soldes, ["28", "29"]); // créditeur
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

  // PASSIF (créditeur normal — on inverse le signe)
  const inv = (n: number) => -n;
  const capital = inv(sumPrefix(soldes, ["10", "11"]));
  const resultat = inv(sumPrefix(soldes, ["12"])) + (totalActif > 0 ? 0 : 0); // placeholder; computed below
  const subventions = inv(sumPrefix(soldes, ["13"]));
  const provisions = inv(sumPrefix(soldes, ["15"]));
  const emprunts = inv(sumPrefix(soldes, ["16", "17"]));
  const fournisseurs = inv(sumPrefix(soldes, ["40"]));
  const personnel = inv(sumPrefix(soldes, ["42"]));
  const orgSociaux = inv(sumPrefix(soldes, ["43"]));
  const etat = inv(sumPrefix(soldes, ["44"])) - tvaDed; // 4456 is actif; exclude
  const groupe = inv(sumPrefix(soldes, ["45"]));

  // Résultat de l'exercice = produits (cl. 7) - charges (cl. 6)
  const produits = inv(sumPrefix(soldes, ["7"]));   // class 7 normal credit
  const charges = sumPrefix(soldes, ["6"]);          // class 6 normal debit
  const resultatNet = produits - charges;

  const totalCapitaux = capital + resultatNet + subventions;
  const totalDettesFin = provisions + emprunts;
  const totalDettesExpl = fournisseurs + personnel + orgSociaux + etat + groupe;
  const totalPassif = totalCapitaux + totalDettesFin + totalDettesExpl;

  return (
    <>
      <PageHeader title="Bilan" description={`État du patrimoine — PCG Madagascar 2005 · ${co.name}`} />

      <div className="p-8 grid lg:grid-cols-2 gap-5">
        {/* ACTIF */}
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

        {/* PASSIF */}
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
    </AppShell>
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
  return (
    <div className="flex items-center justify-between px-5 py-2 text-sm">
      <div className={muted ? "text-muted-foreground" : ""}>{label}</div>
      <div className={`font-tnum ${muted ? "text-muted-foreground" : ""}`}>{fmtMoney(value, co.baseCurrency)}</div>
    </div>
  );
}
function Total({ label, value, co }: any) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t-2 border-border bg-primary/5">
      <div className="font-display font-bold uppercase tracking-wider text-sm">{label}</div>
      <div className="font-tnum font-bold text-lg">{fmtMoney(value, co.baseCurrency)}</div>
    </div>
  );
}
