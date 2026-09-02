/**
 * Best-effort dual-write helpers that mirror mock-data store mutations
 * to the corresponding Supabase tables. Mutations on records whose
 * company has no DB counterpart (e.g. mock-only seeds) are skipped.
 *
 * Hydration: pulls DB rows on auth and merges them into the local
 * stores by id, so refreshing the browser still shows DB-persisted data.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  clientsStore, suppliersStore, projectsStore,
  accountsStore, categoriesStore, budgetsStore,
  transactionsStore, invoicesStore,
  opportunitiesStore, quotesStore, purchaseOrdersStore,
  expensesStore, recurringBillingsStore,
  teamMembersStore, salesMembersStore,
  salaryRegisterStore, payrollRunsStore,
  pvrRecordsStore, invoiceEscalationsStore, quoteFollowupsStore,
  projectStagesStore,
  type PvrRecord, type InvoiceEscalation, type QuoteFollowup,
  type ProjectStage, type ProjectStageStatus,

  type Client, type Supplier, type Project,
  type Account, type Category, type Budget,
  type Transaction, type Invoice, type QuoteLine,
  type Opportunity, type Quote, type PurchaseOrder,
  type Expense, type RecurringBilling,
  type TeamMember, type SalesMember,
  type SalaryRegisterEntry, type PayrollRun, type PayrollEntry,
} from "./mock-data";
import { journalEntriesStore, type JournalEntry } from "./pcg";

export type HydrationScope =
  | { mode: "all" }
  | { mode: "scoped"; companyIds: string[] };

/** Maps local company id (e.g. "axi") → DB uuid. Populated by company-context. */
const companyDbIdByLocal = new Map<string, string>();
/** Reverse: DB uuid → local company id. */
const companyLocalIdByDb = new Map<string, string>();

export function setCompanyIdMap(entries: Array<{ localId: string; dbId: string }>) {
  companyDbIdByLocal.clear();
  companyLocalIdByDb.clear();
  for (const { localId, dbId } of entries) {
    companyDbIdByLocal.set(localId, dbId);
    companyLocalIdByDb.set(dbId, localId);
  }
}

const toDbCompanyId = (localId: string) => companyDbIdByLocal.get(localId);

/**
 * Company db ids the signed-in user is allowed to write to. `null` means
 * unrestricted (platform admin, or access not resolved yet). Local demo seeds
 * used to replay into the backend for every user and got rejected row by row
 * by row-level security, so writes to companies outside this set are skipped.
 */
let writableCompanyDbIds: Set<string> | null = null;

export function setWritableCompanies(dbIds: string[] | null) {
  writableCompanyDbIds = dbIds ? new Set(dbIds) : null;
}

export const canWriteCompany = (dbCompanyId: string) =>
  !writableCompanyDbIds || writableCompanyDbIds.has(dbCompanyId);

let lastWriteErrorAt = 0;
/** Surface save failures instead of swallowing them (throttled for bulk imports). */
function reportWriteError(what: string, message: string) {
  console.warn(`[db-sync] ${what}`, message);
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastWriteErrorAt < 4000) return;
  lastWriteErrorAt = now;
  void import("sonner").then(({ toast }) =>
    toast.error("Could not save to the backend", {
      description: message.includes("row-level security")
        ? "You do not have permission to save data for this company."
        : message,
    }),
  );
}

/** Public lookup: local company id (or uuid) → DB uuid, when known. */
export const dbCompanyId = (localId: string): string | undefined =>
  companyDbIdByLocal.get(localId) ?? (companyLocalIdByDb.has(localId) ? localId : undefined);
const toLocalCompanyId = (dbId: string) => companyLocalIdByDb.get(dbId) ?? dbId;

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * Relation column for an upsert.
 * - empty value → explicit `null` (the user really cleared the link)
 * - real backend id → written through
 * - legacy/local id we cannot resolve → key omitted, so an upsert never blanks
 *   a link that already exists in the backend. Writing `null` here is what
 *   wiped client/project on documents replayed from local seeds.
 */
const link = (key: string, value?: string | null): Record<string, string | null> =>
  value ? (isUuid(value) ? { [key]: value } : {}) : { [key]: null };


async function fetchScopedRows(table: string, scope: HydrationScope) {
  if (scope.mode === "scoped" && scope.companyIds.length === 0) return [] as Record<string, unknown>[];
  let query = (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table).select("*");
  if (scope.mode === "scoped") query = query.in("company_id", scope.companyIds);
  const { data } = await query;
  return (data ?? []) as Record<string, unknown>[];
}

/* ───────────────────────── CLIENTS ───────────────────────── */

const clientToDb = (c: Client) => {
  const dbCompany = toDbCompanyId(c.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(c.id) ? c.id : undefined,
    company_id: dbCompany,
    name: c.name,
    display_name: c.displayName?.trim() || null,
    country: c.country || null,
    status: c.status ?? null,
    acquisition: c.acquisition ?? null,
    referral: c.referral ?? null,
    acquired_at: c.acquiredAt ?? null,
    acquisition_year: c.acquisitionYear ?? null,
    avatar_url: c.avatarUrl ?? null,
    website: c.website ?? null,
    email: c.email ?? null,
    phone: c.phone ?? null,
    address: c.address ?? null,
    industry: c.industry ?? null,
    contacts: c.contacts ?? null,
    tax_id: c.taxId ?? null,
    nif: c.nif ?? null,
    stat: c.stat ?? null,
    rcs: c.rcs ?? null,
    categories: c.categories ?? null,
    payment_terms_days: c.paymentTermsDays ?? null,
    payment_terms_by_currency: c.paymentTermsByCurrency ?? {},
    color: c.color ?? null,
  };
};

const clientFromDb = (r: Record<string, unknown>): Client => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  name: r.name as string,
  displayName: (r.display_name as string) ?? undefined,
  country: (r.country as string) ?? "",
  status: (r.status as Client["status"]) ?? undefined,
  acquisition: (r.acquisition as string) ?? undefined,
  referral: (r.referral as string) ?? undefined,
  acquiredAt: (r.acquired_at as string) ?? undefined,
  acquisitionYear: (r.acquisition_year as number) ?? undefined,
  avatarUrl: (r.avatar_url as string) ?? undefined,
  website: (r.website as string) ?? undefined,
  email: (r.email as string) ?? undefined,
  phone: (r.phone as string) ?? undefined,
  address: (r.address as string) ?? undefined,
  industry: (r.industry as string) ?? undefined,
  contacts: (r.contacts as string) ?? undefined,
  taxId: (r.tax_id as string) ?? undefined,
  paymentTermsDays: (r.payment_terms_days as number) ?? undefined,
  paymentTermsByCurrency: (r.payment_terms_by_currency as Record<string, number>) ?? undefined,
  nif: (r.nif as string) ?? undefined,
  stat: (r.stat as string) ?? undefined,
  rcs: (r.rcs as string) ?? undefined,
  categories: (r.categories as Client["categories"]) ?? undefined,
  color: (r.color as string) ?? undefined,
});

/**
 * Client banking details live in a separate, finance-restricted table so that
 * sales users (who legitimately need the client record) never receive bank
 * account numbers, IBANs or mobile-money numbers.
 */
const clientBankFromDb = (r: Record<string, unknown>): Partial<Client> => ({
  bankName: (r.bank_name as string) ?? undefined,
  bankAccount: (r.bank_account as string) ?? undefined,
  bankSwift: (r.bank_swift as string) ?? undefined,
  bankHolder: (r.bank_holder as string) ?? undefined,
  bankCode: (r.bank_code as string) ?? undefined,
  branchCode: (r.branch_code as string) ?? undefined,
  accountNumber: (r.account_number as string) ?? undefined,
  ribKey: (r.rib_key as string) ?? undefined,
  iban: (r.iban as string) ?? undefined,
  intlEnabled: Boolean(r.intl_enabled),
  mobileEnabled: Boolean(r.mobile_enabled),
  mobileProvider: (r.mobile_provider as string) ?? undefined,
  mobileNumber: (r.mobile_number as string) ?? undefined,
  mobileName: (r.mobile_name as string) ?? undefined,
});

const hasBankData = (c: Client) =>
  Boolean(
    c.bankName || c.bankAccount || c.bankSwift || c.bankHolder || c.bankCode ||
    c.branchCode || c.accountNumber || c.ribKey || c.iban ||
    c.mobileProvider || c.mobileNumber || c.mobileName || c.intlEnabled || c.mobileEnabled,
  );

async function upsertClientBankDetails(clientId: string, companyId: string, c: Client) {
  if (!hasBankData(c)) return;
  const { error } = await supabase.from("client_bank_details").upsert({
    client_id: clientId,
    company_id: companyId,
    bank_name: c.bankName ?? null,
    bank_account: c.bankAccount ?? null,
    bank_swift: c.bankSwift ?? null,
    bank_holder: c.bankHolder ?? null,
    bank_code: c.bankCode ?? null,
    branch_code: c.branchCode ?? null,
    account_number: c.accountNumber ?? null,
    rib_key: c.ribKey ?? null,
    iban: c.iban ?? null,
    intl_enabled: c.intlEnabled ?? false,
    mobile_enabled: c.mobileEnabled ?? false,
    mobile_provider: c.mobileProvider ?? null,
    mobile_number: c.mobileNumber ?? null,
    mobile_name: c.mobileName ?? null,
  }, { onConflict: "client_id" });
  // Users without finance access simply cannot store banking data.
  if (error) console.warn("[db-sync] client bank details not saved", error.message);
}

/** Insert or update a client in DB. Returns the DB uuid if persisted. */
export async function upsertClient(c: Client): Promise<string | null> {
  const row = clientToDb(c);
  if (!row) {
    console.error("[db-sync] upsertClient skipped: missing DB company mapping", {
      clientId: c.id,
      companyId: c.companyId,
      companyIds: c.companyIds,
      name: c.name,
    });
    return null;
  }
  const { data, error } = await supabase.from("clients").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) {
    console.error("[db-sync] upsertClient failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      client: c,
      row,
    });
    return null;
  }
  await upsertClientBankDetails(data.id, row.company_id, c);
  return data.id;
}

export async function deleteClientDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteClient", error.message);
}

/* ───────────────────────── SUPPLIERS ───────────────────────── */

const supplierToDb = (s: Supplier) => {
  const dbCompany = toDbCompanyId(s.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(s.id) ? s.id : undefined,
    company_id: dbCompany,
    name: s.name,
    account: s.account,
    kind: s.kind,
    avatar_url: s.avatarUrl ?? null,
    contact_person: s.contactPerson ?? null,
    email: s.email ?? null,
    phone: s.phone ?? null,
    website: s.website ?? null,
    address: s.address ?? null,
    country: s.country ?? null,
    payment_terms: s.paymentTerms ?? null,
    tax_id: s.taxId ?? null,
    nif: s.nif ?? null,
    stat: s.stat ?? null,
    rcs: s.rcs ?? null,
    bank_name: s.bankName ?? null,
    bank_account: s.bankAccount ?? null,
    bank_swift: s.bankSwift ?? null,
    bank_holder: s.bankHolder ?? null,
    bank_code: s.bankCode ?? null,
    branch_code: s.branchCode ?? null,
    account_number: s.accountNumber ?? null,
    rib_key: s.ribKey ?? null,
    iban: s.iban ?? null,
    intl_enabled: s.intlEnabled ?? false,
    mobile_enabled: s.mobileEnabled ?? false,
    mobile_provider: s.mobileProvider ?? null,
    mobile_number: s.mobileNumber ?? null,
    mobile_name: s.mobileName ?? null,
    notes: s.notes ?? null,
    categories: s.categories ?? null,
  };
};

const supplierFromDb = (r: Record<string, unknown>): Supplier => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  name: r.name as string,
  account: r.account as string,
  kind: (r.kind as Supplier["kind"]) ?? "external",
  avatarUrl: (r.avatar_url as string) ?? undefined,
  contactPerson: (r.contact_person as string) ?? undefined,
  email: (r.email as string) ?? undefined,
  phone: (r.phone as string) ?? undefined,
  website: (r.website as string) ?? undefined,
  address: (r.address as string) ?? undefined,
  country: (r.country as string) ?? undefined,
  paymentTerms: (r.payment_terms as number) ?? undefined,
  taxId: (r.tax_id as string) ?? undefined,
  nif: (r.nif as string) ?? undefined,
  stat: (r.stat as string) ?? undefined,
  rcs: (r.rcs as string) ?? undefined,
  bankName: (r.bank_name as string) ?? undefined,
  bankAccount: (r.bank_account as string) ?? undefined,
  bankSwift: (r.bank_swift as string) ?? undefined,
  bankHolder: (r.bank_holder as string) ?? undefined,
  bankCode: (r.bank_code as string) ?? undefined,
  branchCode: (r.branch_code as string) ?? undefined,
  accountNumber: (r.account_number as string) ?? undefined,
  ribKey: (r.rib_key as string) ?? undefined,
  iban: (r.iban as string) ?? undefined,
  intlEnabled: Boolean(r.intl_enabled),
  mobileEnabled: Boolean(r.mobile_enabled),
  mobileProvider: (r.mobile_provider as string) ?? undefined,
  mobileNumber: (r.mobile_number as string) ?? undefined,
  mobileName: (r.mobile_name as string) ?? undefined,
  notes: (r.notes as string) ?? undefined,
  categories: (r.categories as Supplier["categories"]) ?? undefined,
});

export async function upsertSupplier(s: Supplier): Promise<string | null> {
  const row = supplierToDb(s);
  if (!row) return null;
  const { data, error } = await supabase.from("suppliers").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertSupplier", error.message); return null; }
  return data.id;
}

export async function deleteSupplierDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteSupplier", error.message);
}

/* ───────────────────────── PROJECTS ───────────────────────── */

const projectToDb = (p: Project) => {
  const dbCompany = toDbCompanyId(p.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(p.id) ? p.id : undefined,
    company_id: dbCompany,
    client_id: isUuid(p.clientId) ? p.clientId : null,
    name: p.name,
    revenue: p.revenue,
    cost: p.cost,
    currency: p.currency,
  };
};

const projectFromDb = (r: Record<string, unknown>): Project => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  clientId: (r.client_id as string) ?? "",
  name: r.name as string,
  revenue: Number(r.revenue) || 0,
  cost: Number(r.cost) || 0,
  currency: (r.currency as Project["currency"]) ?? "MGA",
});

export async function upsertProject(p: Project): Promise<string | null> {
  const row = projectToDb(p);
  if (!row) return null;
  // Background seed replays into companies the user cannot write to were the
  // bulk of the row-level-security rejections; skip them silently.
  if (!canWriteCompany(row.company_id)) return null;
  const { data, error } = await supabase.from("projects").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) { reportWriteError("upsertProject", error.message); return null; }
  return data.id;
}

export async function deleteProjectDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) reportWriteError("deleteProject", error.message);
}


/* ─────────────────────── HYDRATION ─────────────────────── */

/** Pull clients/suppliers/projects from DB and merge into local stores by id. */
export async function hydrateContacts(scope: HydrationScope = { mode: "all" }) {
  const [cli, sup, prj, bank] = await Promise.all([
    fetchScopedRows("clients", scope),
    fetchScopedRows("suppliers", scope),
    fetchScopedRows("projects", scope),
    // Returns nothing for users without finance access — by design.
    fetchScopedRows("client_bank_details", scope),
  ]);

  const bankByClient = new Map(bank.map((r) => [r.client_id as string, clientBankFromDb(r)]));
  clientsStore.replaceAll(cli.map((r) => {
    const base = clientFromDb(r);
    const extra = bankByClient.get(base.id);
    return extra ? { ...base, ...extra } : base;
  }));
  suppliersStore.replaceAll(sup.map((r) => supplierFromDb(r)));
  projectsStore.replaceAll(prj.map((r) => projectFromDb(r)));
}

/* ─────────── ONE-TIME PUSH OF LOCAL MOCK SEED ─────────── */

/**
 * Push locally-seeded clients/suppliers/projects (those with non-UUID ids
 * whose companyId maps to a real DB company) up to Supabase, swapping their
 * local id with the returned DB uuid. Idempotent: once an item has a UUID,
 * it is skipped. Returns counts of records pushed.
 */
export async function pushLocalSeed(forceCompanyIds: string[] = []): Promise<{ clients: number; suppliers: number; projects: number }> {
  let cliN = 0, supN = 0, prjN = 0;
  const idRemap = new Map<string, string>(); // localClientId -> dbId
  const forced = new Set(forceCompanyIds);
  const skip = (item: { id: string; companyId: string }) =>
    (isUuid(item.id) && !forced.has(item.companyId)) || !toDbCompanyId(item.companyId);

  // CLIENTS
  for (const c of [...clientsStore.items]) {
    if (skip(c)) continue;
    const dbId = await upsertClient(c);
    if (dbId) {
      idRemap.set(c.id, dbId);
      const i = clientsStore.items.findIndex((x) => x.id === c.id);
      if (i >= 0) {
        clientsStore.items[i] = { ...c, id: dbId };
      }
      cliN++;
    }
  }
  if (cliN) clientsStore.replaceAll([...clientsStore.items]);

  // SUPPLIERS
  for (const s of [...suppliersStore.items]) {
    if (skip(s)) continue;
    const dbId = await upsertSupplier(s);
    if (dbId) {
      const i = suppliersStore.items.findIndex((x) => x.id === s.id);
      if (i >= 0) suppliersStore.items[i] = { ...s, id: dbId };
      supN++;
    }
  }
  if (supN) suppliersStore.replaceAll([...suppliersStore.items]);

  // PROJECTS — rewrite clientId via idRemap so FK lines up
  for (const p of [...projectsStore.items]) {
    if (isUuid(p.id)) continue;
    if (!toDbCompanyId(p.companyId)) continue;
    const remappedClientId = idRemap.get(p.clientId) ?? p.clientId;
    const toPush = { ...p, clientId: remappedClientId };
    const dbId = await upsertProject(toPush);
    if (dbId) {
      const i = projectsStore.items.findIndex((x) => x.id === p.id);
      if (i >= 0) projectsStore.items[i] = { ...toPush, id: dbId };
      prjN++;
    }
  }
  if (prjN) projectsStore.replaceAll([...projectsStore.items]);

  return { clients: cliN, suppliers: supN, projects: prjN };
}

/* ───────────────────────── ACCOUNTS ───────────────────────── */

const accountToDb = (a: Account) => {
  const dbCompany = toDbCompanyId(a.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(a.id) ? a.id : undefined,
    company_id: dbCompany,
    name: a.name,
    type: a.type,
    currency: a.currency,
    balance: a.balance,
    opening_balance: a.openingBalanceDate ? (a.openingBalance ?? 0) : 0,
    opening_balance_date: a.openingBalanceDate ?? null,
    statement_uploaded_at: a.statementUploadedAt ?? null,
    statement_name: a.statementName ?? null,
  };
};

const accountFromDb = (r: Record<string, unknown>): Account => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  name: r.name as string,
  type: (r.type as Account["type"]) ?? "bank",
  currency: (r.currency as Account["currency"]) ?? "MGA",
  balance: Number(r.balance) || 0,
  openingBalance: r.opening_balance == null ? 0 : Number(r.opening_balance) || 0,
  openingBalanceDate: (r.opening_balance_date as string) ?? undefined,
  statementUploadedAt: (r.statement_uploaded_at as string) ?? undefined,
  statementName: (r.statement_name as string) ?? undefined,
});

export async function upsertAccount(a: Account): Promise<string | null> {
  const row = accountToDb(a);
  if (!row) return null;
  const { data, error } = await supabase.from("accounts").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertAccount", error.message); return null; }
  return data.id;
}
export async function deleteAccountDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteAccount", error.message);
}

/* ───────────────────────── CATEGORIES ───────────────────────── */

const categoryToDb = (c: Category) => {
  const dbCompany = toDbCompanyId(c.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(c.id) ? c.id : undefined,
    company_id: dbCompany,
    name: c.name,
    kind: c.kind,
    account: c.account ?? null,
    color: c.color ?? null,
  };
};

const categoryFromDb = (r: Record<string, unknown>): Category => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  name: r.name as string,
  kind: (r.kind as Category["kind"]) ?? "expense",
  account: (r.account as string) ?? undefined,
  color: (r.color as string) ?? undefined,
});

export async function upsertCategory(c: Category): Promise<string | null> {
  const row = categoryToDb(c);
  if (!row) return null;
  const { data, error } = await supabase.from("categories").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertCategory", error.message); return null; }
  return data.id;
}
export async function deleteCategoryDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteCategory", error.message);
}

/* ───────────────────────── BUDGETS ───────────────────────── */

const budgetToDb = (b: Budget) => {
  const dbCompany = toDbCompanyId(b.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(b.id) ? b.id : undefined,
    company_id: dbCompany,
    category_id: isUuid(b.categoryId) ? b.categoryId : null,
    year: b.year,
    amount: b.amount,
    currency: b.currency,
  };
};

const budgetFromDb = (r: Record<string, unknown>): Budget => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  categoryId: (r.category_id as string) ?? "",
  year: Number(r.year) || new Date().getFullYear(),
  amount: Number(r.amount) || 0,
  currency: (r.currency as Budget["currency"]) ?? "MGA",
});

export async function upsertBudget(b: Budget): Promise<string | null> {
  const row = budgetToDb(b);
  if (!row) return null;
  const { data, error } = await supabase.from("budgets").upsert(row).select("id").single();
  if (error) { console.warn("[db-sync] upsertBudget", error.message); return null; }
  return data.id;
}
export async function deleteBudgetDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteBudget", error.message);
}

/* ───────────────────────── TRANSACTIONS ───────────────────────── */

const transactionToDb = (t: Transaction) => {
  const dbCompany = toDbCompanyId(t.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(t.id) ? t.id : undefined,
    company_id: dbCompany,
    account_id: t.accountId && isUuid(t.accountId) ? t.accountId : null,
    category_id: t.categoryId && isUuid(t.categoryId) ? t.categoryId : null,
    ...link("client_id", t.clientId),
    supplier_id: t.supplierId && isUuid(t.supplierId) ? t.supplierId : null,
    ...link("project_id", t.projectId),
    ...link("invoice_id", t.invoiceId),
    date: t.date,
    type: t.type,
    category: t.category ?? null,
    description: t.description ?? null,
    amount: t.amount,
    currency: t.currency,
    source: t.source ?? null,
  };
};

const transactionFromDb = (r: Record<string, unknown>): Transaction => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  accountId: (r.account_id as string) ?? "",
  categoryId: (r.category_id as string) ?? undefined,
  clientId: (r.client_id as string) ?? undefined,
  supplierId: (r.supplier_id as string) ?? undefined,
  projectId: (r.project_id as string) ?? undefined,
  invoiceId: (r.invoice_id as string) ?? undefined,
  date: (r.date as string) ?? "",
  type: (r.type as Transaction["type"]) ?? "expense",
  category: (r.category as string) ?? "",
  description: (r.description as string) ?? "",
  amount: Number(r.amount) || 0,
  currency: (r.currency as Transaction["currency"]) ?? "MGA",
  source: (r.source as Transaction["source"]) ?? undefined,
});

export async function upsertTransaction(t: Transaction): Promise<string | null> {
  const row = transactionToDb(t);
  if (!row) return null;
  // Skip companies the user cannot write to (local seed replay), so genuine
  // save failures are the only thing that reaches the user.
  if (!canWriteCompany(row.company_id)) return null;
  const { data, error } = await supabase.from("transactions").upsert(row).select("id").single();
  if (error) { reportWriteError("upsertTransaction", error.message); return null; }
  return data.id;
}
export async function deleteTransactionDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteTransaction", error.message);
}

/* ───────────────────────── INVOICES ───────────────────────── */

const invoiceToDb = (inv: Invoice) => {
  const dbCompany = toDbCompanyId(inv.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(inv.id) ? inv.id : undefined,
    company_id: dbCompany,
    ...link("client_id", inv.clientId),
    ...link("project_id", inv.projectId),
    ...link("po_id", inv.poId),
    po_waived: inv.poWaived ?? false,
    po_waiver_reason: inv.poWaiverReason ?? null,

    ...link("quote_id", inv.quoteId),
    ...link("opportunity_id", inv.opportunityId),

    number: inv.number,
    issue_date: inv.issueDate,
    due_date: inv.dueDate,
    amount: inv.amount,
    paid: inv.paid,
    paid_date: inv.paidDate ?? null,
    currency: inv.currency,
    status: inv.status,
    cancelled_at: inv.cancelledAt ?? null,
    cancellation_reason: inv.cancellationReason ?? null,
    discount_pct: inv.discountPct ?? null,
    tax_rate: inv.taxRate ?? 0,
    tax_amount: inv.taxAmount ?? 0,
    total_amount: inv.totalAmount ?? inv.amount,

    subject: inv.subject ?? null,
    assigned_to: (inv.assignedTo ?? []).filter((id) => isUuid(id)).slice(0, 3),
    bank_account_id: inv.bankAccountId ?? null,
    ingestion_date: inv.ingestionDate ?? null,
    handover_proof_url: inv.handoverProofUrl ?? null,
    handover_proof_name: inv.handoverProofName ?? null,
    handover_stamped_at: inv.handoverStampedAt ?? null,
    handover_by: inv.handoverBy ?? null,
    dating_note: inv.datingNote ?? null,
    signer_id: inv.signerId && isUuid(inv.signerId) ? inv.signerId : null,
    stamp_x: inv.stampX ?? null,
    stamp_y: inv.stampY ?? null,
    stamp_scale: inv.stampScale ?? null,
    stamp_dirty: inv.stampDirty ?? false,
    ...(inv.createdBy && isUuid(inv.createdBy) ? { created_by: inv.createdBy } : {}),
    ...(inv.updatedBy && isUuid(inv.updatedBy) ? { updated_by: inv.updatedBy } : {}),
  };

};

const invoiceFromDb = (r: Record<string, unknown>, lines: QuoteLine[]): Invoice => ({
  id: r.id as string,
  number: (r.number as string) ?? "",
  companyId: toLocalCompanyId(r.company_id as string),
  clientId: (r.client_id as string) ?? "",
  projectId: (r.project_id as string) ?? undefined,
  poId: (r.po_id as string) ?? undefined,
  poWaived: Boolean(r.po_waived),
  assignedTo: ((r.assigned_to as string[]) ?? []).filter(Boolean),
  poWaiverReason: (r.po_waiver_reason as string) ?? undefined,

  quoteId: (r.quote_id as string) ?? undefined,
  opportunityId: (r.opportunity_id as string) ?? undefined,
  issueDate: (r.issue_date as string) ?? "",
  dueDate: (r.due_date as string) ?? "",
  amount: Number(r.amount) || 0,
  paid: Number(r.paid) || 0,
  paidDate: (r.paid_date as string) ?? undefined,
  currency: (r.currency as Invoice["currency"]) ?? "MGA",
  status: (r.status as Invoice["status"]) ?? "draft",
  cancelledAt: (r.cancelled_at as string) ?? undefined,
  cancellationReason: (r.cancellation_reason as string) ?? undefined,
  subject: (r.subject as string) ?? undefined,
  discountPct: r.discount_pct != null ? Number(r.discount_pct) : undefined,
  taxRate: r.tax_rate != null ? Number(r.tax_rate) : undefined,
  taxAmount: r.tax_amount != null ? Number(r.tax_amount) : undefined,
  totalAmount: r.total_amount != null ? Number(r.total_amount) : undefined,

  bankAccountId: (r.bank_account_id as string) ?? undefined,
  ingestionDate: (r.ingestion_date as string) ?? undefined,
  handoverProofUrl: (r.handover_proof_url as string) ?? undefined,
  handoverProofName: (r.handover_proof_name as string) ?? undefined,
  handoverStampedAt: (r.handover_stamped_at as string) ?? undefined,
  handoverBy: (r.handover_by as string) ?? undefined,
  datingNote: (r.dating_note as string) ?? undefined,
  signerId: (r.signer_id as string) ?? undefined,
  stampX: r.stamp_x != null ? Number(r.stamp_x) : undefined,
  stampY: r.stamp_y != null ? Number(r.stamp_y) : undefined,
  stampScale: r.stamp_scale != null ? Number(r.stamp_scale) : undefined,
  stampDirty: Boolean(r.stamp_dirty),
  createdBy: (r.created_by as string) ?? undefined,
  updatedBy: (r.updated_by as string) ?? undefined,
  updatedAt: (r.updated_at as string) ?? undefined,
  lines: lines.length ? lines : undefined,
});


export async function upsertInvoice(inv: Invoice): Promise<string | null> {
  const row = invoiceToDb(inv);
  if (!row) return null;
  const { data, error } = await supabase.from("invoices").upsert(row, { onConflict: "company_id,number" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertInvoice", error.message); return null; }
  const invId = data.id as string;
  // Replace line items (simple strategy: delete + reinsert).
  if (inv.lines !== undefined) {
    await supabase.from("invoice_lines").delete().eq("invoice_id", invId);
    if (inv.lines.length) {
      const lineRows = inv.lines.map((l, i) => ({
        invoice_id: invId,
        position: i,
        description: l.description ?? null,
        details: l.details ?? null,
        capability: l.capability ?? null,
        level: l.level ?? null,
        unit: l.unit,
        quantity: l.quantity,
        rate: l.rate,
        discount_pct: l.discountPct ?? null,
        created_by: l.createdBy && isUuid(l.createdBy) ? l.createdBy : null,
        ...(l.createdAt ? { created_at: l.createdAt } : {}),
      }));
      const { error: lineErr } = await supabase.from("invoice_lines").insert(lineRows);
      if (lineErr) console.warn("[db-sync] upsertInvoice.lines", lineErr.message);
    }
  }
  return invId;
}
export async function deleteInvoiceDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteInvoice", error.message);
}

/* ───────────────────────── REGISTER SYNC ───────────────────────── */

/** Wire mock stores → DB so every add/update/remove dual-writes. */
export function registerFinancialSync() {
  accountsStore.setSync({ upsert: upsertAccount, remove: deleteAccountDb });
  categoriesStore.setSync({ upsert: upsertCategory, remove: deleteCategoryDb });
  budgetsStore.setSync({ upsert: upsertBudget, remove: deleteBudgetDb });
  transactionsStore.setSync({ upsert: upsertTransaction, remove: deleteTransactionDb });
  invoicesStore.setSync({ upsert: upsertInvoice, remove: deleteInvoiceDb });
}

/* ───────────────────────── HYDRATION (financial) ───────────────────────── */

export async function hydrateFinancials(scope: HydrationScope = { mode: "all" }) {
  const [
    accs,
    cats,
    buds,
    txs,
    invs,
  ] = await Promise.all([
    fetchScopedRows("accounts", scope),
    fetchScopedRows("categories", scope),
    fetchScopedRows("budgets", scope),
    fetchScopedRows("transactions", scope),
    fetchScopedRows("invoices", scope),
  ]);
  let lines: Record<string, unknown>[] = [];
  const invoiceIds = invs.map((r) => r.id as string).filter(Boolean);
  if (scope.mode === "all") {
    const { data } = await supabase.from("invoice_lines").select("*").order("position", { ascending: true });
    lines = (data ?? []) as Record<string, unknown>[];
  } else if (invoiceIds.length > 0) {
    const { data } = await supabase.from("invoice_lines").select("*").in("invoice_id", invoiceIds).order("position", { ascending: true });
    lines = (data ?? []) as Record<string, unknown>[];
  }

  accountsStore.replaceAll(accs.map((r) => accountFromDb(r)));
  categoriesStore.replaceAll(cats.map((r) => categoryFromDb(r)));
  budgetsStore.replaceAll(buds.map((r) => budgetFromDb(r)));
  transactionsStore.replaceAll(txs.map((r) => transactionFromDb(r)));

  const linesByInv = new Map<string, QuoteLine[]>();
  lines.forEach((l) => {
    const arr = linesByInv.get(l.invoice_id as string) ?? [];
    arr.push({
      id: l.id as string,
      description: (l.description as string) ?? "",
      details: (l.details as string) ?? undefined,
      capability: (l.capability as string) ?? undefined,
      level: (l.level as string) ?? undefined,
      unit: (l.unit as QuoteLine["unit"]) ?? "fixed",
      quantity: Number(l.quantity) || 0,
      rate: Number(l.rate) || 0,
      discountPct: l.discount_pct != null ? Number(l.discount_pct) : undefined,
      createdBy: (l.created_by as string) ?? undefined,
      createdAt: (l.created_at as string) ?? undefined,
    });
    linesByInv.set(l.invoice_id as string, arr);
  });
  invoicesStore.replaceAll(
    invs.map((r) => invoiceFromDb(r, linesByInv.get(r.id as string) ?? [])),
  );
}

/* ─────────── PUSH LOCAL FINANCIAL SEED ─────────── */

/** Push locally-seeded accounts/categories/budgets/transactions/invoices to DB.
 *  Idempotent: items already with a UUID id are skipped, unless their company is
 *  listed in `forceCompanyIds` (used to repair a company whose rows were cleared
 *  server-side — the upsert then re-creates the rows with their existing ids). */
export async function pushLocalFinancialSeed(forceCompanyIds: string[] = []): Promise<{
  accounts: number; categories: number; budgets: number; transactions: number; invoices: number;
}> {
  const forced = new Set(forceCompanyIds);
  const skip = (item: { id: string; companyId: string }) =>
    (isUuid(item.id) && !forced.has(item.companyId)) || !toDbCompanyId(item.companyId);
  const counts = { accounts: 0, categories: 0, budgets: 0, transactions: 0, invoices: 0 };
  const accMap = new Map<string, string>();
  const catMap = new Map<string, string>();
  const invMap = new Map<string, string>();
  console.info("[pushLocalFinancialSeed] starting; local items:", {
    accounts: accountsStore.items.length,
    categories: categoriesStore.items.length,
    budgets: budgetsStore.items.length,
    invoices: invoicesStore.items.length,
    transactions: transactionsStore.items.length,
    companyMapSize: companyDbIdByLocal.size,
    forceCompanyIds,
  });



  for (const a of [...accountsStore.items]) {
    if (skip(a)) continue;
    const dbId = await upsertAccount(a);
    if (dbId) {
      accMap.set(a.id, dbId);
      const i = accountsStore.items.findIndex((x) => x.id === a.id);
      if (i >= 0) accountsStore.items[i] = { ...a, id: dbId };
      counts.accounts++;
    }
  }
  if (counts.accounts) accountsStore.replaceAll([...accountsStore.items]);

  for (const c of [...categoriesStore.items]) {
    if (skip(c)) continue;
    const dbId = await upsertCategory(c);
    if (dbId) {
      catMap.set(c.id, dbId);
      const i = categoriesStore.items.findIndex((x) => x.id === c.id);
      if (i >= 0) categoriesStore.items[i] = { ...c, id: dbId };
      counts.categories++;
    }
  }
  if (counts.categories) categoriesStore.replaceAll([...categoriesStore.items]);

  for (const b of [...budgetsStore.items]) {
    if (skip(b)) continue;
    const remapped = { ...b, categoryId: catMap.get(b.categoryId) ?? b.categoryId };
    const dbId = await upsertBudget(remapped);
    if (dbId) {
      const i = budgetsStore.items.findIndex((x) => x.id === b.id);
      if (i >= 0) budgetsStore.items[i] = { ...remapped, id: dbId };
      counts.budgets++;
    }
  }
  if (counts.budgets) budgetsStore.replaceAll([...budgetsStore.items]);

  // Invoices first (transactions may reference them).
  for (const inv of [...invoicesStore.items]) {
    if (skip(inv)) continue;
    const dbId = await upsertInvoice(inv);
    if (dbId) {
      invMap.set(inv.id, dbId);
      const i = invoicesStore.items.findIndex((x) => x.id === inv.id);
      if (i >= 0) invoicesStore.items[i] = { ...inv, id: dbId };
      counts.invoices++;
    }
  }
  if (counts.invoices) invoicesStore.replaceAll([...invoicesStore.items]);

  for (const t of [...transactionsStore.items]) {
    if (skip(t)) continue;
    const remapped: Transaction = {
      ...t,
      accountId: accMap.get(t.accountId) ?? t.accountId,
      categoryId: t.categoryId ? (catMap.get(t.categoryId) ?? t.categoryId) : undefined,
      invoiceId: t.invoiceId ? (invMap.get(t.invoiceId) ?? t.invoiceId) : undefined,
    };
    const dbId = await upsertTransaction(remapped);
    if (dbId) {
      const i = transactionsStore.items.findIndex((x) => x.id === t.id);
      if (i >= 0) transactionsStore.items[i] = { ...remapped, id: dbId };
      counts.transactions++;
    }
  }
  if (counts.transactions) transactionsStore.replaceAll([...transactionsStore.items]);

  return counts;
}

/* ═════════════════════ EXTRA COLLECTIONS ═════════════════════ */

/* ───────── OPPORTUNITIES ───────── */
const opportunityToDb = (o: Opportunity) => {
  const dbCompany = toDbCompanyId(o.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(o.id) ? o.id : undefined,
    company_id: dbCompany,
    name: o.name,
    client: o.client,
    ...link("client_id", o.clientId),
    closer: o.closer ?? null,
    stage: o.stage,
    value: o.value,
    currency: o.currency,
    expected_close: o.expectedClose || null,
    probability: o.probability ?? null,
  };
};
const opportunityFromDb = (r: Record<string, unknown>): Opportunity => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  name: r.name as string,
  client: r.client as string,
  clientId: (r.client_id as string) ?? undefined,
  closer: (r.closer as string) ?? undefined,
  stage: (r.stage as Opportunity["stage"]) ?? "Lead",
  value: Number(r.value) || 0,
  currency: (r.currency as Opportunity["currency"]) ?? "MGA",
  expectedClose: (r.expected_close as string) ?? "",
  probability: (r.probability as number) ?? undefined,
});
export async function upsertOpportunity(o: Opportunity): Promise<string | null> {
  const row = opportunityToDb(o);
  if (!row) return null;
  const { data, error } = await supabase.from("opportunities").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertOpportunity", error.message); return null; }
  return data.id;
}
export async function deleteOpportunityDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("opportunities").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteOpportunity", error.message);
}

/* ───────── QUOTES ───────── */
const quoteToDb = (q: Quote) => {
  const dbCompany = toDbCompanyId(q.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(q.id) ? q.id : undefined,
    company_id: dbCompany,
    ...link("client_id", q.clientId),
    ...link("project_id", q.projectId),
    ...link("opportunity_id", q.opportunityId),

    number: q.number,
    issue_date: q.issueDate,
    valid_until: q.validUntil,
    amount: q.amount,
    currency: q.currency,
    status: q.status,
    notes: q.notes ?? null,
    subject: q.subject ?? null,
    bank_account_id: q.bankAccountId ?? null,
    mode: q.mode ?? null,
    lines: (q.lines ?? null) as unknown as never,
    discount_pct: q.discountPct ?? null,
    tax_rate: q.taxRate ?? 0,
    tax_amount: q.taxAmount ?? 0,
    total_amount: q.totalAmount ?? q.amount,
    fx_rate: q.fxRate ?? null,
    fx_base_currency: q.fxBaseCurrency ?? null,
    pdf_url: q.pdfUrl ?? null,
    sent_at: q.sentAt ?? null,
    sent_to: q.sentTo ?? null,
    assigned_to: (q.assignedTo ?? []).filter((id) => isUuid(id)).slice(0, 3),
    next_follow_up_at: q.nextFollowUpAt ?? null,
    signer_id: q.signerId && isUuid(q.signerId) ? q.signerId : null,
    stamp_x: q.stampX ?? null,
    stamp_y: q.stampY ?? null,
    stamp_scale: q.stampScale ?? null,
    stamp_dirty: q.stampDirty ?? false,
    cancelled_at: q.cancelledAt ?? null,
    cancellation_reason: q.cancellationReason ?? null,
    ...(q.createdBy && isUuid(q.createdBy) ? { created_by: q.createdBy } : {}),
    ...(q.updatedBy && isUuid(q.updatedBy) ? { updated_by: q.updatedBy } : {}),
  };
};
const quoteFromDb = (r: Record<string, unknown>): Quote => ({
  id: r.id as string,
  number: (r.number as string) ?? "",
  companyId: toLocalCompanyId(r.company_id as string),
  clientId: (r.client_id as string) ?? "",
  projectId: (r.project_id as string) ?? undefined,
  opportunityId: (r.opportunity_id as string) ?? undefined,
  issueDate: (r.issue_date as string) ?? "",
  validUntil: (r.valid_until as string) ?? "",
  amount: Number(r.amount) || 0,
  currency: (r.currency as Quote["currency"]) ?? "MGA",
  status: (r.status as Quote["status"]) ?? "draft",
  notes: (r.notes as string) ?? undefined,
  subject: (r.subject as string) ?? undefined,
  bankAccountId: (r.bank_account_id as string) ?? undefined,
  mode: (r.mode as Quote["mode"]) ?? undefined,
  lines: (r.lines as QuoteLine[]) ?? undefined,
  discountPct: r.discount_pct != null ? Number(r.discount_pct) : undefined,
  taxRate: r.tax_rate != null ? Number(r.tax_rate) : undefined,
  taxAmount: r.tax_amount != null ? Number(r.tax_amount) : undefined,
  totalAmount: r.total_amount != null ? Number(r.total_amount) : undefined,
  fxRate: r.fx_rate != null ? Number(r.fx_rate) : undefined,
  fxBaseCurrency: (r.fx_base_currency as Quote["fxBaseCurrency"]) ?? undefined,
  pdfUrl: (r.pdf_url as string) ?? undefined,
  sentAt: (r.sent_at as string) ?? undefined,
  sentTo: (r.sent_to as string) ?? undefined,
  createdBy: (r.created_by as string) ?? undefined,
  updatedBy: (r.updated_by as string) ?? undefined,
  updatedAt: (r.updated_at as string) ?? undefined,
  assignedTo: ((r.assigned_to as string[]) ?? []).filter(Boolean),
  nextFollowUpAt: (r.next_follow_up_at as string) ?? undefined,
  signerId: (r.signer_id as string) ?? undefined,
  stampX: r.stamp_x != null ? Number(r.stamp_x) : undefined,
  stampY: r.stamp_y != null ? Number(r.stamp_y) : undefined,
  stampScale: r.stamp_scale != null ? Number(r.stamp_scale) : undefined,
  stampDirty: Boolean(r.stamp_dirty),
  cancelledAt: (r.cancelled_at as string) ?? undefined,
  cancellationReason: (r.cancellation_reason as string) ?? undefined,
});

/* ───────── QUOTE FOLLOW-UPS ───────── */
const followupToDb = (f: QuoteFollowup) => {
  const dbCompany = toDbCompanyId(f.companyId);
  if (!dbCompany || !isUuid(f.quoteId)) return null;
  return {
    id: isUuid(f.id) ? f.id : undefined,
    company_id: dbCompany,
    quote_id: f.quoteId,
    kind: f.kind,
    note: f.note ?? "",
    happened_at: f.happenedAt,
  };
};
const followupFromDb = (r: Record<string, unknown>): QuoteFollowup => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  quoteId: (r.quote_id as string) ?? "",
  kind: (r.kind as QuoteFollowup["kind"]) ?? "note",
  note: (r.note as string) ?? "",
  happenedAt: (r.happened_at as string) ?? "",
  createdBy: (r.created_by as string) ?? undefined,
});
export async function upsertQuoteFollowup(f: QuoteFollowup): Promise<string | null> {
  const row = followupToDb(f);
  if (!row) return null;
  const { data, error } = await supabase.from("quote_followups").upsert(row).select("id").single();
  if (error) { reportWriteError("upsertQuoteFollowup", error.message); return null; }
  return data.id as string;
}
export async function deleteQuoteFollowupDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("quote_followups").delete().eq("id", id);
  if (error) reportWriteError("deleteQuoteFollowup", error.message);
}

export async function upsertQuote(q: Quote): Promise<string | null> {
  const row = quoteToDb(q);
  if (!row) return null;
  const { data, error } = await supabase.from("quotes").upsert(row, { onConflict: "company_id,number" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertQuote", error.message); return null; }
  return data.id;
}
export async function deleteQuoteDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteQuote", error.message);
}

/* ───────── PURCHASE ORDERS ───────── */
const poToDb = (p: PurchaseOrder) => {
  const dbCompany = toDbCompanyId(p.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(p.id) ? p.id : undefined,
    company_id: dbCompany,
    ...link("client_id", p.clientId),
    ...link("project_id", p.projectId),
    ...link("quote_id", p.quoteId),

    number: p.number,
    client_reference: p.clientReference ?? null,
    issue_date: p.issueDate,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    document_url: p.documentUrl ?? null,
    document_name: p.documentName ?? null,
    document_type: p.documentType ?? null,
    document_uploaded_at: p.documentUploadedAt ?? null,
    document_history: (p.documentHistory ?? null) as unknown as never,
    lines: (p.lines ?? null) as unknown as never,
    subject: p.subject ?? null,
    bank_account_id: p.bankAccountId ?? null,
    buying_entity: p.buyingEntity ?? null,
    signer_id: p.signerId && isUuid(p.signerId) ? p.signerId : null,
    stamp_x: p.stampX ?? null,
    stamp_y: p.stampY ?? null,
    stamp_scale: p.stampScale ?? null,
    stamp_dirty: p.stampDirty ?? false,
    ...(p.createdBy && isUuid(p.createdBy) ? { created_by: p.createdBy } : {}),
    ...(p.updatedBy && isUuid(p.updatedBy) ? { updated_by: p.updatedBy } : {}),
  };

};
const poFromDb = (r: Record<string, unknown>): PurchaseOrder => ({
  id: r.id as string,
  number: (r.number as string) ?? "",
  companyId: toLocalCompanyId(r.company_id as string),
  clientId: (r.client_id as string) ?? "",
  projectId: (r.project_id as string) ?? undefined,
  quoteId: (r.quote_id as string) ?? undefined,
  clientReference: (r.client_reference as string) ?? undefined,
  issueDate: (r.issue_date as string) ?? "",
  amount: Number(r.amount) || 0,
  currency: (r.currency as PurchaseOrder["currency"]) ?? "MGA",
  status: (r.status as PurchaseOrder["status"]) ?? "draft",
  documentUrl: (r.document_url as string) ?? undefined,
  documentName: (r.document_name as string) ?? undefined,
  documentType: (r.document_type as string) ?? undefined,
  documentUploadedAt: (r.document_uploaded_at as string) ?? undefined,
  documentHistory: (r.document_history as PurchaseOrder["documentHistory"]) ?? undefined,
  lines: (r.lines as QuoteLine[]) ?? undefined,
  subject: (r.subject as string) ?? undefined,
  bankAccountId: (r.bank_account_id as string) ?? undefined,
  createdBy: (r.created_by as string) ?? undefined,
  buyingEntity: (r.buying_entity as string) ?? undefined,
  updatedBy: (r.updated_by as string) ?? undefined,
  updatedAt: (r.updated_at as string) ?? undefined,
  signerId: (r.signer_id as string) ?? undefined,
  stampX: r.stamp_x != null ? Number(r.stamp_x) : undefined,
  stampY: r.stamp_y != null ? Number(r.stamp_y) : undefined,
  stampScale: r.stamp_scale != null ? Number(r.stamp_scale) : undefined,
  stampDirty: Boolean(r.stamp_dirty),
});

export async function upsertPurchaseOrder(p: PurchaseOrder): Promise<string | null> {
  const row = poToDb(p);
  if (!row) return null;
  const { data, error } = await supabase.from("purchase_orders").upsert(row, { onConflict: "company_id,number" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertPurchaseOrder", error.message); return null; }
  return data.id;
}
export async function deletePurchaseOrderDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
  if (error) console.warn("[db-sync] deletePurchaseOrder", error.message);
}

/* ───────── EXPENSES ───────── */
const expenseToDb = (e: Expense) => {
  const dbCompany = toDbCompanyId(e.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(e.id) ? e.id : undefined,
    company_id: dbCompany,
    kind: e.kind,
    supplier_id: e.supplierId && isUuid(e.supplierId) ? e.supplierId : null,
    payee: e.payee ?? null,
    number: e.number ?? null,
    issue_date: e.issueDate,
    due_date: e.dueDate ?? null,
    amount: e.amount,
    paid: e.paid,
    currency: e.currency,
    status: e.status,
    account: e.account ?? null,
    account_id: e.accountId && isUuid(e.accountId) ? e.accountId : null,
    category: e.category ?? null,
    description: e.description ?? null,
    ...link("project_id", e.projectId),
    attachment_url: e.attachmentUrl ?? null,
    attachment_name: e.attachmentName ?? null,
    payment_cycle: e.paymentCycle ?? null,
    funding_invoice_id: e.fundingInvoiceId && isUuid(e.fundingInvoiceId) ? e.fundingInvoiceId : null,
    medical_claim: e.medicalClaim ?? false,
    reimbursable_pct: e.reimbursablePct ?? null,
    ...(e.createdBy && isUuid(e.createdBy) ? { created_by: e.createdBy } : {}),
  };


};
const expenseFromDb = (r: Record<string, unknown>): Expense => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  kind: (r.kind as Expense["kind"]) ?? "bill",
  supplierId: (r.supplier_id as string) ?? undefined,
  payee: (r.payee as string) ?? undefined,
  number: (r.number as string) ?? undefined,
  issueDate: (r.issue_date as string) ?? "",
  dueDate: (r.due_date as string) ?? undefined,
  amount: Number(r.amount) || 0,
  paid: Number(r.paid) || 0,
  currency: (r.currency as Expense["currency"]) ?? "MGA",
  status: (r.status as Expense["status"]) ?? "draft",
  account: (r.account as string) ?? undefined,
  accountId: (r.account_id as string) ?? undefined,
  category: (r.category as string) ?? undefined,
  description: (r.description as string) ?? undefined,
  projectId: (r.project_id as string) ?? undefined,
  attachmentUrl: (r.attachment_url as string) ?? undefined,
  attachmentName: (r.attachment_name as string) ?? undefined,
  createdBy: (r.created_by as string) ?? undefined,
  paymentCycle: (r.payment_cycle as Expense["paymentCycle"]) ?? undefined,
  fundingInvoiceId: (r.funding_invoice_id as string) ?? undefined,
  medicalClaim: Boolean(r.medical_claim),
  reimbursablePct: r.reimbursable_pct == null ? undefined : Number(r.reimbursable_pct),
});

export async function upsertExpense(e: Expense): Promise<string | null> {
  const row = expenseToDb(e);
  if (!row) return null;
  const { data, error } = await supabase.from("expenses").upsert(row).select("id").single();
  if (error) { console.warn("[db-sync] upsertExpense", error.message); return null; }
  return data.id;
}
export async function deleteExpenseDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteExpense", error.message);
}

/* ───────── RECURRING BILLINGS ───────── */
const rbToDb = (b: RecurringBilling) => {
  const dbCompany = toDbCompanyId(b.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(b.id) ? b.id : undefined,
    company_id: dbCompany,
    ...link("client_id", b.clientId),
    ...link("project_id", b.projectId),
    name: b.name,
    amount: b.amount,
    currency: b.currency,
    frequency: b.frequency,
    start_date: b.startDate,
    next_run_date: b.nextRunDate,
    end_date: b.endDate ?? null,
    payment_terms_days: b.paymentTermsDays ?? null,
    active: b.active,
    last_generated_at: b.lastGeneratedAt ?? null,
    notes: b.notes ?? null,
  };
};
const rbFromDb = (r: Record<string, unknown>): RecurringBilling => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  clientId: (r.client_id as string) ?? "",
  projectId: (r.project_id as string) ?? undefined,
  name: r.name as string,
  amount: Number(r.amount) || 0,
  currency: (r.currency as RecurringBilling["currency"]) ?? "MGA",
  frequency: (r.frequency as RecurringBilling["frequency"]) ?? "monthly",
  startDate: (r.start_date as string) ?? "",
  nextRunDate: (r.next_run_date as string) ?? "",
  endDate: (r.end_date as string) ?? undefined,
  paymentTermsDays: (r.payment_terms_days as number) ?? undefined,
  active: !!r.active,
  lastGeneratedAt: (r.last_generated_at as string) ?? undefined,
  notes: (r.notes as string) ?? undefined,
});
export async function upsertRecurringBilling(b: RecurringBilling): Promise<string | null> {
  const row = rbToDb(b);
  if (!row) return null;
  const { data, error } = await supabase.from("recurring_billings").upsert(row).select("id").single();
  if (error) { console.warn("[db-sync] upsertRecurringBilling", error.message); return null; }
  return data.id;
}
export async function deleteRecurringBillingDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("recurring_billings").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteRecurringBilling", error.message);
}

/* ───────── TEAM MEMBERS ───────── */
const tmToDb = (t: TeamMember) => ({
  id: isUuid(t.id) ? t.id : undefined,
  name: t.name,
  company_id: t.companyId && typeof t.companyId === "string" ? (toDbCompanyId(t.companyId) ?? null) : null,
  is_global: t.companyId === undefined,
  first_name: t.firstName ?? null,
  last_name: t.lastName ?? null,
  email: t.email ?? null,
  phone: t.phone ?? null,
  job_title: t.jobTitle ?? null,
  department: t.department ?? null,
  avatar_url: t.avatarUrl ?? null,
  user_id: t.userId ?? null,
});
const tmFromDb = (r: Record<string, unknown>): TeamMember => ({
  id: r.id as string,
  name: r.name as string,
  companyId: r.is_global ? undefined : r.company_id ? toLocalCompanyId(r.company_id as string) : null,
  firstName: (r.first_name as string) ?? undefined,
  lastName: (r.last_name as string) ?? undefined,
  email: (r.email as string) ?? undefined,
  phone: (r.phone as string) ?? undefined,
  jobTitle: (r.job_title as string) ?? undefined,
  department: (r.department as string) ?? undefined,
  avatarUrl: (r.avatar_url as string) ?? undefined,
  userId: (r.user_id as string) ?? undefined,
});

export async function upsertTeamMember(t: TeamMember): Promise<string | null> {
  const { data, error } = await supabase.from("team_members").upsert(tmToDb(t)).select("id").single();
  if (error) { console.warn("[db-sync] upsertTeamMember", error.message); return null; }
  return data.id;
}
export async function deleteTeamMemberDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteTeamMember", error.message);
}

/* ───────── SALES MEMBERS ───────── */
const smToDb = (s: SalesMember) => ({
  id: isUuid(s.id) ? s.id : undefined,
  team_member_id: isUuid(s.teamMemberId) ? s.teamMemberId : s.teamMemberId,
  role: s.role,
  source: s.source ?? "manual",
});
const smFromDb = (r: Record<string, unknown>): SalesMember => ({
  id: r.id as string,
  teamMemberId: r.team_member_id as string,
  role: (r.role as SalesMember["role"]) ?? "closer",
  source: (r.source as SalesMember["source"]) ?? "manual",
});
export async function upsertSalesMember(s: SalesMember): Promise<string | null> {
  if (!isUuid(s.teamMemberId)) return null; // requires UUID FK
  const { data, error } = await supabase.from("sales_members").upsert(smToDb(s)).select("id").single();
  if (error) { console.warn("[db-sync] upsertSalesMember", error.message); return null; }
  return data.id;
}
export async function deleteSalesMemberDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("sales_members").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteSalesMember", error.message);
}

/* ───────── SALARY REGISTER ───────── */
const srToDb = (s: SalaryRegisterEntry) => {
  const dbCompany = toDbCompanyId(s.companyId);
  if (!dbCompany) return null;
  if (!isUuid(s.teamMemberId)) return null;
  return {
    id: isUuid(s.id) ? s.id : undefined,
    team_member_id: s.teamMemberId,
    company_id: dbCompany,
    gross: s.gross,
    currency: s.currency,
    cnaps_rate: s.cnapsRate,
    ostie_rate: s.ostieRate,
    irsa_rate: s.irsaRate,
    start_date: s.startDate,
    active: s.active,
  };
};
const srFromDb = (r: Record<string, unknown>): SalaryRegisterEntry => ({
  id: r.id as string,
  teamMemberId: r.team_member_id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  gross: Number(r.gross) || 0,
  currency: (r.currency as SalaryRegisterEntry["currency"]) ?? "MGA",
  cnapsRate: Number(r.cnaps_rate) || 0,
  ostieRate: Number(r.ostie_rate) || 0,
  irsaRate: Number(r.irsa_rate) || 0,
  startDate: (r.start_date as string) ?? "",
  active: !!r.active,
});
export async function upsertSalaryRegister(s: SalaryRegisterEntry): Promise<string | null> {
  const row = srToDb(s);
  if (!row) return null;
  const { data, error } = await supabase.from("salary_register").upsert(row).select("id").single();
  if (error) { console.warn("[db-sync] upsertSalaryRegister", error.message); return null; }
  return data.id;
}
export async function deleteSalaryRegisterDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("salary_register").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteSalaryRegister", error.message);
}

/* ───────── PAYROLL RUNS ───────── */
const prToDb = (p: PayrollRun) => {
  const dbCompany = toDbCompanyId(p.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(p.id) ? p.id : undefined,
    company_id: dbCompany,
    month: p.month,
    status: p.status,
    currency: p.currency,
    entries: p.entries as unknown as never,
    validated_at: p.validatedAt ?? null,
    posted_transaction_ids: (p.postedTransactionIds ?? null) as unknown as never,
  };
};
const prFromDb = (r: Record<string, unknown>): PayrollRun => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  month: (r.month as string) ?? "",
  status: (r.status as PayrollRun["status"]) ?? "draft",
  currency: (r.currency as PayrollRun["currency"]) ?? "MGA",
  entries: (r.entries as PayrollEntry[]) ?? [],
  validatedAt: (r.validated_at as string) ?? undefined,
  postedTransactionIds: (r.posted_transaction_ids as string[]) ?? undefined,
});
export async function upsertPayrollRun(p: PayrollRun): Promise<string | null> {
  const row = prToDb(p);
  if (!row) return null;
  const { data, error } = await supabase.from("payroll_runs").upsert(row).select("id").single();
  if (error) { console.warn("[db-sync] upsertPayrollRun", error.message); return null; }
  return data.id;
}
export async function deletePayrollRunDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("payroll_runs").delete().eq("id", id);
  if (error) console.warn("[db-sync] deletePayrollRun", error.message);
}

/* ───────── SOP COMPLIANCE: PVR RECORDS ───────── */
const pvrToDb = (p: PvrRecord) => {
  const dbCompany = toDbCompanyId(p.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(p.id) ? p.id : undefined,
    company_id: dbCompany,
    ...link("invoice_id", p.invoiceId),
    ...link("project_id", p.projectId),
    ...link("quote_id", p.quoteId),
    reference: p.reference ?? null,
    signed_date: p.signedDate,
    completion_pct: p.completionPct,
    signed_by: p.signedBy ?? null,
    scm_coordinator: p.scmCoordinator ?? null,
    document_url: p.documentUrl ?? null,
    document_name: p.documentName ?? null,
    notes: p.notes ?? null,
    ...(p.createdBy && isUuid(p.createdBy) ? { created_by: p.createdBy } : {}),
  };
};
const pvrFromDb = (r: Record<string, unknown>): PvrRecord => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  invoiceId: (r.invoice_id as string) ?? undefined,
  projectId: (r.project_id as string) ?? undefined,
  quoteId: (r.quote_id as string) ?? undefined,
  reference: (r.reference as string) ?? undefined,
  signedDate: (r.signed_date as string) ?? "",
  completionPct: Number(r.completion_pct) || 0,
  signedBy: (r.signed_by as string) ?? undefined,
  scmCoordinator: (r.scm_coordinator as string) ?? undefined,
  documentUrl: (r.document_url as string) ?? undefined,
  documentName: (r.document_name as string) ?? undefined,
  notes: (r.notes as string) ?? undefined,
  createdBy: (r.created_by as string) ?? undefined,
  createdAt: (r.created_at as string) ?? undefined,
});
export async function upsertPvrRecord(p: PvrRecord): Promise<string | null> {
  const row = pvrToDb(p);
  if (!row) return null;
  if (!canWriteCompany(row.company_id)) return null;
  const { data, error } = await supabase.from("pvr_records").upsert(row).select("id").single();
  if (error) { reportWriteError("upsertPvrRecord", error.message); return null; }
  return data.id;
}
export async function deletePvrRecordDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("pvr_records").delete().eq("id", id);
  if (error) reportWriteError("deletePvrRecord", error.message);
}

/* ───────── SOP COMPLIANCE: AR ESCALATIONS ───────── */
const escToDb = (e: InvoiceEscalation) => {
  const dbCompany = toDbCompanyId(e.companyId);
  if (!dbCompany || !isUuid(e.invoiceId)) return null;
  return {
    id: isUuid(e.id) ? e.id : undefined,
    company_id: dbCompany,
    invoice_id: e.invoiceId,
    stage: e.stage,
    action: e.action,
    notes: e.notes ?? null,
    performed_at: e.performedAt,
    performed_by_name: e.performedByName ?? null,
    ...(e.performedBy && isUuid(e.performedBy) ? { performed_by: e.performedBy } : {}),
  };
};
const escFromDb = (r: Record<string, unknown>): InvoiceEscalation => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  invoiceId: (r.invoice_id as string) ?? "",
  stage: Number(r.stage) || 0,
  action: (r.action as string) ?? "",
  notes: (r.notes as string) ?? undefined,
  performedAt: (r.performed_at as string) ?? "",
  performedBy: (r.performed_by as string) ?? undefined,
  performedByName: (r.performed_by_name as string) ?? undefined,
});
export async function upsertInvoiceEscalation(e: InvoiceEscalation): Promise<string | null> {
  const row = escToDb(e);
  if (!row) return null;
  if (!canWriteCompany(row.company_id)) return null;
  const { data, error } = await supabase.from("invoice_escalations").upsert(row).select("id").single();
  if (error) { reportWriteError("upsertInvoiceEscalation", error.message); return null; }
  return data.id;
}

/**
 * Persist an escalation step and report the outcome to the caller so the UI can
 * keep the dialog open and show the real reason when the save is rejected.
 */
export async function saveInvoiceEscalation(
  e: InvoiceEscalation,
): Promise<{ id: string } | { error: string }> {
  const row = escToDb(e);
  if (!row) {
    return {
      error: !isUuid(e.invoiceId)
        ? "This invoice only exists locally and cannot be tracked yet."
        : "This company is not linked to the backend yet.",
    };
  }
  if (!canWriteCompany(row.company_id)) {
    return { error: "You do not have permission to record actions for this company." };
  }
  const { data, error } = await supabase.from("invoice_escalations").upsert(row).select("id").single();
  if (error) {
    return {
      error: error.message.includes("row-level security")
        ? "You do not have permission to record actions for this company."
        : error.message,
    };
  }
  return { id: data.id as string };
}

export async function deleteInvoiceEscalationDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("invoice_escalations").delete().eq("id", id);
  if (error) reportWriteError("deleteInvoiceEscalation", error.message);
}


/* ───────── PROJECT STAGES (workflow sequencing) ───────── */
const stageToDb = (s: ProjectStage) => {
  const dbCompany = toDbCompanyId(s.companyId);
  if (!dbCompany || !isUuid(s.projectId)) return null;
  return {
    id: isUuid(s.id) ? s.id : undefined,
    company_id: dbCompany,
    project_id: s.projectId,
    position: s.position,
    key: s.key,
    name: s.name,
    status: s.status,
    owner: s.owner ?? null,
    planned_start: s.plannedStart ?? null,
    due_date: s.dueDate ?? null,
    started_at: s.startedAt ?? null,
    completed_at: s.completedAt ?? null,
    blocked_reason: s.blockedReason ?? null,
    notes: s.notes ?? null,
    auto: s.auto ?? false,
  };
};

const stageFromDb = (r: Record<string, unknown>): ProjectStage => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  projectId: (r.project_id as string) ?? "",
  position: Number(r.position) || 0,
  key: r.key as string,
  name: r.name as string,
  status: ((r.status as string) ?? "pending") as ProjectStageStatus,
  owner: (r.owner as string) ?? undefined,
  plannedStart: (r.planned_start as string) ?? undefined,
  dueDate: (r.due_date as string) ?? undefined,
  startedAt: (r.started_at as string) ?? undefined,
  completedAt: (r.completed_at as string) ?? undefined,
  blockedReason: (r.blocked_reason as string) ?? undefined,
  notes: (r.notes as string) ?? undefined,
  auto: Boolean(r.auto),
});

export async function upsertProjectStage(s: ProjectStage): Promise<string | null> {
  const row = stageToDb(s);
  if (!row) return null;
  if (!canWriteCompany(row.company_id)) return null;
  const { data, error } = await supabase
    .from("project_stages")
    .upsert(row, { onConflict: "project_id,key" })
    .select("id")
    .single();
  if (error) { reportWriteError("upsertProjectStage", error.message); return null; }
  return data.id;
}

export async function deleteProjectStageDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("project_stages").delete().eq("id", id);
  if (error) reportWriteError("deleteProjectStage", error.message);
}

/* ───────── REGISTER + HYDRATE + SEED for extras ───────── */
export function registerExtraSync() {
  opportunitiesStore.setSync({ upsert: upsertOpportunity, remove: deleteOpportunityDb });
  quotesStore.setSync({ upsert: upsertQuote, remove: deleteQuoteDb });
  purchaseOrdersStore.setSync({ upsert: upsertPurchaseOrder, remove: deletePurchaseOrderDb });
  expensesStore.setSync({ upsert: upsertExpense, remove: deleteExpenseDb });
  recurringBillingsStore.setSync({ upsert: upsertRecurringBilling, remove: deleteRecurringBillingDb });
  teamMembersStore.setSync({ upsert: upsertTeamMember, remove: deleteTeamMemberDb });
  salesMembersStore.setSync({ upsert: upsertSalesMember, remove: deleteSalesMemberDb });
  salaryRegisterStore.setSync({ upsert: upsertSalaryRegister, remove: deleteSalaryRegisterDb });
  payrollRunsStore.setSync({ upsert: upsertPayrollRun, remove: deletePayrollRunDb });
  pvrRecordsStore.setSync({ upsert: upsertPvrRecord, remove: deletePvrRecordDb });
  invoiceEscalationsStore.setSync({ upsert: upsertInvoiceEscalation, remove: deleteInvoiceEscalationDb });
  quoteFollowupsStore.setSync({ upsert: upsertQuoteFollowup, remove: deleteQuoteFollowupDb });
  projectStagesStore.setSync({ upsert: upsertProjectStage, remove: deleteProjectStageDb });
}

export async function hydrateExtras(scope: HydrationScope = { mode: "all" }) {
  const [ops, qts, pos, exps, rbs, srs, prs, pvrs, escs, qfs, stages] = await Promise.all([
    fetchScopedRows("opportunities", scope),
    fetchScopedRows("quotes", scope),
    fetchScopedRows("purchase_orders", scope),
    fetchScopedRows("expenses", scope),
    fetchScopedRows("recurring_billings", scope),
    fetchScopedRows("salary_register", scope),
    fetchScopedRows("payroll_runs", scope),
    fetchScopedRows("pvr_records", scope),
    fetchScopedRows("invoice_escalations", scope),
    fetchScopedRows("quote_followups", scope),
    fetchScopedRows("project_stages", scope),
  ]);
  projectStagesStore.replaceAll(stages.map((r) => stageFromDb(r)));
  pvrRecordsStore.replaceAll(pvrs.map((r) => pvrFromDb(r)));
  invoiceEscalationsStore.replaceAll(escs.map((r) => escFromDb(r)));
  quoteFollowupsStore.replaceAll(qfs.map((r) => followupFromDb(r)));


  opportunitiesStore.replaceAll(ops.map((r) => opportunityFromDb(r)));
  quotesStore.replaceAll(qts.map((r) => quoteFromDb(r)));
  purchaseOrdersStore.replaceAll(pos.map((r) => poFromDb(r)));
  expensesStore.replaceAll(exps.map((r) => expenseFromDb(r)));
  recurringBillingsStore.replaceAll(rbs.map((r) => rbFromDb(r)));
  salaryRegisterStore.replaceAll(srs.map((r) => srFromDb(r)));
  payrollRunsStore.replaceAll(prs.map((r) => prFromDb(r)));

  // Team + sales members load in every scope. In a single-company scope we
  // keep globals ("all companies") plus people assigned to that company.
  let tmQuery = supabase.from("team_members").select("*");
  if (scope.mode === "scoped") {
    tmQuery = scope.companyIds.length
      ? tmQuery.or(`is_global.eq.true,company_id.in.(${scope.companyIds.join(",")})`)
      : tmQuery.eq("is_global", true);
  }
  const { data: tms } = await tmQuery;
  const members = ((tms ?? []) as Record<string, unknown>[]).map((r) => tmFromDb(r));
  teamMembersStore.replaceAll(members);

  const memberIds = members.map((m) => m.id).filter((id) => isUuid(id));
  let smQuery = supabase.from("sales_members").select("*");
  if (scope.mode === "scoped") {
    if (memberIds.length === 0) {
      salesMembersStore.replaceAll([]);
      return;
    }
    smQuery = smQuery.in("team_member_id", memberIds);
  }
  const { data: sms } = await smQuery;
  salesMembersStore.replaceAll(((sms ?? []) as Record<string, unknown>[]).map((r) => smFromDb(r)));
}

export async function pushLocalExtrasSeed(): Promise<Record<string, number>> {
  const counts = {
    opportunities: 0, quotes: 0, purchase_orders: 0, expenses: 0,
    recurring_billings: 0, team_members: 0, sales_members: 0,
    salary_register: 0, payroll_runs: 0,
  };

  // team members first (sales/salary reference them)
  const tmIdMap = new Map<string, string>();
  for (const t of [...teamMembersStore.items]) {
    if (isUuid(t.id)) continue;
    const dbId = await upsertTeamMember(t);
    if (dbId) {
      tmIdMap.set(t.id, dbId);
      const i = teamMembersStore.items.findIndex((x) => x.id === t.id);
      if (i >= 0) teamMembersStore.items[i] = { ...t, id: dbId };
      counts.team_members++;
    }
  }
  if (counts.team_members) teamMembersStore.replaceAll([...teamMembersStore.items]);

  for (const s of [...salesMembersStore.items]) {
    if (isUuid(s.id)) continue;
    const remapped = { ...s, teamMemberId: tmIdMap.get(s.teamMemberId) ?? s.teamMemberId };
    if (!isUuid(remapped.teamMemberId)) continue;
    const dbId = await upsertSalesMember(remapped);
    if (dbId) {
      const i = salesMembersStore.items.findIndex((x) => x.id === s.id);
      if (i >= 0) salesMembersStore.items[i] = { ...remapped, id: dbId };
      counts.sales_members++;
    }
  }
  if (counts.sales_members) salesMembersStore.replaceAll([...salesMembersStore.items]);

  for (const s of [...salaryRegisterStore.items]) {
    if (isUuid(s.id)) continue;
    const remapped = { ...s, teamMemberId: tmIdMap.get(s.teamMemberId) ?? s.teamMemberId };
    if (!toDbCompanyId(remapped.companyId)) continue;
    if (!isUuid(remapped.teamMemberId)) continue;
    const dbId = await upsertSalaryRegister(remapped);
    if (dbId) {
      const i = salaryRegisterStore.items.findIndex((x) => x.id === s.id);
      if (i >= 0) salaryRegisterStore.items[i] = { ...remapped, id: dbId };
      counts.salary_register++;
    }
  }
  if (counts.salary_register) salaryRegisterStore.replaceAll([...salaryRegisterStore.items]);

  const pushSimple = async <T extends { id: string; companyId: string }>(
    store: { items: T[]; replaceAll: (n: T[]) => void },
    upsert: (i: T) => Promise<string | null>,
    key: keyof typeof counts,
  ) => {
    for (const it of [...store.items]) {
      if (isUuid(it.id)) continue;
      if (!toDbCompanyId(it.companyId)) continue;
      const dbId = await upsert(it);
      if (dbId) {
        const idx = store.items.findIndex((x) => x.id === it.id);
        if (idx >= 0) store.items[idx] = { ...it, id: dbId };
        counts[key]++;
      }
    }
    if (counts[key]) store.replaceAll([...store.items]);
  };

  await pushSimple(opportunitiesStore, upsertOpportunity, "opportunities");
  await pushSimple(quotesStore, upsertQuote, "quotes");
  await pushSimple(purchaseOrdersStore, upsertPurchaseOrder, "purchase_orders");
  await pushSimple(expensesStore, upsertExpense, "expenses");
  await pushSimple(recurringBillingsStore, upsertRecurringBilling, "recurring_billings");
  await pushSimple(payrollRunsStore, upsertPayrollRun, "payroll_runs");

  return counts;
}

/* ───────────────────────── BANK RECONCILIATIONS ───────────────────────── */

export interface BankReconciliation {
  id: string;
  accountId: string;
  periodStart?: string;
  periodEnd?: string;
  statementClosingBalance: number;
  computedClosingBalance: number;
  difference: number;
  rowCount: number;
  statementName?: string;
  openingBalance?: number;
  adjustmentAmount?: number;
  adjustmentTransactionId?: string;
  createdAt: string;
}

const reconFromDb = (r: Record<string, unknown>): BankReconciliation => ({
  id: r.id as string,
  accountId: r.account_id as string,
  periodStart: (r.period_start as string) ?? undefined,
  periodEnd: (r.period_end as string) ?? undefined,
  statementClosingBalance: Number(r.statement_closing_balance) || 0,
  computedClosingBalance: Number(r.computed_closing_balance) || 0,
  difference: Number(r.difference) || 0,
  rowCount: Number(r.row_count) || 0,
  statementName: (r.statement_name as string) ?? undefined,
  openingBalance: r.opening_balance == null ? undefined : Number(r.opening_balance),
  adjustmentAmount: r.adjustment_amount == null ? undefined : Number(r.adjustment_amount),
  adjustmentTransactionId: (r.adjustment_transaction_id as string) ?? undefined,
  createdAt: (r.created_at as string) ?? new Date().toISOString(),
});

export async function fetchReconciliations(accountId: string): Promise<BankReconciliation[]> {
  if (!isUuid(accountId)) return [];
  const { data, error } = await supabase
    .from("bank_reconciliations")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (error) { console.warn("[db-sync] fetchReconciliations", error.message); return []; }
  return (data ?? []).map((r) => reconFromDb(r as Record<string, unknown>));
}

export async function saveReconciliation(input: {
  companyId: string;
  accountId: string;
  periodStart?: string;
  periodEnd?: string;
  statementClosingBalance: number;
  computedClosingBalance: number;
  difference: number;
  rowCount: number;
  statementName?: string;
  openingBalance?: number;
  adjustmentAmount?: number;
  adjustmentTransactionId?: string;
}): Promise<void> {
  const dbCompany = toDbCompanyId(input.companyId);
  if (!dbCompany || !isUuid(input.accountId)) return;
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("bank_reconciliations").insert({
    company_id: dbCompany,
    account_id: input.accountId,
    period_start: input.periodStart || null,
    period_end: input.periodEnd || null,
    statement_closing_balance: input.statementClosingBalance,
    computed_closing_balance: input.computedClosingBalance,
    difference: input.difference,
    row_count: input.rowCount,
    statement_name: input.statementName ?? null,
    opening_balance: input.openingBalance ?? null,
    adjustment_amount: input.adjustmentAmount ?? null,
    adjustment_transaction_id: isUuid(input.adjustmentTransactionId ?? "") ? input.adjustmentTransactionId : null,
    created_by: auth.user?.id ?? null,
  });
  if (error) console.warn("[db-sync] saveReconciliation", error.message);
}

/* ═════════════════════ JOURNAL ENTRIES (Grand Livre) ═════════════════════ */

const journalEntryToDb = (e: JournalEntry) => {
  const dbCompany = toDbCompanyId(e.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(e.id) ? e.id : undefined,
    company_id: dbCompany,
    journal: e.journal,
    date: e.date,
    piece: e.piece,
    description: e.description ?? "",
    lines: JSON.parse(JSON.stringify(e.lines ?? [])) as unknown as never,
  };
};

const journalEntryFromDb = (r: Record<string, unknown>): JournalEntry => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  journal: r.journal as string,
  date: r.date as string,
  piece: (r.piece as string) ?? "",
  description: (r.description as string) ?? "",
  lines: (r.lines as JournalEntry["lines"]) ?? [],
});

export async function upsertJournalEntry(e: JournalEntry): Promise<string | null> {
  const row = journalEntryToDb(e);
  if (!row || !canWriteCompany(row.company_id)) return null;
  const { data, error } = await supabase
    .from("journal_entries")
    .upsert(row, { onConflict: "company_id,journal,date,piece" })
    .select("id")
    .single();
  if (error) { reportWriteError("upsertJournalEntry", error.message); return null; }
  return (data?.id as string | undefined) ?? null;
}

export async function deleteJournalEntryDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteJournalEntry", error.message);
}

export function registerJournalSync() {
  journalEntriesStore.setSync({ upsert: upsertJournalEntry, remove: deleteJournalEntryDb });
}

/**
 * Pull the Grand Livre from the backend. The backend is the source of truth
 * whenever it holds entries for a company: the bundled snapshot only serves as
 * a fallback for companies that were never imported.
 */
export async function hydrateJournalEntries(scope: HydrationScope = { mode: "all" }) {
  const rows = await fetchScopedRows("journal_entries", scope);
  if (rows.length === 0) return 0;
  const fetched = rows.map((r) => journalEntryFromDb(r));
  const backendCompanies = new Set(fetched.map((e) => e.companyId));
  const kept = journalEntriesStore.items.filter((e) => !backendCompanies.has(e.companyId));
  journalEntriesStore.replaceAll([...kept, ...fetched]);
  return fetched.length;
}
