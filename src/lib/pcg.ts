// PCG Madagascar 2005 — Plan Comptable Général (coherent with IAS/IFRS)
// Décret n°2004-272 du 18 février 2004
// Applied to companies that use PCG: Logia Madagascar + Axiom Unlimited.
import { createCollection, useCollection, newId } from "./data-store";


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
import clientsEnrichmentSeed from "./clients-enrichment-seed.json";
import axiomBankSeed from "./axiom-bank-seed.json";
import axiomCrmClientsSeed from "./axiom-clients-seed.json";
import {
  companiesStore, accountsStore, clientsStore, suppliersStore,
  invoicesStore, transactionsStore, categoriesStore, opportunitiesStore,
  teamMembersStore, salesMembersStore, projectsStore,
  FX, toMGA,
  type Account, type Client, type Supplier, type Invoice, type Transaction, type Category, type Opportunity,
  type TeamMember, type SalesMember, type SalesRole, type Project,
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
      const rawName = (l.label || "").trim();
      if (!rawName || rawName.toUpperCase() === "CLIENTS") continue;
      const name = canonicalClientName(rawName);
      // Index both the canonical and raw label so downstream lookups (invoices,
      // transactions) find the same client regardless of spelling variant.
      if (clientByName.has(name)) {
        clientByName.set(rawName, clientByName.get(name)!);
        continue;
      }
      const client: Client = {
        id: `cli_log_${slug(name)}`,
        companyId: "log",
        name,
        country: guessCountry(name),
      };
      clientByName.set(name, client);
      clientByName.set(rawName, client);
      clientsStore.add(client);
    }
  }

  /* ── Suppliers (401) ────────────────────────────────────────────── */
  const supplierByName = new Map<string, Supplier>();
  const internalNames = new Set<string>();
  for (const e of entries) {
    for (const l of e.lines) {
      if (!l.account.startsWith("401")) continue;
      const name = (l.label || "").trim();
      if (!name || name.toUpperCase() === "FOURNISSEURS") continue;
      if (l.account === "401200") internalNames.add(name);
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

  /* ── Team members (derived from internal 401200 payees) ─────────── */
  seedTeamFromInternalNames(internalNames);

  /* ── Invoices (VTE journal entries) ─────────────────────────────── */
  for (const e of entries) {
    if (e.journal !== "VTE") continue;
    const clientLine = e.lines.find((l) => l.account.startsWith("411") && l.debit > 0);
    if (!clientLine) continue;
    const client = clientByName.get((clientLine.label || "").trim());
    if (!client) continue;
    const amount = clientLine.debit;
    // Collect every matching 411 credit (payment) on/after the issue date.
    const payments: { date: string; amount: number }[] = [];
    for (const x of entries) {
      if (new Date(x.date) < new Date(e.date)) continue;
      for (const l of x.lines) {
        if (l.account.startsWith("411") && l.credit > 0 && l.label === clientLine.label) {
          payments.push({ date: x.date, amount: l.credit });
        }
      }
    }
    payments.sort((a, b) => a.date.localeCompare(b.date));
    const paid = payments.reduce((s, p) => s + p.amount, 0);
    const cappedPaid = Math.min(paid, amount);
    // paidDate = date on which the cumulative payments first cover the invoice amount.
    let paidDate: string | undefined;
    let acc = 0;
    for (const p of payments) {
      acc += p.amount;
      if (acc >= amount) { paidDate = p.date; break; }
    }
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
      paidDate,
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
/** Merge known client-name spelling variants onto a single canonical name. */
const CLIENT_NAME_ALIASES: Record<string, string> = {
  "AIRLINES MADAGASCAR": "MADAGASCAR AIRLINES",
};
function canonicalClientName(name: string): string {
  return CLIENT_NAME_ALIASES[name.toUpperCase()] ?? name;
}

function guessCountry(name: string): string {
  const u = name.toUpperCase();
  if (u.includes("CANADA")) return "Canada";
  if (u.includes("PNUD")) return "International";
  return "Madagascar";
}

/** Labels for sub-accounts (6-digit codes) used in the imported Grand Livre. */
export const accountLabels = logiaAccountLabels as Record<string, string>;

/** Skip non-person internal labels (categories rather than people). */
const NON_PERSON_INTERNAL = new Set(["HONORAIRES CONSULTANTS INTERNE", "FOURNISSEURS"]);

/** Convert "PRIVAT JOVIN" → "Privat Jovin", keep single words capitalised. */
function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Derive Team members from the internal supplier names found in the Grand Livre.
 *  Convention: first token = first name, remaining tokens = last name. */
function seedTeamFromInternalNames(names: Set<string>) {
  const existing = teamMembersStore.items;
  const byName = new Map(existing.map((t) => [t.name.toLowerCase(), t]));
  const next: TeamMember[] = [...existing];
  for (const raw of names) {
    if (NON_PERSON_INTERNAL.has(raw.toUpperCase())) continue;
    const tokens = raw.trim().split(/\s+/).map(titleCase);
    const firstName = tokens[0] ?? "";
    const lastName = tokens.slice(1).join(" ");
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    if (!fullName) continue;
    const existingTm = byName.get(fullName.toLowerCase());
    if (existingTm) {
      // Backfill split fields if missing (legacy rows).
      if (!existingTm.firstName || !existingTm.lastName) {
        const idx = next.findIndex((t) => t.id === existingTm.id);
        if (idx >= 0) next[idx] = { ...existingTm, firstName, lastName: lastName || existingTm.lastName };
      }
      continue;
    }
    const tm: TeamMember = {
      id: newId("tm"),
      name: fullName,
      firstName,
      lastName: lastName || undefined,
      department: "Interne",
      jobTitle: "Consultant interne",
    };
    next.push(tm);
    byName.set(fullName.toLowerCase(), tm);
  }
  teamMembersStore.replaceAll(next);
}


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

  // 4) Derive Team + Sales-team from the names found across acquisitions and closers.
  const acqNames = new Set<string>();
  for (const v of acqByClient.values()) acqNames.add(v);
  const closerNames = new Set<string>();
  for (const o of cleaned) if (o.closer) closerNames.add(o.closer);

  const allNames = new Set<string>([...acqNames, ...closerNames]);
  const existingTeam = teamMembersStore.items;
  const teamByName = new Map(existingTeam.map((t) => [t.name.toLowerCase(), t]));
  const newTeam: TeamMember[] = [...existingTeam];
  for (const name of allNames) {
    if (!teamByName.has(name.toLowerCase())) {
      const tm: TeamMember = { id: newId("tm"), name, department: "Sales" };
      newTeam.push(tm);
      teamByName.set(name.toLowerCase(), tm);
    }
  }
  teamMembersStore.replaceAll(newTeam);

  // Sales team membership (one row per team member that does sales).
  const existingSales = salesMembersStore.items;
  const salesByTm = new Map(existingSales.map((s) => [s.teamMemberId, s]));
  const newSales: SalesMember[] = [...existingSales];
  for (const name of allNames) {
    const tm = teamByName.get(name.toLowerCase())!;
    const isAcq = acqNames.has(name);
    const isCloser = closerNames.has(name);
    const role: SalesRole = isAcq && isCloser ? "both" : isAcq ? "acquisition" : "closer";
    const existing = salesByTm.get(tm.id);
    if (!existing) {
      newSales.push({ id: newId("sm"), teamMemberId: tm.id, role });
    } else if (existing.role !== role && existing.role !== "both") {
      // Promote to "both" if a new role appears.
      const idx = newSales.findIndex((s) => s.id === existing.id);
      newSales[idx] = { ...existing, role: existing.role === role ? role : "both" };
    }
  }
  salesMembersStore.replaceAll(newSales);

  return cleaned.length;
}

/** Replace all Axiom-scoped opportunities with the AXD Sales CRM snapshot.
 *  Mirrors the Notion view: Trembley (Modélisation Meubles, monthly, €1,230 invoiced
 *  in Jan/Feb then €0 pipeline through Aug) + Dein Deal (Ad prevision, monthly €2,350
 *  Jan–Dec). Jan/Feb deals are already Closed/Paid (linked to INV-26-0001..0004),
 *  later months are Closed/Not started in Notion. */
export function seedAxiomOpportunities() {
  const closer = "Dedem";
  const seeds: Opportunity[] = [];
  const months = [
    { m: "01", label: "Jan", close: "2026-01-26" },
    { m: "02", label: "Feb", close: "2026-02-25" },
    { m: "03", label: "Mar", close: "2026-03-25" },
    { m: "04", label: "Apr", close: "2026-04-24" },
    { m: "05", label: "May", close: "2026-05-22" },
    { m: "06", label: "Jun", close: "2026-06-30" },
    { m: "07", label: "Jul", close: "2026-07-31" },
    { m: "08", label: "Aug", close: "2026-08-31" },
    { m: "09", label: "Sep", close: "2026-09-30" },
    { m: "10", label: "Oct", close: "2026-10-31" },
    { m: "11", label: "Nov", close: "2026-11-30" },
    { m: "12", label: "Dec", close: "2026-12-31" },
  ];

  // Today (seed-time): months strictly before today's month are "Closed"
  // (already invoiced/paid). Current and future months remain in the active
  // pipeline as "In progress" so they show up on the dashboard pipeline KPI
  // and feed the sales forecast.
  const today = new Date();
  const cutoff = today.getFullYear() * 100 + (today.getMonth() + 1); // YYYYMM

  for (const mo of months) {
    const ym = 2026 * 100 + parseInt(mo.m, 10);
    const isPast = ym < cutoff;

    // Trembley — only Jan/Feb materialised (€1,230 each, invoiced & paid).
    // Mar–Aug were "€0 pipeline" in Notion → drop entirely (no revenue expected).
    if (["01", "02"].includes(mo.m)) {
      seeds.push({
        id: `opp_axi_trembley_${mo.m}`, companyId: "axi",
        name: `Production Modélisation Meubles (${mo.label} 2026)`,
        client: "Trembley et Burgermeister SA", clientId: "cli_axi_trembley",
        closer, stage: "Closed", value: 1230, currency: "EUR", expectedClose: mo.close,
      });
    }

    // Dein Deal — Ad prevision, every month Jan–Dec at €2,350.
    const name = mo.m === "01"
      ? "Production January 2026"
      : `Dein Deal — Ad prevision (${mo.label} 2026)`;
    seeds.push({
      id: `opp_axi_deindeal_${mo.m}`, companyId: "axi",
      name, client: "Dein Deal", clientId: "cli_axi_deindeal",
      closer, stage: isPast ? "Closed" : "In progress",
      value: 2350, currency: "EUR", expectedClose: mo.close,
    });
  }

  const others = opportunitiesStore.items.filter((o) => o.companyId !== "axi");
  opportunitiesStore.replaceAll([...others, ...seeds]);
  return seeds.length;
}


/** Normalise a client name for fuzzy matching (lowercase, ascii-only, alphanumeric+space). */
function normalizeClientKey(s: string): string {
  return s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

interface ClientEnrichmentRow {
  name: string; nameKey: string;
  website?: string | null; email?: string | null; phone?: string | null;
  address?: string | null; industry?: string | null; contacts?: string | null;
  acquisition?: string | null; acquisitionYear?: number | null;
}

/** Fill in missing fields on existing clients from the Notion accounts export.
 *  Existing values are never overwritten — this only adds info that's missing. */
export function enrichClientsFromAccounts() {
  const rows = clientsEnrichmentSeed as ClientEnrichmentRow[];
  const byKey = new Map<string, ClientEnrichmentRow>();
  for (const r of rows) byKey.set(r.nameKey, r);

  const updated = clientsStore.items.map((c) => {
    const r = byKey.get(normalizeClientKey(c.name));
    if (!r) return c;
    const next: Client = { ...c };
    if (!next.website && r.website) next.website = r.website;
    if (!next.email && r.email) next.email = r.email;
    if (!next.phone && r.phone) next.phone = r.phone;
    if (!next.address && r.address) next.address = r.address;
    if (!next.industry && r.industry) next.industry = r.industry;
    if (!next.contacts && r.contacts) next.contacts = r.contacts;
    if (!next.acquisition && r.acquisition) next.acquisition = r.acquisition;
    if (!next.acquisitionYear && r.acquisitionYear) {
      next.acquisitionYear = r.acquisitionYear;
      if (!next.acquiredAt) next.acquiredAt = `${r.acquisitionYear}-01-01`;
    }
    return next;
  });
  clientsStore.replaceAll(updated);
}

// Auto-seed on first load (idempotent). Declared AFTER `accountLabels`
// because seedLogiaDerivedData() reads from it.
const DERIVED_VERSION = "12"; // bump to force re-derive on existing local data
const AXIOM_INVOICES_VERSION = "3";
const AXIOM_BANK_VERSION = "2";
const AXIOM_RECONCILE_VERSION = "1";
const AXIOM_OPPS_VERSION = "2";
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
    if (force) enrichClientsFromAccounts();

    const axCurrent = localStorage.getItem("axiom-invoices-version");
    if (axCurrent !== AXIOM_INVOICES_VERSION) {
      seedAxiomInvoices(true);
      localStorage.setItem("axiom-invoices-version", AXIOM_INVOICES_VERSION);
    }

    const axBankCurrent = localStorage.getItem("axiom-bank-version");
    if (axBankCurrent !== AXIOM_BANK_VERSION) {
      seedAxiomBankStatement(true);
      localStorage.setItem("axiom-bank-version", AXIOM_BANK_VERSION);
    }

    // Reconcile Axiom invoices against MCB bank transactions.
    // Re-runs whenever invoices, bank statement, or the reconcile logic version bump.
    const reconcileKey = `${AXIOM_INVOICES_VERSION}.${AXIOM_BANK_VERSION}.${AXIOM_RECONCILE_VERSION}`;
    if (localStorage.getItem("axiom-reconcile-key") !== reconcileKey) {
      // Defer to ensure function declaration is hoisted in all bundling modes
      queueMicrotask(() => {
        reconcileAxiomInvoices();
        localStorage.setItem("axiom-reconcile-key", reconcileKey);
      });
    }

    const axOppsCurrent = localStorage.getItem("axiom-opps-version");
    const hasAxiomOpps = opportunitiesStore.items.some((o) => o.companyId === "axi");
    if (axOppsCurrent !== AXIOM_OPPS_VERSION || !hasAxiomOpps) {
      seedAxiomOpportunities();
      localStorage.setItem("axiom-opps-version", AXIOM_OPPS_VERSION);
    }

    seedAxiomCrmClients();
  } catch { /* ignore */ }
}

/**
 * Import CRM clients from CSV-derived seed (Axiom client roster).
 * Idempotent: dedupes by canonical name across ALL companies — if a client
 * with the same name already exists, it is skipped.
 */
export function seedAxiomCrmClients() {
  ensureSeedCompanies();
  const existing = new Set(
    clientsStore.items.map((c) => canonicalClientName(c.name).toLowerCase()),
  );
  type Seed = {
    name: string; type: string; year?: number; website?: string; contacts?: string;
    email?: string; address?: string; industry?: string; acquisition?: string;
  };
  let added = 0;
  for (const s of axiomCrmClientsSeed as Seed[]) {
    const key = canonicalClientName(s.name).toLowerCase();
    if (!key || existing.has(key)) continue;
    existing.add(key);
    const client: Client = {
      id: `cli_axi_${slug(s.name)}`,
      companyId: "axi",
      name: s.name,
      country: guessCountry(s.address || s.name),
      status: "client",
      website: s.website || undefined,
      email: s.email || undefined,
      address: s.address || undefined,
      industry: s.industry || undefined,
      contacts: s.contacts || undefined,
      acquisition: s.acquisition || undefined,
      acquisitionYear: s.year,
    };
    clientsStore.add(client);
    added++;
  }
  return added;
}

/**
 * Seed Axiom Unlimited (id "axi") with the real invoices issued under the
 * Axiom Winford Group brand. Idempotent: wipes Axiom-scoped clients/invoices
 * created by previous seeds before re-inserting.
 */
export function seedAxiomInvoices(force = false) {
  ensureSeedCompanies();

  // Upgrade the Axiom company record with full billing/legal info.
  const axi = companiesStore.items.find((c) => c.id === "axi");
  if (axi) {
    companiesStore.update("axi", {
      legalName: "Axiom Winford Group",
      address: "Lot 047 D Ambohibao Antananarivo 105 Madagascar",
      email: "hello@weaxiom.com",
      phone: "+261 34 25 886 11",
      website: "www.weaxiom.com",
      bankName: "The Mauritius Commercial Bank (Madagascar)",
      bankAccount: "00006 00005 00000834602 28",
    });
  }

  const hasAxiomInvoices = invoicesStore.items.some(
    (i) => i.companyId === "axi" && i.number.startsWith("INV-26-"),
  );
  if (hasAxiomInvoices && !force) return 0;

  // Wipe previously seeded Axiom clients + INV-26- invoices.
  invoicesStore.replaceAll(
    invoicesStore.items.filter(
      (i) => !(i.companyId === "axi" && i.number.startsWith("INV-26-")),
    ),
  );
  const seededClientIds = new Set(["cli_axi_deindeal", "cli_axi_trembley", "cli_axi_logia"]);
  clientsStore.replaceAll(
    clientsStore.items.filter((c) => !seededClientIds.has(c.id)),
  );

  const clientSeeds: Client[] = [
    {
      id: "cli_axi_deindeal", companyId: "axi", name: "Dein Deal",
      country: "Switzerland", address: "Flurstrasse 55, Zurich 8048, Switzerland",
    },
    {
      id: "cli_axi_trembley", companyId: "axi", name: "Trembley et Burgermeister SA",
      country: "Switzerland", address: "Chemin de l'Epinglier 4, Switzerland",
    },
    {
      id: "cli_axi_logia", companyId: "axi", name: "Logia Madagascar",
      country: "Madagascar",
      address: "047 D Ambohibao Antehiroka Antananarivo, Madagascar",
      phone: "+261 32 03 886 12", nif: "4017782704", stat: "58111 11 2023 0 10439",
    },
  ];
  for (const c of clientSeeds) {
    if (!clientsStore.items.some((x) => x.id === c.id)) clientsStore.add(c);
  }

  // Wipe previously seeded Axiom projects so re-runs are clean.
  const seededProjectIds = new Set([
    "proj_axi_deindeal_2026", "proj_axi_trembley_jan", "proj_axi_trembley_feb",
    "proj_axi_logia_webflow",
  ]);
  projectsStore.replaceAll(
    projectsStore.items.filter((p) => !seededProjectIds.has(p.id)),
  );

  // Projects:
  // - Dein Deal: ONE recurring monthly project, 4 invoices.
  // - Trembley: each invoice is its OWN project (same client, distinct deliverables).
  // - Logia: one Webflow project.
  const projectSeeds: Project[] = [
    { id: "proj_axi_deindeal_2026", companyId: "axi", clientId: "cli_axi_deindeal",
      name: "Production 2026", revenue: 2350 * 4, cost: 0, currency: "EUR" },
    { id: "proj_axi_trembley_jan", companyId: "axi", clientId: "cli_axi_trembley",
      name: "Production Modélisation Meubles", revenue: 1230, cost: 0, currency: "EUR" },
    { id: "proj_axi_trembley_feb", companyId: "axi", clientId: "cli_axi_trembley",
      name: "Production Modélisation Meubles", revenue: 1230, cost: 0, currency: "EUR" },
    { id: "proj_axi_logia_webflow", companyId: "axi", clientId: "cli_axi_logia",
      name: "Accompagnement dans l'intégration sur Webflow", revenue: 1_800_000, cost: 0, currency: "MGA" },
  ];
  for (const p of projectSeeds) {
    if (!projectsStore.items.some((x) => x.id === p.id)) projectsStore.add(p);
  }

  const inv = (
    n: string, clientId: string, projectId: string, issue: string, amount: number,
    currency: "EUR" | "MGA",
  ): Invoice => ({
    id: `inv_axi_${n}`, number: n, companyId: "axi", clientId, projectId,
    issueDate: issue, dueDate: issue, amount, paid: 0, currency, status: "sent",
  });

  const seeds: Invoice[] = [
    inv("INV-26-0001", "cli_axi_deindeal", "proj_axi_deindeal_2026", "2026-01-26", 2350, "EUR"),
    inv("INV-26-0002", "cli_axi_trembley", "proj_axi_trembley_jan",  "2026-01-26", 1230, "EUR"),
    inv("INV-26-0003", "cli_axi_trembley", "proj_axi_trembley_feb",  "2026-02-25", 1230, "EUR"),
    inv("INV-26-0004", "cli_axi_deindeal", "proj_axi_deindeal_2026", "2026-02-25", 2350, "EUR"),
    inv("INV-26-0005", "cli_axi_deindeal", "proj_axi_deindeal_2026", "2026-03-25", 2350, "EUR"),
    inv("INV-26-0006", "cli_axi_deindeal", "proj_axi_deindeal_2026", "2026-04-25", 2350, "EUR"),
    inv("INV-26-0008", "cli_axi_logia",    "proj_axi_logia_webflow", "2026-05-15", 1_800_000, "MGA"),
  ];
  for (const i of seeds) invoicesStore.add(i);

  return seeds.length;
}

/**
 * Seed Axiom Unlimited's MCB bank account + transactions from the imported
 * bank statement (Jan–Apr 2026). Idempotent: removes prior seeded rows on
 * each version bump and re-inserts.
 */
export function seedAxiomBankStatement(force = false) {
  ensureSeedCompanies();

  const ACCOUNT_ID = "acc_axi_mcb";
  const seedIdPrefix = "txn_axi_mcb_";

  const hasSeeded = transactionsStore.items.some((t) => t.id.startsWith(seedIdPrefix));
  if (hasSeeded && !force) return 0;

  // Wipe any prior seeded MCB transactions and the seeded account itself.
  transactionsStore.replaceAll(
    transactionsStore.items.filter((t) => !t.id.startsWith(seedIdPrefix)),
  );
  accountsStore.replaceAll(accountsStore.items.filter((a) => a.id !== ACCOUNT_ID));

  const rows = axiomBankSeed as Array<{
    id: string; date: string; type: "income" | "expense";
    description: string; reference: string; amount: number;
  }>;

  // Compute closing balance from the imported flows.
  const closing = rows.reduce(
    (n, r) => n + (r.type === "income" ? r.amount : -r.amount),
    0,
  );

  accountsStore.add({
    id: ACCOUNT_ID,
    companyId: "axi",
    name: "MCB — Compte courant",
    type: "bank",
    currency: "MGA",
    balance: Math.round(closing),
  });

  const categoryFor = (desc: string, type: "income" | "expense"): string => {
    const d = desc.toLowerCase();
    if (d.startsWith("frais") || d.startsWith("tva")) return "Frais bancaires";
    if (d.includes("swift") || d.includes("virement recu") || d.includes("virement reçu"))
      return "Encaissements clients";
    if (d.startsWith("depot en especes") || d.startsWith("dépôt")) return "Dépôts espèces";
    if (d.startsWith("db vente carte")) return "Paiements carte";
    if (d.startsWith("prelevement") || d.startsWith("prélèvement")) return "Prélèvements";
    if (d.includes("transfert compte a compte") || d.includes("transfert compte à compte"))
      return "Virements internes";
    return type === "income" ? "Autres encaissements" : "Autres décaissements";
  };

  for (const r of rows) {
    transactionsStore.add({
      id: r.id,
      companyId: "axi",
      accountId: ACCOUNT_ID,
      date: r.date,
      type: r.type,
      category: categoryFor(r.description, r.type),
      description: r.reference ? `${r.description} · ${r.reference}` : r.description,
      amount: r.amount,
      currency: "MGA",
    });
  }

  return rows.length;
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

/**
 * Reconcile Axiom invoices against MCB bank transactions.
 * For each Axiom invoice, scans imported MCB transactions for the invoice number
 * in the description, applies the received amount as payment (handles MGA-vs-EUR/USD
 * conversion via the FX table), updates status + paidDate, and writes a separate
 * "Gain de change" / "Perte de change" transaction for any FX variance.
 * Idempotent: resets each Axiom invoice's paid/paidDate first, and removes any
 * previously inserted FX adjustment entries before re-running.
 */
export function reconcileAxiomInvoices() {
  const ACCOUNT_ID = "acc_axi_mcb";
  const account = accountsStore.items.find((a) => a.id === ACCOUNT_ID);
  if (!account) return;

  // Reset Axiom invoices to unpaid before reconciling
  const axiomInvoices = invoicesStore.items.filter((i) => i.companyId === "axi");
  for (const inv of axiomInvoices) {
    invoicesStore.update(inv.id, { paid: 0, paidDate: undefined, status: "sent" });
  }

  // Remove any previously generated FX adjustment entries
  const fxIds = transactionsStore.items
    .filter((t) => t.companyId === "axi" && (t.category === "Gain de change" || t.category === "Perte de change"))
    .map((t) => t.id);
  for (const id of fxIds) transactionsStore.remove(id);

  // Index Axiom income transactions on the MCB account for matching
  const mcbIncome = transactionsStore.items.filter(
    (t) => t.accountId === ACCOUNT_ID && t.type === "income",
  );

  // Aggregate payments per invoice
  const payments = new Map<string, { received: number; latestDate: string; txIds: string[] }>();
  for (const tx of mcbIncome) {
    const desc = tx.description.toLowerCase();
    const descNorm = desc.replace(/[^a-z0-9]/g, "");
    const match = axiomInvoices.find((inv) => {
      const n = inv.number.toLowerCase();
      const nNorm = n.replace(/[^a-z0-9]/g, "");
      return n.length >= 3 && (desc.includes(n) || (nNorm.length >= 4 && descNorm.includes(nNorm)));
    });
    if (!match) continue;
    const cur = payments.get(match.id) ?? { received: 0, latestDate: tx.date, txIds: [] };
    cur.received += tx.amount;
    if (tx.date > cur.latestDate) cur.latestDate = tx.date;
    cur.txIds.push(tx.id);
    payments.set(match.id, cur);
    // Backlink the source transaction to the invoice
    transactionsStore.update(tx.id, {
      invoiceId: match.id,
      clientId: match.clientId,
      projectId: match.projectId,
      category: "Encaissements clients",
    });
  }

  // Apply payments + emit FX adjustments
  for (const [invId, { received, latestDate }] of payments) {
    const inv = invoicesStore.items.find((i) => i.id === invId);
    if (!inv) continue;
    let invoicePaid: number;
    let fxDelta = 0;
    if (inv.currency === account.currency) {
      invoicePaid = received;
    } else {
      const receivedInInvCcy = toMGA(received, account.currency) / FX[inv.currency];
      invoicePaid = Math.min(receivedInInvCcy, inv.amount);
      const settledInAcctCcy = toMGA(invoicePaid, inv.currency) / FX[account.currency];
      fxDelta = received - settledInAcctCcy;
    }
    const newStatus: Invoice["status"] =
      invoicePaid + 0.01 >= inv.amount && inv.amount > 0 ? "paid"
      : invoicePaid > 0 ? "partial"
      : inv.status;
    invoicesStore.update(invId, {
      paid: invoicePaid,
      paidDate: latestDate,
      status: newStatus,
    });

    if (Math.abs(fxDelta) >= 1) {
      const isGain = fxDelta > 0;
      transactionsStore.add({
        id: newId("tx"),
        companyId: "axi",
        accountId: "",
        date: latestDate,
        type: isGain ? "income" : "expense",
        category: isGain ? "Gain de change" : "Perte de change",
        description: `FX ${isGain ? "gain" : "loss"} · ${inv.number} (${inv.currency} → ${account.currency})`,
        amount: Math.abs(fxDelta),
        currency: account.currency,
        clientId: inv.clientId,
        projectId: inv.projectId,
        invoiceId: inv.id,
        source: "statement",
      });
    }
  }

  // Mark still-unpaid Axiom invoices as overdue when past due
  const today = new Date().toISOString().slice(0, 10);
  for (const inv of invoicesStore.items.filter((i) => i.companyId === "axi" && i.paid <= 0)) {
    if (inv.dueDate < today) {
      invoicesStore.update(inv.id, { status: "overdue" });
    }
  }
}
