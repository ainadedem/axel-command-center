// PCG Madagascar 2005 — Plan Comptable Général (coherent with IAS/IFRS)
// Décret n°2004-272 du 18 février 2004
// Applied to companies that use PCG: Logia Madagascar + Axiom Unlimited.
import { createCollection, useCollection } from "./data-store";


export type PcgClass = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PcgNature = "actif" | "passif" | "charge" | "produit";

export interface PcgAccount {
  code: string;          // e.g. "411", "70110"
  name: string;          // French label
  class: PcgClass;
  nature: PcgNature;
  parent?: string;       // parent code, for tree
}

// Two-digit and most-used three-digit subdivisions per PCG 2005.
// Sufficient for Bilan / Compte de résultat / Balance / Grand-livre at audit grain.
export const pcgAccounts: PcgAccount[] = [
  // ── CLASSE 1 : Capitaux ───────────────────────────────────────────────
  { code: "10",   name: "Capital et réserves",                    class: 1, nature: "passif" },
  { code: "101",  name: "Capital social",                         class: 1, nature: "passif", parent: "10" },
  { code: "106",  name: "Réserves",                               class: 1, nature: "passif", parent: "10" },
  { code: "11",   name: "Report à nouveau",                       class: 1, nature: "passif" },
  { code: "12",   name: "Résultat de l'exercice",                 class: 1, nature: "passif" },
  { code: "13",   name: "Subventions d'investissement",           class: 1, nature: "passif" },
  { code: "15",   name: "Provisions pour risques et charges",     class: 1, nature: "passif" },
  { code: "16",   name: "Emprunts et dettes assimilées",          class: 1, nature: "passif" },
  { code: "164",  name: "Emprunts auprès des établissements de crédit", class: 1, nature: "passif", parent: "16" },
  { code: "17",   name: "Dettes rattachées à des participations", class: 1, nature: "passif" },
  { code: "18",   name: "Comptes de liaison inter-sociétés",      class: 1, nature: "passif" },

  // ── CLASSE 2 : Immobilisations ────────────────────────────────────────
  { code: "20",   name: "Immobilisations incorporelles",          class: 2, nature: "actif" },
  { code: "205",  name: "Logiciels et licences",                  class: 2, nature: "actif", parent: "20" },
  { code: "21",   name: "Immobilisations corporelles",            class: 2, nature: "actif" },
  { code: "213",  name: "Constructions",                          class: 2, nature: "actif", parent: "21" },
  { code: "215",  name: "Matériel et outillage",                  class: 2, nature: "actif", parent: "21" },
  { code: "218",  name: "Autres immobilisations corporelles",     class: 2, nature: "actif", parent: "21" },
  { code: "23",   name: "Immobilisations en cours",               class: 2, nature: "actif" },
  { code: "26",   name: "Participations et créances rattachées",  class: 2, nature: "actif" },
  { code: "27",   name: "Autres immobilisations financières",     class: 2, nature: "actif" },
  { code: "28",   name: "Amortissements des immobilisations",     class: 2, nature: "actif" },
  { code: "29",   name: "Pertes de valeur sur immobilisations",   class: 2, nature: "actif" },

  // ── CLASSE 3 : Stocks et en-cours ─────────────────────────────────────
  { code: "30",   name: "Stocks de marchandises",                 class: 3, nature: "actif" },
  { code: "31",   name: "Matières premières",                     class: 3, nature: "actif" },
  { code: "32",   name: "Autres approvisionnements",              class: 3, nature: "actif" },
  { code: "34",   name: "En-cours de production de services",     class: 3, nature: "actif" },
  { code: "35",   name: "Stocks de produits",                     class: 3, nature: "actif" },
  { code: "39",   name: "Pertes de valeur sur stocks",            class: 3, nature: "actif" },

  // ── CLASSE 4 : Tiers ──────────────────────────────────────────────────
  { code: "40",   name: "Fournisseurs et comptes rattachés",      class: 4, nature: "passif" },
  { code: "401",  name: "Fournisseurs",                           class: 4, nature: "passif", parent: "40" },
  { code: "408",  name: "Fournisseurs - factures non parvenues",  class: 4, nature: "passif", parent: "40" },
  { code: "41",   name: "Clients et comptes rattachés",           class: 4, nature: "actif" },
  { code: "411",  name: "Clients",                                class: 4, nature: "actif", parent: "41" },
  { code: "416",  name: "Clients douteux ou litigieux",           class: 4, nature: "actif", parent: "41" },
  { code: "42",   name: "Personnel et comptes rattachés",         class: 4, nature: "passif" },
  { code: "421",  name: "Personnel - rémunérations dues",         class: 4, nature: "passif", parent: "42" },
  { code: "43",   name: "Organismes sociaux",                     class: 4, nature: "passif" },
  { code: "431",  name: "CNAPS",                                  class: 4, nature: "passif", parent: "43" },
  { code: "437",  name: "OSTIE / médecine du travail",            class: 4, nature: "passif", parent: "43" },
  { code: "44",   name: "État et collectivités publiques",        class: 4, nature: "passif" },
  { code: "4452", name: "TVA due intracommunautaire",             class: 4, nature: "passif", parent: "44" },
  { code: "4456", name: "TVA déductible",                         class: 4, nature: "actif",  parent: "44" },
  { code: "4457", name: "TVA collectée",                          class: 4, nature: "passif", parent: "44" },
  { code: "447",  name: "IRSA - retenue à la source",             class: 4, nature: "passif", parent: "44" },
  { code: "448",  name: "Impôt sur les bénéfices (IR/IS)",        class: 4, nature: "passif", parent: "44" },
  { code: "45",   name: "Groupe et associés (comptes courants)",  class: 4, nature: "passif" },
  { code: "46",   name: "Débiteurs et créditeurs divers",         class: 4, nature: "passif" },
  { code: "47",   name: "Comptes transitoires ou d'attente",      class: 4, nature: "passif" },
  { code: "48",   name: "Charges et produits constatés d'avance", class: 4, nature: "actif"  },
  { code: "49",   name: "Pertes de valeur sur comptes de tiers",  class: 4, nature: "actif"  },

  // ── CLASSE 5 : Trésorerie ─────────────────────────────────────────────
  { code: "50",   name: "Valeurs mobilières de placement",        class: 5, nature: "actif" },
  { code: "51",   name: "Banques, établissements financiers",     class: 5, nature: "actif" },
  { code: "512",  name: "Banques - comptes courants",             class: 5, nature: "actif", parent: "51" },
  { code: "53",   name: "Caisse",                                 class: 5, nature: "actif" },
  { code: "54",   name: "Régies d'avances et accréditifs (Mobile Money)", class: 5, nature: "actif" },
  { code: "58",   name: "Virements internes",                     class: 5, nature: "actif" },

  // ── CLASSE 6 : Charges ────────────────────────────────────────────────
  { code: "60",   name: "Achats consommés",                       class: 6, nature: "charge" },
  { code: "601",  name: "Achats de matières premières",           class: 6, nature: "charge", parent: "60" },
  { code: "606",  name: "Achats non stockés (fournitures, énergie)", class: 6, nature: "charge", parent: "60" },
  { code: "61",   name: "Services extérieurs",                    class: 6, nature: "charge" },
  { code: "613",  name: "Locations",                              class: 6, nature: "charge", parent: "61" },
  { code: "614",  name: "Charges locatives et de copropriété",    class: 6, nature: "charge", parent: "61" },
  { code: "615",  name: "Entretien et réparations",               class: 6, nature: "charge", parent: "61" },
  { code: "616",  name: "Primes d'assurances",                    class: 6, nature: "charge", parent: "61" },
  { code: "62",   name: "Autres services extérieurs",             class: 6, nature: "charge" },
  { code: "621",  name: "Personnel extérieur (sous-traitance)",   class: 6, nature: "charge", parent: "62" },
  { code: "622",  name: "Honoraires",                             class: 6, nature: "charge", parent: "62" },
  { code: "623",  name: "Publicité, communication",               class: 6, nature: "charge", parent: "62" },
  { code: "624",  name: "Transports et déplacements",             class: 6, nature: "charge", parent: "62" },
  { code: "626",  name: "Frais postaux et télécommunications",    class: 6, nature: "charge", parent: "62" },
  { code: "627",  name: "Services bancaires",                     class: 6, nature: "charge", parent: "62" },
  { code: "63",   name: "Charges de personnel",                   class: 6, nature: "charge" },
  { code: "631",  name: "Rémunérations du personnel",             class: 6, nature: "charge", parent: "63" },
  { code: "635",  name: "Charges sociales (CNAPS, OSTIE)",        class: 6, nature: "charge", parent: "63" },
  { code: "64",   name: "Impôts, taxes et versements assimilés",  class: 6, nature: "charge" },
  { code: "65",   name: "Autres charges opérationnelles",         class: 6, nature: "charge" },
  { code: "66",   name: "Charges financières",                    class: 6, nature: "charge" },
  { code: "661",  name: "Charges d'intérêts",                     class: 6, nature: "charge", parent: "66" },
  { code: "666",  name: "Pertes de change",                       class: 6, nature: "charge", parent: "66" },
  { code: "67",   name: "Éléments extraordinaires (charges)",     class: 6, nature: "charge" },
  { code: "68",   name: "Dotations aux amortissements et provisions", class: 6, nature: "charge" },
  { code: "69",   name: "Impôts sur les bénéfices",               class: 6, nature: "charge" },

  // ── CLASSE 7 : Produits ───────────────────────────────────────────────
  { code: "70",   name: "Ventes de marchandises, produits et services", class: 7, nature: "produit" },
  { code: "701",  name: "Ventes de produits finis",               class: 7, nature: "produit", parent: "70" },
  { code: "706",  name: "Prestations de services",                class: 7, nature: "produit", parent: "70" },
  { code: "708",  name: "Produits des activités annexes",         class: 7, nature: "produit", parent: "70" },
  { code: "71",   name: "Production stockée (variation)",         class: 7, nature: "produit" },
  { code: "72",   name: "Production immobilisée",                 class: 7, nature: "produit" },
  { code: "73",   name: "Subventions d'exploitation",             class: 7, nature: "produit" },
  { code: "74",   name: "Autres produits opérationnels",          class: 7, nature: "produit" },
  { code: "75",   name: "Reprises sur pertes de valeur et provisions", class: 7, nature: "produit" },
  { code: "76",   name: "Produits financiers",                    class: 7, nature: "produit" },
  { code: "766",  name: "Gains de change",                        class: 7, nature: "produit", parent: "76" },
  { code: "77",   name: "Éléments extraordinaires (produits)",    class: 7, nature: "produit" },
];

export const pcgIndex = new Map(pcgAccounts.map((a) => [a.code, a]));

export const classNames: Record<PcgClass, string> = {
  1: "Comptes de capitaux",
  2: "Comptes d'immobilisations",
  3: "Comptes de stocks et en-cours",
  4: "Comptes de tiers",
  5: "Comptes financiers",
  6: "Comptes de charges",
  7: "Comptes de produits",
};

// Journals (livres auxiliaires)
export interface Journal {
  code: string;
  name: string;
}
export const journals: Journal[] = [
  { code: "VTE", name: "Journal des ventes" },
  { code: "ACH", name: "Journal des achats" },
  { code: "BNQ", name: "Journal de banque" },
  { code: "CSS", name: "Journal de caisse" },
  { code: "OD",  name: "Opérations diverses" },
  { code: "AN",  name: "À nouveaux" },
];

// Double-entry journal entries (écritures comptables)
export interface JournalLine {
  account: string;     // PCG code
  label?: string;      // optional auxiliary label (e.g. client name)
  debit: number;
  credit: number;
}
export interface JournalEntry {
  id: string;
  companyId: string;   // "log" | "axi"
  journal: string;     // VTE/ACH/BNQ/...
  date: string;        // ISO yyyy-mm-dd
  piece: string;       // n° pièce
  description: string;
  lines: JournalLine[];
}

import { createCollection, useCollection } from "./data-store";

export const journalEntriesStore = createCollection<JournalEntry>("journal-entries", []);
export const journalEntries = journalEntriesStore.items;
export const useJournalEntries = () => useCollection(journalEntriesStore);


export const pcgCompanyIds = new Set(["log", "axi"]);
export const usesPcg = (companyId: string) => pcgCompanyIds.has(companyId);

// French Ariary formatter (no decimals)
export const fmtAr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n)) + " Ar";

// Generic formatter that picks the right symbol for a base currency
export const fmtMoney = (n: number, currency: "MGA" | "EUR" | "USD") => {
  const v = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n));
  return currency === "MGA" ? `${v} Ar` : currency === "EUR" ? `${v} €` : `$${v}`;
};

export const fmtDateFR = (iso: string) => {
  const [y, m, day] = iso.split("-");
  return `${day}/${m}/${y}`;
};

// Madagascar standard TVA rate
export const TVA_RATE = 0.2;
