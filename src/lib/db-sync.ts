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
  type Client, type Supplier, type Project,
  type Account, type Category, type Budget,
  type Transaction, type Invoice, type QuoteLine,
  type Opportunity, type Quote, type PurchaseOrder,
  type Expense, type RecurringBilling,
  type TeamMember, type SalesMember,
  type SalaryRegisterEntry, type PayrollRun, type PayrollEntry,
} from "./mock-data";

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
const toLocalCompanyId = (dbId: string) => companyLocalIdByDb.get(dbId) ?? dbId;

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/* ───────────────────────── CLIENTS ───────────────────────── */

const clientToDb = (c: Client) => {
  const dbCompany = toDbCompanyId(c.companyId);
  if (!dbCompany) return null;
  return {
    id: isUuid(c.id) ? c.id : undefined,
    company_id: dbCompany,
    name: c.name,
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
  };
};

const clientFromDb = (r: Record<string, unknown>): Client => ({
  id: r.id as string,
  companyId: toLocalCompanyId(r.company_id as string),
  name: r.name as string,
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
  nif: (r.nif as string) ?? undefined,
  stat: (r.stat as string) ?? undefined,
  rcs: (r.rcs as string) ?? undefined,
  categories: (r.categories as Client["categories"]) ?? undefined,
});

/** Insert or update a client in DB. Returns the DB uuid if persisted. */
export async function upsertClient(c: Client): Promise<string | null> {
  const row = clientToDb(c);
  if (!row) return null;
  const { data, error } = await supabase.from("clients").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertClient", error.message); return null; }
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
  const { data, error } = await supabase.from("projects").upsert(row, { onConflict: "company_id,name" }).select("id").single();
  if (error) { console.warn("[db-sync] upsertProject", error.message); return null; }
  return data.id;
}

export async function deleteProjectDb(id: string) {
  if (!isUuid(id)) return;
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) console.warn("[db-sync] deleteProject", error.message);
}

/* ─────────────────────── HYDRATION ─────────────────────── */

/** Pull clients/suppliers/projects from DB and merge into local stores by id. */
export async function hydrateContacts() {
  const [{ data: cli }, { data: sup }, { data: prj }] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("suppliers").select("*"),
    supabase.from("projects").select("*"),
  ]);

  if (cli) {
    const byId = new Map(clientsStore.items.map((c) => [c.id, c]));
    cli.forEach((r) => byId.set(r.id, clientFromDb(r as Record<string, unknown>)));
    clientsStore.replaceAll([...byId.values()]);
  }
  if (sup) {
    const byId = new Map(suppliersStore.items.map((s) => [s.id, s]));
    sup.forEach((r) => byId.set(r.id, supplierFromDb(r as Record<string, unknown>)));
    suppliersStore.replaceAll([...byId.values()]);
  }
  if (prj) {
    const byId = new Map(projectsStore.items.map((p) => [p.id, p]));
    prj.forEach((r) => byId.set(r.id, projectFromDb(r as Record<string, unknown>)));
    projectsStore.replaceAll([...byId.values()]);
  }
}

/* ─────────── ONE-TIME PUSH OF LOCAL MOCK SEED ─────────── */

/**
 * Push locally-seeded clients/suppliers/projects (those with non-UUID ids
 * whose companyId maps to a real DB company) up to Supabase, swapping their
 * local id with the returned DB uuid. Idempotent: once an item has a UUID,
 * it is skipped. Returns counts of records pushed.
 */
export async function pushLocalSeed(): Promise<{ clients: number; suppliers: number; projects: number }> {
  let cliN = 0, supN = 0, prjN = 0;
  const idRemap = new Map<string, string>(); // localClientId -> dbId

  // CLIENTS
  for (const c of [...clientsStore.items]) {
    if (isUuid(c.id)) continue;
    if (!toDbCompanyId(c.companyId)) continue;
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
    if (isUuid(s.id)) continue;
    if (!toDbCompanyId(s.companyId)) continue;
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
    client_id: t.clientId && isUuid(t.clientId) ? t.clientId : null,
    supplier_id: t.supplierId && isUuid(t.supplierId) ? t.supplierId : null,
    project_id: t.projectId && isUuid(t.projectId) ? t.projectId : null,
    invoice_id: t.invoiceId && isUuid(t.invoiceId) ? t.invoiceId : null,
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
  const { data, error } = await supabase.from("transactions").upsert(row).select("id").single();
  if (error) { console.warn("[db-sync] upsertTransaction", error.message); return null; }
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
    client_id: inv.clientId && isUuid(inv.clientId) ? inv.clientId : null,
    project_id: inv.projectId && isUuid(inv.projectId) ? inv.projectId : null,
    po_id: inv.poId && isUuid(inv.poId) ? inv.poId : null,
    quote_id: inv.quoteId && isUuid(inv.quoteId) ? inv.quoteId : null,
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
  };
};

const invoiceFromDb = (r: Record<string, unknown>, lines: QuoteLine[]): Invoice => ({
  id: r.id as string,
  number: (r.number as string) ?? "",
  companyId: toLocalCompanyId(r.company_id as string),
  clientId: (r.client_id as string) ?? "",
  projectId: (r.project_id as string) ?? undefined,
  poId: (r.po_id as string) ?? undefined,
  quoteId: (r.quote_id as string) ?? undefined,
  issueDate: (r.issue_date as string) ?? "",
  dueDate: (r.due_date as string) ?? "",
  amount: Number(r.amount) || 0,
  paid: Number(r.paid) || 0,
  paidDate: (r.paid_date as string) ?? undefined,
  currency: (r.currency as Invoice["currency"]) ?? "MGA",
  status: (r.status as Invoice["status"]) ?? "draft",
  cancelledAt: (r.cancelled_at as string) ?? undefined,
  cancellationReason: (r.cancellation_reason as string) ?? undefined,
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
        capability: l.capability ?? null,
        level: l.level ?? null,
        unit: l.unit,
        quantity: l.quantity,
        rate: l.rate,
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

export async function hydrateFinancials() {
  const [
    { data: accs },
    { data: cats },
    { data: buds },
    { data: txs },
    { data: invs },
    { data: lines },
  ] = await Promise.all([
    supabase.from("accounts").select("*"),
    supabase.from("categories").select("*"),
    supabase.from("budgets").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("invoice_lines").select("*").order("position", { ascending: true }),
  ]);

  if (accs) {
    const byId = new Map(accountsStore.items.map((x) => [x.id, x]));
    accs.forEach((r) => byId.set(r.id, accountFromDb(r as Record<string, unknown>)));
    accountsStore.replaceAll([...byId.values()]);
  }
  if (cats) {
    const byId = new Map(categoriesStore.items.map((x) => [x.id, x]));
    cats.forEach((r) => byId.set(r.id, categoryFromDb(r as Record<string, unknown>)));
    categoriesStore.replaceAll([...byId.values()]);
  }
  if (buds) {
    const byId = new Map(budgetsStore.items.map((x) => [x.id, x]));
    buds.forEach((r) => byId.set(r.id, budgetFromDb(r as Record<string, unknown>)));
    budgetsStore.replaceAll([...byId.values()]);
  }
  if (txs) {
    const byId = new Map(transactionsStore.items.map((x) => [x.id, x]));
    txs.forEach((r) => byId.set(r.id, transactionFromDb(r as Record<string, unknown>)));
    transactionsStore.replaceAll([...byId.values()]);
  }
  if (invs) {
    const linesByInv = new Map<string, QuoteLine[]>();
    (lines ?? []).forEach((l) => {
      const arr = linesByInv.get(l.invoice_id as string) ?? [];
      arr.push({
        id: l.id as string,
        description: (l.description as string) ?? "",
        capability: (l.capability as string) ?? undefined,
        level: (l.level as string) ?? undefined,
        unit: (l.unit as QuoteLine["unit"]) ?? "fixed",
        quantity: Number(l.quantity) || 0,
        rate: Number(l.rate) || 0,
      });
      linesByInv.set(l.invoice_id as string, arr);
    });
    const byId = new Map(invoicesStore.items.map((x) => [x.id, x]));
    invs.forEach((r) => {
      const ls = linesByInv.get(r.id as string) ?? [];
      byId.set(r.id as string, invoiceFromDb(r as Record<string, unknown>, ls));
    });
    invoicesStore.replaceAll([...byId.values()]);
  }
}

/* ─────────── PUSH LOCAL FINANCIAL SEED ─────────── */

/** Push locally-seeded accounts/categories/budgets/transactions/invoices to DB.
 *  Idempotent: items already with a UUID id are skipped. */
export async function pushLocalFinancialSeed(): Promise<{
  accounts: number; categories: number; budgets: number; transactions: number; invoices: number;
}> {
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
  });



  for (const a of [...accountsStore.items]) {
    if (isUuid(a.id) || !toDbCompanyId(a.companyId)) continue;
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
    if (isUuid(c.id) || !toDbCompanyId(c.companyId)) continue;
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
    if (isUuid(b.id) || !toDbCompanyId(b.companyId)) continue;
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
    if (isUuid(inv.id) || !toDbCompanyId(inv.companyId)) continue;
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
    if (isUuid(t.id) || !toDbCompanyId(t.companyId)) continue;
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
    client_id: o.clientId && isUuid(o.clientId) ? o.clientId : null,
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
    client_id: q.clientId && isUuid(q.clientId) ? q.clientId : null,
    project_id: q.projectId && isUuid(q.projectId) ? q.projectId : null,
    number: q.number,
    issue_date: q.issueDate,
    valid_until: q.validUntil,
    amount: q.amount,
    currency: q.currency,
    status: q.status,
    notes: q.notes ?? null,
    mode: q.mode ?? null,
    lines: (q.lines ?? null) as unknown as never,
    tax_rate: q.taxRate ?? 0,
    tax_amount: q.taxAmount ?? 0,
    total_amount: q.totalAmount ?? q.amount,
    fx_rate: q.fxRate ?? null,
    fx_base_currency: q.fxBaseCurrency ?? null,
    pdf_url: q.pdfUrl ?? null,
    sent_at: q.sentAt ?? null,
    sent_to: q.sentTo ?? null,
  };
};
const quoteFromDb = (r: Record<string, unknown>): Quote => ({
  id: r.id as string,
  number: (r.number as string) ?? "",
  companyId: toLocalCompanyId(r.company_id as string),
  clientId: (r.client_id as string) ?? "",
  projectId: (r.project_id as string) ?? undefined,
  issueDate: (r.issue_date as string) ?? "",
  validUntil: (r.valid_until as string) ?? "",
  amount: Number(r.amount) || 0,
  currency: (r.currency as Quote["currency"]) ?? "MGA",
  status: (r.status as Quote["status"]) ?? "draft",
  notes: (r.notes as string) ?? undefined,
  mode: (r.mode as Quote["mode"]) ?? undefined,
  lines: (r.lines as QuoteLine[]) ?? undefined,
  taxRate: r.tax_rate != null ? Number(r.tax_rate) : undefined,
  taxAmount: r.tax_amount != null ? Number(r.tax_amount) : undefined,
  totalAmount: r.total_amount != null ? Number(r.total_amount) : undefined,
  fxRate: r.fx_rate != null ? Number(r.fx_rate) : undefined,
  fxBaseCurrency: (r.fx_base_currency as Quote["fxBaseCurrency"]) ?? undefined,
  pdfUrl: (r.pdf_url as string) ?? undefined,
  sentAt: (r.sent_at as string) ?? undefined,
  sentTo: (r.sent_to as string) ?? undefined,
});
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
    client_id: p.clientId && isUuid(p.clientId) ? p.clientId : null,
    project_id: p.projectId && isUuid(p.projectId) ? p.projectId : null,
    quote_id: p.quoteId && isUuid(p.quoteId) ? p.quoteId : null,
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
    category: e.category ?? null,
    description: e.description ?? null,
    project_id: e.projectId && isUuid(e.projectId) ? e.projectId : null,
    attachment_url: e.attachmentUrl ?? null,
    attachment_name: e.attachmentName ?? null,
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
  category: (r.category as string) ?? undefined,
  description: (r.description as string) ?? undefined,
  projectId: (r.project_id as string) ?? undefined,
  attachmentUrl: (r.attachment_url as string) ?? undefined,
  attachmentName: (r.attachment_name as string) ?? undefined,
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
    client_id: b.clientId && isUuid(b.clientId) ? b.clientId : null,
    project_id: b.projectId && isUuid(b.projectId) ? b.projectId : null,
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
  first_name: t.firstName ?? null,
  last_name: t.lastName ?? null,
  email: t.email ?? null,
  phone: t.phone ?? null,
  job_title: t.jobTitle ?? null,
  department: t.department ?? null,
  avatar_url: t.avatarUrl ?? null,
});
const tmFromDb = (r: Record<string, unknown>): TeamMember => ({
  id: r.id as string,
  name: r.name as string,
  firstName: (r.first_name as string) ?? undefined,
  lastName: (r.last_name as string) ?? undefined,
  email: (r.email as string) ?? undefined,
  phone: (r.phone as string) ?? undefined,
  jobTitle: (r.job_title as string) ?? undefined,
  department: (r.department as string) ?? undefined,
  avatarUrl: (r.avatar_url as string) ?? undefined,
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
});
const smFromDb = (r: Record<string, unknown>): SalesMember => ({
  id: r.id as string,
  teamMemberId: r.team_member_id as string,
  role: (r.role as SalesMember["role"]) ?? "closer",
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
}

export async function hydrateExtras() {
  const [
    { data: ops }, { data: qts }, { data: pos }, { data: exps },
    { data: rbs }, { data: tms }, { data: sms }, { data: srs }, { data: prs },
  ] = await Promise.all([
    supabase.from("opportunities").select("*"),
    supabase.from("quotes").select("*"),
    supabase.from("purchase_orders").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("recurring_billings").select("*"),
    supabase.from("team_members").select("*"),
    supabase.from("sales_members").select("*"),
    supabase.from("salary_register").select("*"),
    supabase.from("payroll_runs").select("*"),
  ]);
  const merge = <T extends { id: string }>(
    store: { items: T[]; replaceAll: (n: T[]) => void },
    rows: Array<Record<string, unknown>> | null,
    map: (r: Record<string, unknown>) => T,
  ) => {
    if (!rows) return;
    const byId = new Map(store.items.map((x) => [x.id, x]));
    rows.forEach((r) => byId.set(r.id as string, map(r)));
    store.replaceAll([...byId.values()]);
  };
  merge(opportunitiesStore, ops, opportunityFromDb);
  merge(quotesStore, qts, quoteFromDb);
  merge(purchaseOrdersStore, pos, poFromDb);
  merge(expensesStore, exps, expenseFromDb);
  merge(recurringBillingsStore, rbs, rbFromDb);
  merge(teamMembersStore, tms, tmFromDb);
  merge(salesMembersStore, sms, smFromDb);
  merge(salaryRegisterStore, srs, srFromDb);
  merge(payrollRunsStore, prs, prFromDb);
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
