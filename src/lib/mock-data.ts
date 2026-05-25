// AXEL data layer — reactive collections persisted to localStorage.
// Each collection exposes a live array (mutated in place) and a hook
// that triggers re-renders on changes.
import { createCollection, useCollection } from "./data-store";

export type Currency = "MGA" | "EUR" | "USD";

export const FX: Record<Currency, number> = {
  MGA: 1,
  EUR: 4850,
  USD: 4480,
};

export const toMGA = (amount: number, currency: Currency) => amount * FX[currency];

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface Company {
  id: string;
  name: string;
  shortName: string;
  color: string;
  baseCurrency: Currency;
}

export interface Account {
  id: string;
  companyId: string;
  name: string;
  type: "bank" | "mobile" | "cash";
  currency: Currency;
  balance: number;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  country: string;
  /** Client acquisition person — the one who brought this client. Single source of truth across all tables. */
  acquisition?: string;
  /** ISO date (YYYY-MM-DD) when the client was acquired. */
  acquiredAt?: string;
  /** Profile picture stored as a data URL or remote URL. */
  avatarUrl?: string;
}

export interface Project {
  id: string;
  companyId: string;
  clientId: string;
  name: string;
  revenue: number;
  cost: number;
  currency: Currency;
}

export interface Transaction {
  id: string;
  companyId: string;
  accountId: string;
  date: string;
  type: "income" | "expense" | "transfer" | "intercompany";
  category: string;
  categoryId?: string;
  description: string;
  amount: number;
  currency: Currency;
  clientId?: string;
  supplierId?: string;
  projectId?: string;
}

/** A spending/income category, scoped per company. */
export interface Category {
  id: string;
  companyId: string;
  name: string;
  /** Drives which transactions count toward this category's budget. */
  kind: "expense" | "income";
  /** Optional PCG account code this category maps to (e.g. "606100"). */
  account?: string;
  color?: string;
}

/** Yearly budget plan for a category (one row per year). */
export interface Budget {
  id: string;
  companyId: string;
  categoryId: string;
  year: number;
  amount: number;
  currency: Currency;
}


export interface Invoice {
  id: string;
  number: string;
  companyId: string;
  clientId: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paid: number;
  currency: Currency;
  status: "draft" | "sent" | "partial" | "paid" | "overdue";
}

export type Stage = "Lead" | "Qualified" | "Proposal" | "Negotiation" | "Won" | "Lost";
export const stages: Stage[] = ["Lead", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];
export const stageProbability: Record<Stage, number> = {
  Lead: 0.1, Qualified: 0.25, Proposal: 0.5, Negotiation: 0.75, Won: 1, Lost: 0,
};

export interface Opportunity {
  id: string;
  companyId: string;
  name: string;
  client: string;
  /** Closer in charge of finalizing the deal. Acquisition lives on the Client. */
  closer?: string;
  stage: Stage;
  value: number;
  currency: Currency;
  expectedClose: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  /** PCG account number (e.g. 401000 external, 401200 internal). */
  account: string;
  /** "external" = vendor, "internal" = staff reimbursements / honoraires internes. */
  kind: "external" | "internal";
  /** Profile picture (data URL or remote URL). */
  avatarUrl?: string;
}

/* ─── Team & Sales team ─────────────────────────────────────────────── */

/** A person in the organization (Team database, source of truth). */
export interface TeamMember {
  id: string;
  name: string;
  email?: string;
  jobTitle?: string;
  department?: string;
  /** Profile picture (data URL or remote URL). */
  avatarUrl?: string;
}

export type SalesRole = "acquisition" | "closer" | "both";

/** Sales team is a curated subset of the Team database with a sales role. */
export interface SalesMember {
  id: string;
  teamMemberId: string;
  role: SalesRole;
}

/* ─── Stores (start empty) ──────────────────────────────────────────── */

export const companiesStore = createCollection<Company>("companies", []);
export const accountsStore = createCollection<Account>("accounts", []);
export const clientsStore = createCollection<Client>("clients", []);
export const suppliersStore = createCollection<Supplier>("suppliers", []);
export const projectsStore = createCollection<Project>("projects", []);
export const transactionsStore = createCollection<Transaction>("transactions", []);
export const invoicesStore = createCollection<Invoice>("invoices", []);
export const opportunitiesStore = createCollection<Opportunity>("opportunities", []);
export const categoriesStore = createCollection<Category>("categories", []);
export const budgetsStore = createCollection<Budget>("budgets", []);
export const teamMembersStore = createCollection<TeamMember>("team-members", []);
export const salesMembersStore = createCollection<SalesMember>("sales-members", []);

/* ─── Live array exports (backward compatibility) ───────────────────── */

export const companies = companiesStore.items;
export const accounts = accountsStore.items;
export const clients = clientsStore.items;
export const suppliers = suppliersStore.items;
export const projects = projectsStore.items;
export const transactions = transactionsStore.items;
export const invoices = invoicesStore.items;
export const opportunities = opportunitiesStore.items;
export const categories = categoriesStore.items;
export const budgets = budgetsStore.items;
export const teamMembers = teamMembersStore.items;
export const salesMembers = salesMembersStore.items;

/* ─── Hooks ─────────────────────────────────────────────────────────── */

export const useCompanies = () => useCollection(companiesStore);
export const useAccounts = () => useCollection(accountsStore);
export const useClients = () => useCollection(clientsStore);
export const useSuppliers = () => useCollection(suppliersStore);
export const useProjects = () => useCollection(projectsStore);
export const useTransactions = () => useCollection(transactionsStore);
export const useInvoices = () => useCollection(invoicesStore);
export const useOpportunities = () => useCollection(opportunitiesStore);
export const useCategories = () => useCollection(categoriesStore);
export const useBudgets = () => useCollection(budgetsStore);
export const useTeamMembers = () => useCollection(teamMembersStore);
export const useSalesMembers = () => useCollection(salesMembersStore);

/** Convenience: list of sales-team people (with team name) filtered by role. */
export function useSalesPeople(role: "acquisition" | "closer"): { id: string; teamMemberId: string; name: string }[] {
  const sm = useSalesMembers();
  const tm = useTeamMembers();
  const byId = new Map(tm.map((t) => [t.id, t]));
  return sm
    .filter((s) => s.role === role || s.role === "both")
    .map((s) => ({ id: s.id, teamMemberId: s.teamMemberId, name: byId.get(s.teamMemberId)?.name ?? "" }))
    .filter((p) => p.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}


/* ─── Formatters ────────────────────────────────────────────────────── */

export const fmt = (amount: number, currency: Currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export const fmtCompact = (amount: number, currency: Currency) => {
  const abs = Math.abs(amount);
  let value = amount;
  let suffix = "";
  if (abs >= 1_000_000_000) { value = amount / 1_000_000_000; suffix = "B"; }
  else if (abs >= 1_000_000) { value = amount / 1_000_000; suffix = "M"; }
  else if (abs >= 1_000) { value = amount / 1_000; suffix = "k"; }
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "Ar";
  const num = value.toLocaleString("en-US", { maximumFractionDigits: suffix ? 1 : 0 });
  return currency === "MGA" ? `${num}${suffix} ${symbol}` : `${symbol}${num}${suffix}`;
};
