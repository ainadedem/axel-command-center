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
  type Client, type Supplier, type Project,
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
  const { data, error } = await supabase.from("clients").upsert(row).select("id").single();
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
  const { data, error } = await supabase.from("suppliers").upsert(row).select("id").single();
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
  const { data, error } = await supabase.from("projects").upsert(row).select("id").single();
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
