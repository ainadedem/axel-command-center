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
  /** Short alphanumeric identifier (e.g. "LOG", "WIN") used everywhere we
   *  need a compact reference instead of the full trading name. */
  code: string;
  color: string;
  baseCurrency: Currency;

  /** Legal / billing information used on invoice PDFs. */
  legalName?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  /** Madagascar tax IDs. */
  nif?: string;
  stat?: string;
  rcs?: string;
  /** Generic VAT / tax identifier (intl. fallback). */
  taxId?: string;
  bankName?: string;
  bankAccount?: string;
  /** SWIFT / BIC for international wires. */
  bankSwift?: string;
  /** Logo data URL or remote URL printed in the header. */
  logoUrl?: string;
}

export interface Account {
  id: string;
  companyId: string;
  name: string;
  type: "bank" | "mobile" | "cash";
  currency: Currency;
  balance: number;
  /** ISO datetime of the last bank statement CSV upload. */
  statementUploadedAt?: string;
  /** Filename of the last uploaded statement (for display). */
  statementName?: string;
}

export interface Client {
  id: string;
  /** Primary owning company (kept for historical references). */
  companyId: string;
  /** All companies this client is shared with. Defaults to [companyId]. */
  companyIds?: string[];
  name: string;
  country: string;
  /**
   * "lead" = prospect captured via the pipeline (not yet won).
   * "client" = active customer (won deal, invoiced, or manually promoted).
   * Undefined is treated as "client" for backward compatibility.
   */
  status?: "lead" | "client";
  /** Client acquisition person — the one who brought this client. Single source of truth across all tables. */
  acquisition?: string;
  /** Referral — another team member credited for this client. */
  referral?: string;
  /** ISO date (YYYY-MM-DD) when the client was acquired. */
  acquiredAt?: string;
  /** Year the client was acquired (used when only a year is known). */
  acquisitionYear?: number;
  /** Profile picture stored as a data URL or remote URL. */
  avatarUrl?: string;
  /** Marketing/contact info. */
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  industry?: string;
  /** Free-text list of key contacts at the company. */
  contacts?: string;
  /** Legal tax identifiers (printed on invoices). */
  taxId?: string;
  nif?: string;
  stat?: string;
  rcs?: string;
  /** Contact categories — supports multiple (client, supplier, referral, partner). */
  categories?: ContactCategory[];
}

/** Multi-select contact category, shared between Client and Supplier records. */
export type ContactCategory = "client" | "supplier" | "referral" | "partner";

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
  /** When the transaction was matched against an invoice (payment). */
  invoiceId?: string;
  /** Source of the transaction (manual entry or imported statement). */
  source?: "manual" | "statement";
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
  /** Optional link to the project this invoice bills against. */
  projectId?: string;
  /** Required (in workflow) — the accepted PO this invoice fulfils. */
  poId?: string;
  /** Convenience: quote that the PO descends from. */
  quoteId?: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  paid: number;
  /** ISO date of the latest client payment (411 credit) applied to this invoice. */
  paidDate?: string;
  currency: Currency;
  status: "draft" | "sent" | "partial" | "paid" | "overdue" | "cancelled";
  /** ISO timestamp when invoice was cancelled. */
  cancelledAt?: string;
  /** Required comment explaining the cancellation. */
  cancellationReason?: string;
  /** Line items inherited from the source quote / PO for information consistency. */
  lines?: QuoteLine[];
}

/* ─── Sales process: Quote → PO → Invoice ───────────────────────────── */

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export interface QuoteLine {
  id: string;
  description: string;
  /** Capability bucket from the rate card (CREATIVE / PR / PRODUCTION / MEDIA). */
  capability?: string;
  /** Level code (P1…P10). */
  level?: string;
  unit: "hour" | "day" | "fixed";
  quantity: number;
  /** Per-unit price in the quote's currency. */
  rate: number;
}
export type QuoteMode = "rate-card" | "standard";
export interface Quote {
  id: string;
  number: string;
  companyId: string;
  clientId: string;
  projectId?: string;
  issueDate: string;
  /** Date the quote stops being valid. */
  validUntil: string;
  amount: number;
  currency: Currency;
  status: QuoteStatus;
  notes?: string;
  /** Pricing mode — rate-card (capability/level driven) or standard (free-form). */
  mode?: QuoteMode;
  /** Line items — priced from rate card or free-form depending on mode. */
  lines?: QuoteLine[];
}

export type POStatus = "draft" | "issued" | "fulfilled" | "cancelled";
export interface PurchaseOrder {
  id: string;
  number: string;
  companyId: string;
  clientId: string;
  projectId?: string;
  /** Quote this PO descends from (recommended). */
  quoteId?: string;
  /** Client-side PO reference (their internal number). */
  clientReference?: string;
  issueDate: string;
  amount: number;
  currency: Currency;
  status: POStatus;
  /** Uploaded client PO document (data URL) — current/latest version. */
  documentUrl?: string;
  documentName?: string;
  documentType?: string;
  documentUploadedAt?: string;
  /** Previous versions of the client PO document, newest first. */
  documentHistory?: Array<{
    url: string;
    name?: string;
    type?: string;
    uploadedAt: string;
  }>;
  /** Line items inherited from the source quote for information consistency. */
  lines?: QuoteLine[];
}


/** Mirrors the "Status" property of the Notion "Logia Sales CRM" database. */
export type Stage = "Lead" | "Qualified" | "Proposal" | "Negotiation" | "In progress" | "Closed" | "Lost";
export const stages: Stage[] = ["Lead", "Qualified", "Proposal", "Negotiation", "In progress", "Closed", "Lost"];
export const stageProbability: Record<Stage, number> = {
  Lead: 0.1, Qualified: 0.25, Proposal: 0.5, Negotiation: 0.75, "In progress": 0.9, Closed: 1, Lost: 0,
};

/** Mirrors the "Paiement" status of the Notion "Logia Sales CRM" database. */
export type PaiementStatus = "Not started" | "Processing" | "Partial Paiement" | "Overdue" | "Paid";
export const paiementStatuses: PaiementStatus[] = ["Not started", "Processing", "Partial Paiement", "Overdue", "Paid"];

/** Mirrors the "Priority" property of the Notion "Logia Sales CRM" database. */
export type Priority = "Low" | "Medium" | "High";
export const priorities: Priority[] = ["Low", "Medium", "High"];

export interface Opportunity {
  id: string;
  companyId: string;
  name: string;
  /** Display name for the client/lead. Kept in sync with the linked Client when clientId is set. */
  client: string;
  /** Foreign key into the Clients database. Required for new opportunities; legacy rows may only have `client`. */
  clientId?: string;
  /** Closer in charge of finalizing the deal. Acquisition lives on the Client. */
  closer?: string;
  stage: Stage;
  value: number;
  currency: Currency;
  expectedClose: string;
}

export interface Supplier {
  id: string;
  /** Primary owning company. */
  companyId: string;
  /** All companies this supplier is shared with. Defaults to [companyId]. */
  companyIds?: string[];
  name: string;
  /** PCG account number (e.g. 401000 external, 401200 internal). */
  account: string;
  /** "external" = vendor, "internal" = staff reimbursements / honoraires internes. */
  kind: "external" | "internal";
  /** Profile picture (data URL or remote URL). */
  avatarUrl?: string;
  /** Contact + legal info (used for payables tracking and invoice/bill PDFs). */
  contactPerson?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  country?: string;
  /** Default payment terms in days. */
  paymentTerms?: number;
  /** Legal tax identifiers. */
  taxId?: string;
  nif?: string;
  stat?: string;
  rcs?: string;
  /** Bank details for payouts. */
  bankName?: string;
  bankAccount?: string;
  bankSwift?: string;
  notes?: string;
  /** Contact categories — supports multiple (client, supplier, referral, partner). */
  categories?: ContactCategory[];
}

/* ─── Team & Sales team ─────────────────────────────────────────────── */

/** A person in the organization (Team database, source of truth). */
export interface TeamMember {
  id: string;
  /** Full display name — kept in sync with firstName + lastName. */
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
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
// Backfill `code` for companies persisted before the field existed.
{
  let migrated = false;
  for (const c of companiesStore.items) {
    if (!c.code) { c.code = c.shortName; migrated = true; }
  }
  if (migrated) companiesStore.replaceAll([...companiesStore.items]);
}

/** Compact company identifier for inline chips, tables, badges. */
export function companyCode(c?: Pick<Company, "code" | "shortName" | "name"> | null): string {
  if (!c) return "";
  return c.code || c.shortName || c.name;
}
export const accountsStore = createCollection<Account>("accounts", []);
export const clientsStore = createCollection<Client>("clients", []);
export const suppliersStore = createCollection<Supplier>("suppliers", []);
export const projectsStore = createCollection<Project>("projects", []);
export const transactionsStore = createCollection<Transaction>("transactions", []);
export const invoicesStore = createCollection<Invoice>("invoices", []);
export const opportunitiesStore = createCollection<Opportunity>("opportunities", []);
// Migrate legacy "Won" stage → "Closed" (mirrors Notion "Logia Sales CRM" status).
{
  let migrated = false;
  for (const o of opportunitiesStore.items) {
    if ((o.stage as string) === "Won") { o.stage = "Closed"; migrated = true; }
  }
  if (migrated) opportunitiesStore.replaceAll([...opportunitiesStore.items]);
}
export const categoriesStore = createCollection<Category>("categories", []);
export const budgetsStore = createCollection<Budget>("budgets", []);
export const teamMembersStore = createCollection<TeamMember>("team-members", []);
export const salesMembersStore = createCollection<SalesMember>("sales-members", []);
export const quotesStore = createCollection<Quote>("quotes", []);
export const purchaseOrdersStore = createCollection<PurchaseOrder>("purchase-orders", []);

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
export const quotes = quotesStore.items;
export const purchaseOrders = purchaseOrdersStore.items;

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
export const useQuotes = () => useCollection(quotesStore);
export const usePurchaseOrders = () => useCollection(purchaseOrdersStore);

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


/* ─── Number format preference ──────────────────────────────────────── */

export type NumberFormatMode = "full" | "compact";

const FMT_KEY = "axel.numberFormat";

let _globalMode: NumberFormatMode =
  (typeof window !== "undefined" && window.localStorage.getItem(FMT_KEY) as NumberFormatMode) || "compact";

export function getNumberFormat(): NumberFormatMode { return _globalMode; }

export function setNumberFormat(mode: NumberFormatMode) {
  _globalMode = mode;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(FMT_KEY, mode); } catch { /* ignore */ }
  }
}

/* ─── Formatters ────────────────────────────────────────────────────── */

export const fmt = (amount: number, currency: Currency) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);

export const fmtFull = (amount: number, currency: Currency) => {
  const symbol = currency === "EUR" ? "€" : currency === "USD" ? "$" : "Ar";
  const num = Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === "MGA" ? `${num} ${symbol}` : `${symbol}${num}`;
};

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

export const fmtAmount = (amount: number, currency: Currency) =>
  _globalMode === "full" ? fmtFull(amount, currency) : fmtCompact(amount, currency);
