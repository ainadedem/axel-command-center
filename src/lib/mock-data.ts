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
  description: string;
  amount: number;
  currency: Currency;
  clientId?: string;
  projectId?: string;
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
  owner: string;
  stage: Stage;
  value: number;
  currency: Currency;
  expectedClose: string;
}

/* ─── Stores (start empty) ──────────────────────────────────────────── */

export const companiesStore = createCollection<Company>("companies", []);
export const accountsStore = createCollection<Account>("accounts", []);
export const clientsStore = createCollection<Client>("clients", []);
export const projectsStore = createCollection<Project>("projects", []);
export const transactionsStore = createCollection<Transaction>("transactions", []);
export const invoicesStore = createCollection<Invoice>("invoices", []);
export const opportunitiesStore = createCollection<Opportunity>("opportunities", []);

/* ─── Live array exports (backward compatibility) ───────────────────── */

export const companies = companiesStore.items;
export const accounts = accountsStore.items;
export const clients = clientsStore.items;
export const projects = projectsStore.items;
export const transactions = transactionsStore.items;
export const invoices = invoicesStore.items;
export const opportunities = opportunitiesStore.items;

/* ─── Hooks ─────────────────────────────────────────────────────────── */

export const useCompanies = () => useCollection(companiesStore);
export const useAccounts = () => useCollection(accountsStore);
export const useClients = () => useCollection(clientsStore);
export const useProjects = () => useCollection(projectsStore);
export const useTransactions = () => useCollection(transactionsStore);
export const useInvoices = () => useCollection(invoicesStore);
export const useOpportunities = () => useCollection(opportunitiesStore);

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
