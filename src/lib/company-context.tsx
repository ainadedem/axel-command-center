import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  useCompanies, companiesStore, accountsStore, categoriesStore, budgetsStore,
  transactionsStore, invoicesStore, opportunitiesStore, quotesStore, purchaseOrdersStore,
  expensesStore, recurringBillingsStore, salaryRegisterStore, payrollRunsStore,
  clientsStore, suppliersStore, projectsStore, teamMembersStore, salesMembersStore,
  quoteFollowupsStore,
  contactCompanyIds, type Company,
} from "./mock-data";
import { useAuth } from "./auth-context";
import { supabase } from "@/integrations/supabase/client";
import {
  setCompanyIdMap, setWritableCompanies, hydrateContacts, pushLocalSeed,
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
  keepCompanyScoped(quoteFollowupsStore, allowedCompanyIds);
  keepCompanyScoped(expensesStore, allowedCompanyIds);
  keepCompanyScoped(recurringBillingsStore, allowedCompanyIds);
  keepCompanyScoped(salaryRegisterStore, allowedCompanyIds);
  keepCompanyScoped(payrollRunsStore, allowedCompanyIds);

  // People are company-scoped, not wiped: a member is kept when they belong to
  // an accessible company or are marked "All companies" (companyId === undefined).
  // Clearing the store here used to leave every company Team page empty.
  const visibleMembers = teamMembersStore.items.filter(
    (m) => m.companyId === undefined || (typeof m.companyId === "string" && allowedCompanyIds.has(m.companyId)),
  );
  if (visibleMembers.length !== teamMembersStore.items.length) teamMembersStore.replaceAll(visibleMembers);

  const visibleMemberIds = new Set(visibleMembers.map((m) => m.id));
  const visibleSales = salesMembersStore.items.filter((s) => visibleMemberIds.has(s.teamMemberId));
  if (visibleSales.length !== salesMembersStore.items.length) salesMembersStore.replaceAll(visibleSales);
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
  /** Set when loading workspace access/data failed; the UI shows a retry instead of a spinner. */
  bootstrapError: string | null;
  retryBootstrap: () => void;
  isGroupAdmin: boolean;
  roleFor: (companyId: string) => CompanyRole | undefined;
  hasCompanyRole: (companyId: string, allowed: CompanyRole[]) => boolean;
  /** Effective role inside the currently selected scope (group admins act as company admin). */
  currentRole: CompanyRole | undefined;

}

export const CompanyCtx = createContext<Ctx | null>(null);

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
    bankAccounts: Array.isArray(row.bank_accounts) ? (row.bank_accounts as Company["bankAccounts"]) : [],

    logoUrl: (row.logo_url as string) || undefined,
    logoHeight: typeof row.logo_height === "number" ? (row.logo_height as number) : undefined,
    logoMaxWidth: typeof row.logo_max_width === "number" ? (row.logo_max_width as number) : undefined,
    logoCrop: (row.logo_crop as Company["logoCrop"]) ?? undefined,
    defaultDocumentLanguage: row.default_document_language === "fr" ? "fr" : row.default_document_language === "en" ? "en" : undefined,
    isDemo: row.is_demo === true,
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

/** A hung backend read must never leave the app on an endless spinner. */
const BOOTSTRAP_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out loading ${label}.`)), ms);
    Promise.resolve(promise).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
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

/** Admin-triggered repair only — never called on sign-in (it used to block the loading screen). */
export async function maybePushSeeds(userId: string, idMap: Array<{ localId: string; dbId: string }>) {
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
  const userId = user?.id ?? null;
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
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const bootstrapDoneRef = useRef(false);
  const retryBootstrap = () => {
    bootstrapKeyRef.current = null;
    bootstrapDoneRef.current = false;
    setBootstrapError(null);
    setRetryCount((n) => n + 1);
  };

  useEffect(() => {
    currentScopeRef.current = scope;
  }, [scope]);

  const bootstrapKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (authLoading) return;
      // Never re-bootstrap for the same identity (e.g. auth re-announced on tab focus):
      // reloading everything would wipe in-progress edits.
      const key = `${userId ?? "anon"}:${isGroupAdmin}`;
      if (bootstrapKeyRef.current === key) return;
      bootstrapKeyRef.current = key;
      // Each run owns this flag: leaving it `true` from a previous run made the
      // cleanup keep the key claimed, so a cancelled run stranded the spinner.
      bootstrapDoneRef.current = false;

      setBootstrapError(null);
      setBootstrapReady(false);
      setAccessLoading(true);
      setDataLoading(true);

      if (!userId) {
        setAllowedCodes(null);
        setAccessibleDbCompanyIds([]);
        setCompanyIdMapEntries([]);
        setRoleByCompanyId(new Map());
        setAccessLoading(false);
        setDataLoading(false);
        setBootstrapReady(true);
        return;
      }

      try {
        const { data, error: accessError } = await withTimeout(
          supabase
            .from("user_company_access")
            .select("company_id, role, companies ( code )")
            .eq("user_id", userId),
          BOOTSTRAP_TIMEOUT_MS,
          "workspace access",
        );
        if (cancelled) return;
        if (accessError) throw accessError;

        const rows = (data ?? []) as Array<{
          company_id: string;
          role: CompanyRole;
          companies: { code: string } | null;
        }>;
        const nextRoles = new Map<string, CompanyRole>();
        for (const row of rows) nextRoles.set(row.company_id, row.role);
        setRoleByCompanyId(nextRoles);
        // Only these roles may write financial data (mirrors the database rules).
        setWritableCompanies(
          isGroupAdmin
            ? null
            : rows
                .filter((row) => row.role === "company_admin" || row.role === "manager" || row.role === "finance")
                .map((row) => row.company_id),
        );

        const accessibleDbCompanyIds = isGroupAdmin ? null : rows.map((row) => row.company_id);
        const nextAccessibleDbCompanyIds = accessibleDbCompanyIds ?? [];
        setAccessibleDbCompanyIds(nextAccessibleDbCompanyIds);
        setAllowedCodes(
          isGroupAdmin
            ? null
            : rows.map((row) => row.companies?.code).filter((code): code is string => !!code),
        );
        setAccessLoading(false);

        // A failing companies read must not strand the app on a spinner: fall back
        // to whatever is already in the local store and carry on.
        let companyRows: Record<string, unknown>[] = [];
        if (isGroupAdmin) {
          const { data: allRows, error } = await supabase.from("companies").select("*");
          if (cancelled) return;
          if (error) console.warn("[bootstrap] companies", error);
          else companyRows = (allRows ?? []) as Record<string, unknown>[];
        } else if ((accessibleDbCompanyIds ?? []).length > 0) {
          const { data: scopedRows, error } = await supabase.from("companies").select("*").in("id", accessibleDbCompanyIds!);
          if (cancelled) return;
          if (error) console.warn("[bootstrap] companies", error);
          else companyRows = (scopedRows ?? []) as Record<string, unknown>[];
        }

        const { merged, idMap } = mergeCompanies(companyRows);
        companiesStore.replaceAll(merged);
        setCompanyIdMap(idMap);
        setCompanyIdMapEntries(idMap);

        if (!isGroupAdmin) restrictLocalStores(merged);

        // No seed push on sign-in: company data already lives in the backend, and a
        // first login on a new browser used to replay the whole local seed here —
        // slow for everyone, rejected by RLS for restricted users, and it blocked
        // the app on the loading screen until it finished.

        const currentScope = currentScopeRef.current;
        const nextScope = resolveScopeForHydration(currentScope, isGroupAdmin, nextAccessibleDbCompanyIds, merged, idMap);
        if (
          nextScope.id !== currentScope.id ||
          (nextScope.id === "company" && currentScope.id === "company" && nextScope.companyId !== currentScope.companyId)
        ) {
          setScopeState(nextScope);
        }

        const hydrationScope = getHydrationScope(nextScope, isGroupAdmin, nextAccessibleDbCompanyIds, idMap);
        await withTimeout(
          Promise.all([
            hydrateContacts(hydrationScope).catch((e) => console.warn("[hydrateContacts]", e)),
            hydrateFinancials(hydrationScope).catch((e) => console.warn("[hydrateFinancials]", e)),
            hydrateExtras(hydrationScope).catch((e) => console.warn("[hydrateExtras]", e)),
          ]),
          BOOTSTRAP_TIMEOUT_MS,
          "your workspace data",
        );
        if (cancelled) return;

        if (!isGroupAdmin) restrictLocalStores(merged);
      } catch (e) {
        console.error("[CompanyProvider bootstrap]", e);
        if (cancelled) return;
        // Release the key so a retry (or a later auth change) can run again.
        bootstrapKeyRef.current = null;
        setBootstrapError(e instanceof Error ? e.message : "Could not load your workspace.");
      } finally {
        if (!cancelled) {
          bootstrapDoneRef.current = true;
          setAccessLoading(false);
          setDataLoading(false);
          setBootstrapReady(true);
        }
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
      // An aborted run must never keep the key claimed, or nothing ever bootstraps.
      bootstrapKeyRef.current = bootstrapDoneRef.current ? bootstrapKeyRef.current : null;
    };
  }, [authLoading, userId, isGroupAdmin, retryCount]);


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
    // `roleByCompanyId` is keyed by the backend company id, while the rest of the
    // app addresses companies by their local id — translate before looking up.
    const dbIdFor = (localId: string) => companyIdMapEntries.find((e) => e.localId === localId)?.dbId;
    const rawRoleFor = (localCompanyId: string): CompanyRole | undefined => {
      const dbId = dbIdFor(localCompanyId);
      return (dbId ? roleByCompanyId.get(dbId) : undefined) ?? roleByCompanyId.get(localCompanyId);
    };
    const roleFor = (companyId: string): CompanyRole | undefined => {
      if (isGroupAdmin) return "company_admin";
      return rawRoleFor(companyId);
    };
    const hasCompanyRole = (companyId: string, allowed: CompanyRole[]): boolean => {
      if (isGroupAdmin) return true;
      const role = rawRoleFor(companyId);
      return !!role && allowed.includes(role);
    };

    // Effective role inside the active scope. In group scope a non group-admin
    // keeps the strongest role they hold across the companies they can see.
    const RANK: CompanyRole[] = ["viewer", "sales", "project_manager", "manager", "finance", "company_admin"];
    let currentRole: CompanyRole | undefined;
    if (isGroupAdmin) currentRole = "company_admin";
    else if (scope.id === "company") currentRole = rawRoleFor(scope.companyId);
    else {
      for (const company of accessibleCompanies) {
        const role = rawRoleFor(company.id);
        if (role && (!currentRole || RANK.indexOf(role) > RANK.indexOf(currentRole))) currentRole = role;
      }
    }

    return {
      scope,
      setScope,
      accessibleCompanies,
      scopedCompanies,
      label,
      accessLoading,
      dataLoading,
      bootstrapReady,
      bootstrapError,
      retryBootstrap,
      isGroupAdmin,
      roleFor,
      hasCompanyRole,
      currentRole,
    };

  }, [scope, accessibleCompanies, accessLoading, dataLoading, bootstrapReady, bootstrapError, isGroupAdmin, roleByCompanyId, companyIdMapEntries]);


  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

export const useCompany = () => {
  const ctx = useContext(CompanyCtx);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
};

export const inScope = <T extends { companyId: string }>(items: T[], scope: Scope) =>
  scope.id === "group" ? items : items.filter((item) => item.companyId === scope.companyId);
