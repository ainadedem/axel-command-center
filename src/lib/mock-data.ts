// AXEL mock data layer — replace with Lovable Cloud queries in v2
export type Currency = "MGA" | "EUR" | "USD";

export const FX: Record<Currency, number> = {
  MGA: 1,
  EUR: 4850,
  USD: 4480,
};

export const toMGA = (amount: number, currency: Currency) => amount * FX[currency];

export interface Company {
  id: string;
  name: string;
  shortName: string;
  color: string;
  baseCurrency: Currency;
}

export const companies: Company[] = [
  { id: "axl", name: "Axel Holdings", shortName: "AXL", color: "oklch(0.78 0.14 165)", baseCurrency: "MGA" },
  { id: "nor", name: "Norvik Studio", shortName: "NRV", color: "oklch(0.72 0.13 220)", baseCurrency: "EUR" },
  { id: "kit", name: "Kitiya Trade", shortName: "KIT", color: "oklch(0.78 0.13 75)", baseCurrency: "USD" },
  { id: "ova", name: "Ovamada Tech", shortName: "OVA", color: "oklch(0.7 0.16 295)", baseCurrency: "EUR" },
];

export interface Account {
  id: string;
  companyId: string;
  name: string;
  type: "bank" | "mobile" | "cash";
  currency: Currency;
  balance: number;
}

export const accounts: Account[] = [
  { id: "a1", companyId: "axl", name: "BNI Madagascar", type: "bank", currency: "MGA", balance: 184_500_000 },
  { id: "a2", companyId: "axl", name: "Mvola Ops", type: "mobile", currency: "MGA", balance: 12_400_000 },
  { id: "a3", companyId: "nor", name: "Wise EUR", type: "bank", currency: "EUR", balance: 38_420 },
  { id: "a4", companyId: "nor", name: "Revolut EUR", type: "bank", currency: "EUR", balance: 11_900 },
  { id: "a5", companyId: "kit", name: "Mercury USD", type: "bank", currency: "USD", balance: 24_180 },
  { id: "a6", companyId: "ova", name: "Wise EUR", type: "bank", currency: "EUR", balance: 19_240 },
  { id: "a7", companyId: "ova", name: "BNI MGA", type: "bank", currency: "MGA", balance: 42_000_000 },
];

export interface Client {
  id: string;
  companyId: string;
  name: string;
  country: string;
}

export const clients: Client[] = [
  { id: "c1", companyId: "nor", name: "Linear", country: "USA" },
  { id: "c2", companyId: "nor", name: "Maison Margiela", country: "France" },
  { id: "c3", companyId: "kit", name: "Vertex Capital", country: "Singapore" },
  { id: "c4", companyId: "ova", name: "Helsinki Labs", country: "Finland" },
  { id: "c5", companyId: "ova", name: "Atelier Noir", country: "France" },
  { id: "c6", companyId: "axl", name: "Internal", country: "Madagascar" },
];

export interface Project {
  id: string;
  companyId: string;
  clientId: string;
  name: string;
  revenue: number;
  cost: number;
  currency: Currency;
}

export const projects: Project[] = [
  { id: "p1", companyId: "nor", clientId: "c1", name: "Linear Brand System", revenue: 48000, cost: 18400, currency: "EUR" },
  { id: "p2", companyId: "nor", clientId: "c2", name: "Margiela Capsule Site", revenue: 32000, cost: 14800, currency: "EUR" },
  { id: "p3", companyId: "kit", clientId: "c3", name: "Vertex Trade Flow", revenue: 62000, cost: 21000, currency: "USD" },
  { id: "p4", companyId: "ova", clientId: "c4", name: "Helsinki Platform v2", revenue: 78000, cost: 31200, currency: "EUR" },
  { id: "p5", companyId: "ova", clientId: "c5", name: "Atelier Noir App", revenue: 22000, cost: 9400, currency: "EUR" },
];

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

const today = new Date();
const dayOffset = (d: number) => {
  const x = new Date(today);
  x.setDate(x.getDate() - d);
  return x.toISOString().slice(0, 10);
};

export const transactions: Transaction[] = [
  { id: "t1", companyId: "nor", accountId: "a3", date: dayOffset(2), type: "income", category: "Services", description: "Linear — Milestone 2", amount: 16000, currency: "EUR", clientId: "c1", projectId: "p1" },
  { id: "t2", companyId: "axl", accountId: "a1", date: dayOffset(3), type: "expense", category: "Payroll", description: "Salaires Octobre", amount: 38_400_000, currency: "MGA" },
  { id: "t3", companyId: "kit", accountId: "a5", date: dayOffset(4), type: "income", category: "Services", description: "Vertex — Phase 1", amount: 24000, currency: "USD", clientId: "c3", projectId: "p3" },
  { id: "t4", companyId: "nor", accountId: "a4", date: dayOffset(6), type: "expense", category: "Software", description: "Figma + Linear annual", amount: 1840, currency: "EUR" },
  { id: "t5", companyId: "axl", accountId: "a1", date: dayOffset(7), type: "expense", category: "Office", description: "Loyer Q4 — Antananarivo", amount: 18_000_000, currency: "MGA" },
  { id: "t6", companyId: "ova", accountId: "a6", date: dayOffset(8), type: "income", category: "Services", description: "Helsinki — Sprint 4", amount: 19500, currency: "EUR", clientId: "c4", projectId: "p4" },
  { id: "t7", companyId: "nor", accountId: "a3", date: dayOffset(11), type: "intercompany", category: "Internal", description: "→ Axel Holdings (shared infra)", amount: 4200, currency: "EUR" },
  { id: "t8", companyId: "ova", accountId: "a7", date: dayOffset(12), type: "expense", category: "Contractors", description: "Équipe dev externe", amount: 14_200_000, currency: "MGA" },
  { id: "t9", companyId: "kit", accountId: "a5", date: dayOffset(14), type: "expense", category: "Logistics", description: "Shipping — SGP", amount: 3850, currency: "USD" },
  { id: "t10", companyId: "nor", accountId: "a3", date: dayOffset(18), type: "income", category: "Services", description: "Margiela — Deposit", amount: 12000, currency: "EUR", clientId: "c2", projectId: "p2" },
  { id: "t11", companyId: "ova", accountId: "a6", date: dayOffset(22), type: "income", category: "Services", description: "Atelier Noir — Sprint 1", amount: 8500, currency: "EUR", clientId: "c5", projectId: "p5" },
  { id: "t12", companyId: "axl", accountId: "a2", date: dayOffset(25), type: "expense", category: "Travel", description: "Vol Paris — fondateur", amount: 3_800_000, currency: "MGA" },
];

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

export const invoices: Invoice[] = [
  { id: "i1", number: "NRV-2026-041", companyId: "nor", clientId: "c1", issueDate: dayOffset(20), dueDate: dayOffset(-10), amount: 24000, paid: 0, currency: "EUR", status: "overdue" },
  { id: "i2", number: "NRV-2026-042", companyId: "nor", clientId: "c2", issueDate: dayOffset(8), dueDate: dayOffset(-22), amount: 20000, paid: 12000, currency: "EUR", status: "partial" },
  { id: "i3", number: "KIT-2026-018", companyId: "kit", clientId: "c3", issueDate: dayOffset(5), dueDate: dayOffset(-25), amount: 38000, paid: 0, currency: "USD", status: "sent" },
  { id: "i4", number: "OVA-2026-029", companyId: "ova", clientId: "c4", issueDate: dayOffset(2), dueDate: dayOffset(-28), amount: 19500, paid: 19500, currency: "EUR", status: "paid" },
  { id: "i5", number: "OVA-2026-030", companyId: "ova", clientId: "c5", issueDate: dayOffset(1), dueDate: dayOffset(-29), amount: 8500, paid: 0, currency: "EUR", status: "sent" },
];

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

export const opportunities: Opportunity[] = [
  { id: "o1", companyId: "nor", name: "Linear — Phase 3", client: "Linear", owner: "M.R.", stage: "Negotiation", value: 64000, currency: "EUR", expectedClose: dayOffset(-12) },
  { id: "o2", companyId: "nor", name: "Acme rebrand", client: "Acme", owner: "M.R.", stage: "Proposal", value: 42000, currency: "EUR", expectedClose: dayOffset(-22) },
  { id: "o3", companyId: "kit", name: "Vertex — Year 2", client: "Vertex Capital", owner: "S.A.", stage: "Qualified", value: 120000, currency: "USD", expectedClose: dayOffset(-55) },
  { id: "o4", companyId: "ova", name: "Helsinki Platform v3", client: "Helsinki Labs", owner: "T.O.", stage: "Negotiation", value: 96000, currency: "EUR", expectedClose: dayOffset(-30) },
  { id: "o5", companyId: "ova", name: "Atelier Noir retainer", client: "Atelier Noir", owner: "T.O.", stage: "Proposal", value: 36000, currency: "EUR", expectedClose: dayOffset(-18) },
  { id: "o6", companyId: "nor", name: "Northwave site", client: "Northwave", owner: "M.R.", stage: "Lead", value: 18000, currency: "EUR", expectedClose: dayOffset(-70) },
  { id: "o7", companyId: "kit", name: "Trade flow expansion", client: "Vertex Capital", owner: "S.A.", stage: "Won", value: 28000, currency: "USD", expectedClose: dayOffset(-5) },
  { id: "o8", companyId: "ova", name: "Polar internal tool", client: "Polar", owner: "T.O.", stage: "Lost", value: 22000, currency: "EUR", expectedClose: dayOffset(10) },
];

/* ===== Helpers ===== */
export const fmt = (amount: number, currency: Currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "MGA" ? 0 : 0,
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
