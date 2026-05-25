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




import logiaSeed from "./logia-grand-livre-seed.json";
import logiaAccountLabels from "./logia-account-labels.json";
import logiaOpportunitiesSeed from "./logia-opportunities-seed.json";
import {
  companiesStore, accountsStore, clientsStore, suppliersStore,
  invoicesStore, transactionsStore, categoriesStore, opportunitiesStore,
  type Account, type Client, type Supplier, type Invoice, type Transaction, type Category, type Opportunity,
} from "./mock-data";

export const journalEntriesStore = createCollection<JournalEntry>("journal-entries", []);
export const journalEntries = journalEntriesStore.items;
export const useJournalEntries = () => useCollection(journalEntriesStore);

/** Ensure the companies referenced by the imported Grand Livre exist. */
function ensureSeedCompanies() {
  const seeds = [
    { id: "log", name: "Logia Madagascar", shortName: "LOG", color: "oklch(0.78 0.14 165)", baseCurrency: "MGA" as const },
    { id: "win", name: "Winford Next",     shortName: "WIN", color: "oklch(0.72 0.13 220)", baseCurrency: "USD" as const },
    { id: "axi", name: "Axiom Unlimited",  shortName: "AXI", color: "oklch(0.78 0.13 75)",  baseCurrency: "MGA" as const },
  ];
  for (const s of seeds) {
    if (!companiesStore.items.some((c) => c.id === s.id)) companiesStore.add(s);
  }
}

/** Seed Logia's Grand Livre (imported from Google Drive snapshot) if absent. */
export function seedLogiaGrandLivre(force = false) {
  ensureSeedCompanies();
  const seed = logiaSeed as JournalEntry[];
  const hasLogia = journalEntriesStore.items.some((e) => e.companyId === "log");
  if (hasLogia && !force) return 0;
  const others = journalEntriesStore.items.filter((e) => e.companyId !== "log");
  journalEntriesStore.replaceAll([...others, ...seed]);
  // Derive the rest of the operational data from the journal entries.
  seedLogiaDerivedData(true);
  return seed.length;
}

/**
 * Derive Logia's accounts, clients, suppliers, invoices and transactions
 * from the imported journal entries — so every page shows the same reality.
 */
export function seedLogiaDerivedData(force = false) {
  const entries = journalEntriesStore.items.filter((e) => e.companyId === "log");
  if (entries.length === 0) return;

  // Skip if Logia already has derived data and we're not forcing.
  const hasDerived =
    accountsStore.items.some((a) => a.companyId === "log") ||
    clientsStore.items.some((c) => c.companyId === "log") ||
    suppliersStore.items.some((s) => s.companyId === "log");
  if (hasDerived && !force) return;

  // Wipe Logia-scoped derived data so re-seeding is clean.
  accountsStore.replaceAll(accountsStore.items.filter((a) => a.companyId !== "log"));
  clientsStore.replaceAll(clientsStore.items.filter((c) => c.companyId !== "log"));
  suppliersStore.replaceAll(suppliersStore.items.filter((s) => s.companyId !== "log"));
  invoicesStore.replaceAll(invoicesStore.items.filter((i) => i.companyId !== "log"));
  transactionsStore.replaceAll(transactionsStore.items.filter((t) => t.companyId !== "log"));
  categoriesStore.replaceAll(categoriesStore.items.filter((c) => c.companyId !== "log"));

  /* ── Categories (derived from PCG class 6/7 counterpart accounts) ── */
  const categoryByAccount = new Map<string, Category>();
  const ensureCategory = (account: string, label: string, kind: Category["kind"]): Category => {
    const existing = categoryByAccount.get(account);
    if (existing) return existing;
    const cat: Category = {
      id: `cat_log_${account}`,
      companyId: "log",
      name: label,
      kind,
      account,
    };
    categoryByAccount.set(account, cat);
    categoriesStore.add(cat);
    return cat;
  };


  /* ── Accounts (bank + cash) ─────────────────────────────────────── */
  const accountByCode = new Map<string, Account>();
  const bniBalance = sumNet(entries, (l) => l.account === "512100");
  accountByCode.set("512100", {
    id: "acc_log_bni", companyId: "log", name: "BNI — Compte courant",
    type: "bank", currency: "MGA", balance: bniBalance,
  });
  const caisseBalance = sumNet(entries, (l) => l.account === "530000");
  accountByCode.set("530000", {
    id: "acc_log_caisse", companyId: "log", name: "Caisse",
    type: "cash", currency: "MGA", balance: caisseBalance,
  });
  for (const a of accountByCode.values()) accountsStore.add(a);

  /* ── Clients (411) ──────────────────────────────────────────────── */
  const clientByName = new Map<string, Client>();
  for (const e of entries) {
    for (const l of e.lines) {
      if (!l.account.startsWith("411")) continue;
      const name = (l.label || "").trim();
      if (!name || name.toUpperCase() === "CLIENTS") continue;
      if (clientByName.has(name)) continue;
      const client: Client = {
        id: `cli_log_${slug(name)}`,
        companyId: "log",
        name,
        country: guessCountry(name),
      };
      clientByName.set(name, client);
      clientsStore.add(client);
    }
  }

  /* ── Suppliers (401) ────────────────────────────────────────────── */
  const supplierByName = new Map<string, Supplier>();
  for (const e of entries) {
    for (const l of e.lines) {
      if (!l.account.startsWith("401")) continue;
      const name = (l.label || "").trim();
      if (!name || name.toUpperCase() === "FOURNISSEURS") continue;
      if (supplierByName.has(name)) continue;
      const supplier: Supplier = {
        id: `sup_log_${slug(name)}`,
        companyId: "log",
        name,
        account: l.account,
        kind: l.account === "401200" ? "internal" : "external",
      };
      supplierByName.set(name, supplier);
      suppliersStore.add(supplier);
    }
  }

  /* ── Invoices (VTE journal entries) ─────────────────────────────── */
  for (const e of entries) {
    if (e.journal !== "VTE") continue;
    const clientLine = e.lines.find((l) => l.account.startsWith("411") && l.debit > 0);
    if (!clientLine) continue;
    const client = clientByName.get((clientLine.label || "").trim());
    if (!client) continue;
    const amount = clientLine.debit;
    // A receivable is "paid" once a matching 411 credit lands in any journal.
    const paid = entries
      .filter((x) => x.lines.some((l) => l.account.startsWith("411") && l.credit > 0 && l.label === clientLine.label && new Date(x.date) >= new Date(e.date)))
      .reduce((s, x) => s + x.lines.filter((l) => l.account.startsWith("411") && l.credit > 0 && l.label === clientLine.label).reduce((a, l) => a + l.credit, 0), 0);
    const cappedPaid = Math.min(paid, amount);
    const dueDate = addDays(e.date, 30);
    const overdue = new Date(dueDate) < new Date() && cappedPaid < amount;
    const status: Invoice["status"] =
      cappedPaid >= amount ? "paid" : cappedPaid > 0 ? "partial" : overdue ? "overdue" : "sent";
    const inv: Invoice = {
      id: `inv_${e.id}`,
      number: e.piece,
      companyId: "log",
      clientId: client.id,
      issueDate: e.date,
      dueDate,
      amount,
      paid: cappedPaid,
      currency: "MGA",
      status,
    };
    invoicesStore.add(inv);
  }

  /* ── Transactions (BNQ + CSS journal entries) ───────────────────── */
  for (const e of entries) {
    let accountId: string | undefined;
    let cashLine: typeof e.lines[number] | undefined;
    if (e.journal === "BNQ") {
      cashLine = e.lines.find((l) => l.account === "512100");
      accountId = "acc_log_bni";
    } else if (e.journal === "CSS") {
      cashLine = e.lines.find((l) => l.account === "530000");
      accountId = "acc_log_caisse";
    }
    if (!accountId || !cashLine) continue;
    const isIncome = cashLine.debit > 0; // cash in → debit on cash account
    const amount = isIncome ? cashLine.debit : cashLine.credit;
    // Counterpart line drives category + client/supplier linkage.
    const counter = e.lines.find((l) => l !== cashLine);
    const clientName = counter?.account.startsWith("411") ? counter.label?.trim() : undefined;
    // Supplier link: prefer explicit 401 counterpart; otherwise try to match
    // any 401 line in the same entry (BNQ payments often pair cash with the
    // supplier account directly), then fall back to fuzzy name match against
    // the entry description (e.g. "Règlement fact. JIRAMA …").
    let supplierName: string | undefined;
    if (counter?.account.startsWith("401")) supplierName = counter.label?.trim();
    if (!supplierName) {
      const supLine = e.lines.find((l) => l.account.startsWith("401") && l.label);
      if (supLine) supplierName = supLine.label?.trim();
    }
    if (!supplierName && !isIncome) {
      const desc = e.description.toUpperCase();
      for (const name of supplierByName.keys()) {
        if (name.length >= 3 && desc.includes(name.toUpperCase())) { supplierName = name; break; }
      }
    }
    const transfer = e.lines.some((l) => l.account === "580000"); // virement interne
    const txType: Transaction["type"] = transfer ? "transfer" : isIncome ? "income" : "expense";
    const categoryLabel = counter
      ? accountLabels[counter.account] ?? counter.label ?? counter.account
      : "Divers";
    // Build a Category for any class-6 (charge) or class-7 (produit) counterpart.
    let categoryId: string | undefined;
    if (counter && !transfer && (counter.account.startsWith("6") || counter.account.startsWith("7"))) {
      const cat = ensureCategory(counter.account, categoryLabel, isIncome ? "income" : "expense");
      categoryId = cat.id;
    }
    const tx: Transaction = {
      id: `tx_${e.id}`,
      companyId: "log",
      accountId,
      date: e.date,
      type: txType,
      category: categoryLabel,
      categoryId,
      description: e.description.split("\n")[0].slice(0, 140),
      amount,
      currency: "MGA",
      clientId: clientName ? clientByName.get(clientName)?.id : undefined,
      supplierId: supplierName ? supplierByName.get(supplierName)?.id : undefined,
    };
    transactionsStore.add(tx);
  }
}

/* ── helpers ──────────────────────────────────────────────────────── */
function sumNet(entries: JournalEntry[], pick: (l: JournalLine) => boolean): number {
  let s = 0;
  for (const e of entries) for (const l of e.lines) if (pick(l)) s += l.debit - l.credit;
  return s;
}
function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function guessCountry(name: string): string {
  const u = name.toUpperCase();
  if (u.includes("CANADA")) return "Canada";
  if (u.includes("PNUD")) return "International";
  return "Madagascar";
}

/** Labels for sub-accounts (6-digit codes) used in the imported Grand Livre. */
export const accountLabels = logiaAccountLabels as Record<string, string>;

/** Replace all Logia-scoped opportunities with the imported Notion CRM snapshot,
 *  and propagate each client's acquisition person onto the Clients table
 *  (single source of truth — same person across every opportunity for that client). */
export function seedLogiaOpportunities() {
  type RawOpp = Opportunity & { owner?: string };
  const seed = logiaOpportunitiesSeed as RawOpp[];

  // 1) Derive acquisition per client: pick the most frequent legacy `owner`.
  const tally = new Map<string, Map<string, number>>(); // clientName → owner → count
  for (const o of seed) {
    if (!o.owner) continue;
    const key = (o.client || "").trim();
    if (!key) continue;
    const inner = tally.get(key) ?? new Map<string, number>();
    inner.set(o.owner, (inner.get(o.owner) ?? 0) + 1);
    tally.set(key, inner);
  }
  const acqByClient = new Map<string, string>();
  for (const [name, owners] of tally) {
    const top = [...owners.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) acqByClient.set(name.toLowerCase(), top[0]);
  }

  // 2) Update the Logia clients in place with their acquisition person.
  const updatedClients = clientsStore.items.map((c) => {
    if (c.companyId !== "log") return c;
    const acq = acqByClient.get(c.name.toLowerCase());
    return acq ? { ...c, acquisition: acq } : c;
  });
  clientsStore.replaceAll(updatedClients);

  // 3) Replace Logia opportunities (strip legacy `owner` field — acquisition lives on Client).
  const others = opportunitiesStore.items.filter((o) => o.companyId !== "log");
  const cleaned: Opportunity[] = seed.map(({ owner: _owner, ...rest }) => rest);
  opportunitiesStore.replaceAll([...others, ...cleaned]);
  return cleaned.length;
}

// Auto-seed on first load (idempotent). Declared AFTER `accountLabels`
// because seedLogiaDerivedData() reads from it.
const DERIVED_VERSION = "7"; // bump to force re-derive on existing local data
if (typeof window !== "undefined") {
  try {
    ensureSeedCompanies();
    seedLogiaGrandLivre(false);
    const current = localStorage.getItem("logia-derived-version");
    const force = current !== DERIVED_VERSION;
    seedLogiaDerivedData(force);
    const hasLogiaOpps = opportunitiesStore.items.some((o) => o.companyId === "log");
    if (force || !hasLogiaOpps) {
      seedLogiaOpportunities();
      localStorage.setItem("logia-derived-version", DERIVED_VERSION);
    }
  } catch { /* ignore */ }
}


/** Resolve an account code to its PCG entry by progressively shorter prefixes. */
export function pcgRoot(code: string): PcgAccount | undefined {
  for (let n = Math.min(code.length, 5); n >= 2; n--) {
    const hit = pcgIndex.get(code.slice(0, n));
    if (hit) return hit;
  }
  return undefined;
}

/** PCG class (1..7) derived from the first character of the account code. */
export function accountClass(code: string): PcgClass | undefined {
  const n = Number(code[0]);
  return n >= 1 && n <= 7 ? (n as PcgClass) : undefined;
}

/** Human label for an account (sub-account label, then PCG root, then code). */
export function accountLabel(code: string): string {
  return accountLabels[code] ?? pcgRoot(code)?.name ?? code;
}

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
