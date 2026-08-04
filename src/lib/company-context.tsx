import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useCompanies, companiesStore, accountsStore, categoriesStore, budgetsStore,
  transactionsStore, invoicesStore, opportunitiesStore, quotesStore, purchaseOrdersStore,
  expensesStore, recurringBillingsStore, salaryRegisterStore, payrollRunsStore,
  clientsStore, suppliersStore, projectsStore, teamMembersStore, salesMembersStore,
  contactCompanyIds, type Company,
} from "./mock-data";
import { useAuth } from "./auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  setCompanyIdMap, hydrateContacts, pushLocalSeed,
  registerFinancialSync, hydrateFinancials, pushLocalFinancialSeed,
  registerExtraSync, hydrateExtras, pushLocalExtrasSeed, type HydrationScope,
} from "./db-sync";
import "./pcg";

registerFinancialSync();
registerExtraSync();

const FALLBACK_COLORS = ["#7c3aed", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#ec4899"];

function keepCompanyScoped<T extends { companyId: string }>(
  store: { items: T[]; replaceAll: (next: T[]) => void },
  allowedCompanyIds: Set<string>,
) {
  const next = store.items.filter((item) => allowedCompanyIds.has(item.companyId));
  if (next.length !== store.items.length) store.replaceAll(next);
}

function keepContactScoped<T extends { companyId: string; companyIds?: string[] }>(
  store: { items: T[]; replaceAll: (next: T[]) => void },
  allowedCompanyIds: Set<string>,
) {
  const next = store.items.filter((item) => contactCompanyIds(item).some((id) => allowedCompanyIds.has(id)));
  if (next.length !== store.items.length) store.replaceAll(next);
}

function restrictLocalStores(allowedCompanies: Company[]) {
  const allowedCompanyIds = new Set(allowedCompanies.map((c) => c.id));
  const allowedCodes = new Set(allowedCompanies.map((c) => (c.code || c.shortName || "").toUpperCase()));

  const visibleCompanies = companiesStore.items.filter((c) => allowedCodes.has((c.code || c.shortName || "").toUpperCase()));
  if (visibleCompanies.length !== companiesStore.items.length) companiesStore.replaceAll(visibleCompanies);

  keepContactScoped(clientsStore, allowedCompanyIds);
  keepContactScoped(suppliersStore, allowedCompanyIds);
  keepCompanyScoped(projectsStore, allowedCompanyIds);
  keepCompanyScoped(accountsStore, allowedCompanyIds);
  keepCompanyScoped(categoriesStore, allowedCompanyIds);
  keepCompanyScoped(budgetsStore, allowedCompanyIds);
  keepCompanyScoped(transactionsStore, allowedCompanyIds);
  keepCompanyScoped(invoicesStore, allowedCompanyIds);
  keepCompanyScoped(opportunitiesStore, allowedCompanyIds);
  keepCompanyScoped(quotesStore, allowedCompanyIds);
  keepCompanyScoped(purchaseOrdersStore, allowedCompanyIds);
  keepCompanyScoped(expensesStore, allowedCompanyIds);
  keepCompanyScoped(recurringBillingsStore, allowedCompanyIds);
  keepCompanyScoped(salaryRegisterStore, allowedCompanyIds);
  keepCompanyScoped(payrollRunsStore, allowedCompanyIds);
  if (teamMembersStore.items.length) teamMembersStore.replaceAll([]);
  if (salesMembersStore.items.length) salesMembersStore.replaceAll([]);
}

type Scope = { id: "group" } | { id: "company"; companyId: string };

export type CompanyRole =
  | "company_admin"
  | "manager"
  | "project_manager"
  | "sales"
  | "finance"
  | "viewer";

export const COMPANY_ROLES: CompanyRole[] = [
  "company_admin",
  "manager",
  "project_manager",
  "sales",
  "finance",
  "viewer",
];

interface Ctx {
  scope: Scope;
  setScope: (s: Scope) => void;
  accessibleCompanies: Company[];
  scopedCompanies: Company[];
  label: string;
  accessLoading: boolean;
  dataLoading: boolean;
  bootstrapReady: boolean;
  isGroupAdmin: boolean;
  roleFor: (companyId: string) => CompanyRole | undefined;
  hasCompanyRole: (companyId: string, allowed: CompanyRole[]) => boolean;
}

const CompanyCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "axel.companyScope";

function loadScope(): Scope {
  if (typeof window === "undefined") return { id: "group" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { id: "group" };
    const parsed = JSON.parse(raw) as Scope;
    if (parsed?.id === "group" || (parsed?.id === "company" && typeof parsed.companyId === "string")) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return { id: "group" };
}

function mapCompanyRow(row: Record<string, unknown>, fallbackColorIdx: number): Company {
  const code = String(row.code || "").toUpperCase();
  const shortName = (row.short_name as string) || code || String(row.name).slice(0, 3).toUpperCase();
  return {
    id: row.id as string,
    name: row.name as string,
    shortName,
    code,
    color: (row.color as string) || FALLBACK_COLORS[fallbackColorIdx % FALLBACK_COLORS.length],
    baseCurrency: ((row.base_currency as Company["baseCurrency"]) || "MGA"),
    legalName: (row.legal_name as string) || undefined,
    address: (row.address as string) || undefined,
    email: (row.email as string) || undefined,
    phone: (row.phone as string) || undefined,
    website: (row.website as string) || undefined,
    nif: (row.nif as string) || undefined,
    stat: (row.stat as string) || undefined,
    rcs: (row.rcs as string) || undefined,
    taxId: (row.tax_id as string) || undefined,
    bankName: (row.bank_name as string) || undefined,
    bankAccount: (row.bank_account as string) || undefined,
    bankSwift: (row.bank_swift as string) || undefined,
    bankHolder: (row.bank_holder as string) || undefined,
    bankCode: (row.bank_code as string) || undefined,
    branchCode: (row.branch_code as string) || undefined,
    accountNumber: (row.account_number as string) || undefined,
    ribKey: (row.rib_key as string) || undefined,
    iban: (row.iban as string) || undefined,
    intlEnabled: Boolean(row.intl_enabled),
    mobileEnabled: Boolean(row.mobile_enabled),
    mobileProvider: (row.mobile_provider as string) || undefined,
    mobileNumber: (row.mobile_number as string) || undefined,
    mobileName: (row.mobile_name as string) || undefined,
    showPaymentDetails: row.show_payment_details === false ? false : true,

    logoUrl: (row.logo_url as string) || undefined,
  };
}

function mergeCompanies(rows: Record<string, unknown>[]) {
  const existing = companiesStore.items;
  const seedIds = new Set(["log", "win", "axi"]);
  const seen = new Map<string, Company>();
  const noCode: Company[] = [];

  for (const company of existing) {
    const key = (company.code || company.shortName || "").toUpperCase();
    if (!key) {
      noCode.push(company);
      continue;
    }
    const prev = seen.get(key);
    if (!prev) seen.set(key, company);
    else if (seedIds.has(company.id) && !seedIds.has(prev.id)) seen.set(key, company);
  }

  const deduped: Company[] = [...seen.values(), ...noCode];
  const byCode = new Map(deduped.map((company) => [(company.code || company.shortName || "").toUpperCase(), company]));
  const merged: Company[] = [];
  const idMap: Array<{ localId: string; dbId: string }> = [];

  rows.forEach((row, idx) => {
    const entry = mapCompanyRow(row, deduped.length + idx);
    const key = entry.code || entry.shortName;
    if (!key) {
      merged.push(entry);
      idMap.push({ localId: entry.id, dbId: row.id as string });
      return;
    }

    const existingEntry = byCode.get(key);
    if (existingEntry) {
      merged.push({ ...entry, id: existingEntry.id });
      idMap.push({ localId: existingEntry.id, dbId: row.id as string });
    } else {
      merged.push(entry);
      idMap.push({ localId: entry.id, dbId: row.id as string });
    }
  });

  return { merged, idMap };
}

function resolveScopeForHydration(
  requestedScope: Scope,
  isGroupAdmin: boolean,
  accessibleDbCompanyIds: string[],
  accessibleCompanies: Company[],
  idMap: Array<{ localId: string; dbId: string }>,
): Scope {
  if (requestedScope.id === "group" && isGroupAdmin) return requestedScope;
  if (accessibleCompanies.length === 0) return requestedScope;
  if (requestedScope.id === "company" && accessibleCompanies.some((company) => company.id === requestedScope.companyId)) {
    return requestedScope;
  }
  return { id: "company", companyId: accessibleCompanies[0].id };
}

function getHydrationScope(
  selectedScope: Scope,
  isGroupAdmin: boolean,
  accessibleDbCompanyIds: string[],
  idMap: Array<{ localId: string; dbId: string }>,
): HydrationScope {
  if (selectedScope.id === "group") {
    return isGroupAdmin
      ? { mode: "all" }
      : { mode: "scoped", companyIds: accessibleDbCompanyIds };
  }

  const dbId = idMap.find((entry) => entry.localId === selectedScope.companyId)?.dbId;
  return { mode: "scoped", companyIds: dbId ? [dbId] : [] };
}

type SeedTable = "clients" | "accounts" | "transactions" | "invoices" | "opportunities";

/** Local company ids that have local rows but zero rows in the backend for `table`. */
async function companiesMissingRows(
  table: SeedTable,
  targets: Array<{ localId: string; dbId: string }>,
): Promise<string[]> {
  const missing: string[] = [];
  for (const target of targets) {
    const { count, error } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("company_id", target.dbId);
    if (error) continue;
    if ((count ?? 0) === 0) missing.push(target.localId);
  }
  return missing;
}

async function maybePushSeeds(userId: string, idMap: Array<{ localId: string; dbId: string }>) {
  // v4 flags: the previous versions gated on a global row count, so a company
  // whose rows were cleared server-side never got re-pushed.
  const seedFlag = `axel.seedPushed.${userId}.v4`;
  const finSeedFlag = `axel.finSeedPushed.${userId}.v4`;
  const extrasFlag = `axel.extrasSeedPushed.${userId}.v2`;

  const targetsFor = (localCompanyIds: string[]) => {
    const wanted = new Set(localCompanyIds);
    return idMap.filter((entry) => wanted.has(entry.localId));
  };

  try {
    const targets = targetsFor(clientsStore.items.map((c) => c.companyId));
    const missing = await companiesMissingRows("clients", targets);
    if (!window.localStorage.getItem(seedFlag) || missing.length > 0) {
      const res = await pushLocalSeed(missing);
      window.localStorage.setItem(seedFlag, new Date().toISOString());
      console.info("[pushLocalSeed]", res, { repaired: missing });
    }
  } catch (e) {
    console.warn("[pushLocalSeed]", e);
  }

  try {
    // Only flag a company for a table it actually has local rows for, so a
    // company that legitimately has no invoices isn't re-pushed on every load.
    const missing = Array.from(new Set([
      ...(await companiesMissingRows("accounts", targetsFor(accountsStore.items.map((a) => a.companyId)))),
      ...(await companiesMissingRows("transactions", targetsFor(transactionsStore.items.map((t) => t.companyId)))),
      ...(await companiesMissingRows("invoices", targetsFor(invoicesStore.items.map((i) => i.companyId)))),
    ]));
    if (!window.localStorage.getItem(finSeedFlag) || missing.length > 0) {
      const res = await pushLocalFinancialSeed(missing);
      window.localStorage.setItem(finSeedFlag, new Date().toISOString());
      console.info("[pushLocalFinancialSeed]", res, { repaired: missing });
    }
  } catch (e) {
    console.warn("[pushLocalFinancialSeed]", e);
  }

  try {
    const targets = targetsFor(opportunitiesStore.items.map((o) => o.companyId));
    const missing = await companiesMissingRows("opportunities", targets);
    if (!window.localStorage.getItem(extrasFlag) || missing.length > 0) {
      const res = await pushLocalExtrasSeed();
      window.localStorage.setItem(extrasFlag, new Date().toISOString());
      console.info("[pushLocalExtrasSeed]", res, { repaired: missing });
    }
  } catch (e) {
    console.warn("[pushLocalExtrasSeed]", e);
  }
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<Scope>(loadScope);
  const allCompanies = useCompanies();
  const { user, roles, loading: authLoading } = useAuth();
  const currentScopeRef = useRef(scope);
  const scopeReloadSeq = useRef(0);
  const hasCompletedInitialHydration = useRef(false);

  const isGroupAdmin = roles.includes("group_admin") || roles.includes("super_admin");

  const [allowedCodes, setAllowedCodes] = useState<string[] | null>(null);
  const [accessibleDbCompanyIds, setAccessibleDbCompanyIds] = useState<string[]>([]);
  const [companyIdMapEntries, setCompanyIdMapEntries] = useState<Array<{ localId: string; dbId: string }>>([]);
  const [roleByCompanyId, setRoleByCompanyId] = useState<Map<string, CompanyRole>>(new Map());
  const [accessLoading, setAccessLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [bootstrapReady, setBootstrapReady] = useState(false);

  useEffect(() => {
    currentScopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (authLoading) return;

      setBootstrapReady(false);
      setAccessLoading(true);
      setDataLoading(true);

      if (!user) {
        setAllowedCodes(null);
        setAccessibleDbCompanyIds([]);
        setCompanyIdMapEntries([]);
        setRoleByCompanyId(new Map());
        setAccessLoading(false);
        setDataLoading(false);
        setBootstrapReady(true);
        return;
      }

      const { data } = await supabase
        .from("user_company_access")
        .select("company_id, role, companies ( code )")
        .eq("user_id", user.id);
      if (cancelled) return;

      const rows = (data ?? []) as Array<{
        company_id: string;
        role: CompanyRole;
        companies: { code: string } | null;
      }>;
      const nextRoles = new Map<string, CompanyRole>();
      for (const row of rows) nextRoles.set(row.company_id, row.role);
      setRoleByCompanyId(nextRoles);

      const accessibleDbCompanyIds = isGroupAdmin ? null : rows.map((row) => row.company_id);
      const nextAccessibleDbCompanyIds = accessibleDbCompanyIds ?? [];
      setAccessibleDbCompanyIds(nextAccessibleDbCompanyIds);
      setAllowedCodes(
        isGroupAdmin
          ? null
          : rows.map((row) => row.companies?.code).filter((code): code is string => !!code),
      );
      setAccessLoading(false);

      let companyRows: Record<string, unknown>[] = [];
      if (isGroupAdmin) {
        const { data: allRows, error } = await supabase.from("companies").select("*");
        if (cancelled || error) return;
        companyRows = (allRows ?? []) as Record<string, unknown>[];
      } else if ((accessibleDbCompanyIds ?? []).length > 0) {
        const { data: scopedRows, error } = await supabase.from("companies").select("*").in("id", accessibleDbCompanyIds!);
        if (cancelled || error) return;
        companyRows = (scopedRows ?? []) as Record<string, unknown>[];
      }

      const { merged, idMap } = mergeCompanies(companyRows);
      companiesStore.replaceAll(merged);
      setCompanyIdMap(idMap);
      setCompanyIdMapEntries(idMap);

      if (!isGroupAdmin) restrictLocalStores(merged);

      await maybePushSeeds(user.id, idMap);
      if (cancelled) return;

      const currentScope = currentScopeRef.current;
      const nextScope = resolveScopeForHydration(currentScope, isGroupAdmin, nextAccessibleDbCompanyIds, merged, idMap);
      if (
        nextScope.id !== currentScope.id ||
        (nextScope.id === "company" && currentScope.id === "company" && nextScope.companyId !== currentScope.companyId)
      ) {
        setScopeState(nextScope);
      }

      const hydrationScope = getHydrationScope(nextScope, isGroupAdmin, nextAccessibleDbCompanyIds, idMap);
      await Promise.all([
        hydrateContacts(hydrationScope).catch((e) => console.warn("[hydrateContacts]", e)),
        hydrateFinancials(hydrationScope).catch((e) => console.warn("[hydrateFinancials]", e)),
        hydrateExtras(hydrationScope).catch((e) => console.warn("[hydrateExtras]", e)),
      ]);
      if (cancelled) return;

      if (!isGroupAdmin) restrictLocalStores(merged);
      setDataLoading(false);
      setBootstrapReady(true);
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, isGroupAdmin]);

  const accessibleCompanies = useMemo(() => {
    if (allowedCodes === null) return allCompanies;
    const allowed = new Set(allowedCodes.map((code) => code.toUpperCase()));
    return allCompanies.filter((company) => allowed.has((company.code || company.shortName || "").toUpperCase()));
  }, [allCompanies, allowedCodes]);

  const setScope = (nextScope: Scope) => {
    setScopeState(nextScope);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextScope));
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    if (!bootstrapReady) return;
    if (accessibleCompanies.length === 0) return;

    if (scope.id === "company") {
      const stillOk = accessibleCompanies.some((company) => company.id === scope.companyId);
      if (!stillOk) setScope({ id: "company", companyId: accessibleCompanies[0].id });
    } else if (!isGroupAdmin) {
      setScope({ id: "company", companyId: accessibleCompanies[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapReady, accessibleCompanies, isGroupAdmin]);

  useEffect(() => {
    if (!bootstrapReady) return;
    if (!hasCompletedInitialHydration.current) {
      hasCompletedInitialHydration.current = true;
      return;
    }
    const requestId = ++scopeReloadSeq.current;
    let cancelled = false;

    async function reloadScopeData() {
      setDataLoading(true);
      const hydrationScope = getHydrationScope(scope, isGroupAdmin, accessibleDbCompanyIds, companyIdMapEntries);

      await Promise.all([
        hydrateContacts(hydrationScope).catch((e) => console.warn("[hydrateContacts]", e)),
        hydrateFinancials(hydrationScope).catch((e) => console.warn("[hydrateFinancials]", e)),
        hydrateExtras(hydrationScope).catch((e) => console.warn("[hydrateExtras]", e)),
      ]);

      if (cancelled || requestId !== scopeReloadSeq.current) return;
      setDataLoading(false);
    }

    reloadScopeData();
    return () => {
      cancelled = true;
    };
  }, [bootstrapReady, scope, isGroupAdmin, accessibleDbCompanyIds, companyIdMapEntries]);

  const value = useMemo<Ctx>(() => {
    const scopedCompanies =
      scope.id === "group"
        ? accessibleCompanies
        : accessibleCompanies.filter((company) => company.id === scope.companyId);
    const label =
      scope.id === "group"
        ? "Group Â· All companies"
        : accessibleCompanies.find((company) => company.id === scope.companyId)?.name ?? "â€”";
    const roleFor = (companyId: string): CompanyRole | undefined => {
      if (isGroupAdmin) return "company_admin";
      return roleByCompanyId.get(companyId);
    };
    const hasCompanyRole = (companyId: string, allowed: CompanyRole[]): boolean => {
      if (isGroupAdmin) return true;
      const role = roleByCompanyId.get(companyId);
      return !!role && allowed.includes(role);
    };

    return {
      scope,
      setScope,
      accessibleCompanies,
      scopedCompanies,
      label,
      accessLoading,
      dataLoading,
      bootstrapReady,
      isGroupAdmin,
      roleFor,
      hasCompanyRole,
    };
  }, [scope, accessibleCompanies, accessLoading, dataLoading, bootstrapReady, isGroupAdmin, roleByCompanyId]);

  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

export const useCompany = () => {
  const ctx = useContext(CompanyCtx);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
};

export const inScope = <T extends { companyId: string }>(items: T[], scope: Scope) =>
  scope.id === "group" ? items : items.filter((item) => item.companyId === scope.companyId);
