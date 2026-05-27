import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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
  registerExtraSync, hydrateExtras, pushLocalExtrasSeed,
} from "./db-sync";
// Side-effect import: pcg.ts auto-seeds Logia + Axiom derived data
// (accounts, categories, invoices, transactions, opportunities) into the
// local stores at module load. Importing it here guarantees the stores are
// populated BEFORE pushLocalFinancialSeed() runs below.
import "./pcg";

// Wire financial stores → Supabase once at module load.
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
  /** Companies the current user is allowed to see (already filtered by access). */
  accessibleCompanies: Company[];
  /** Companies further narrowed by the active scope. */
  scopedCompanies: Company[];
  label: string;
  /** True while we are still resolving the user's company access. */
  accessLoading: boolean;
  /** True if user has group-wide access (super_admin / group_admin). */
  isGroupAdmin: boolean;
  /** Role the user holds in a given company (undefined = no access). Group admins implicitly act as company_admin everywhere. */
  roleFor: (companyId: string) => CompanyRole | undefined;
  /** True if the user can act with one of the given roles in that company. */
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

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [scope, setScopeState] = useState<Scope>(loadScope);
  const allCompanies = useCompanies();
  const { user, roles } = useAuth();

  const isGroupAdmin = roles.includes("group_admin") || roles.includes("super_admin");

  const [allowedCodes, setAllowedCodes] = useState<string[] | null>(null);
  const [roleByCompanyId, setRoleByCompanyId] = useState<Map<string, CompanyRole>>(new Map());
  const [accessLoading, setAccessLoading] = useState(true);

  // Hydrate the local companies store from the database so that users on a
  // fresh browser (empty localStorage) still see the companies they have
  // access to. Existing local entries are preserved (matched by code).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*");
      if (cancelled || error || !data) return;
      const existing = companiesStore.items;

      // Dedupe existing items by code, preferring stable seed ids
      // ("log"/"win"/"axi") that the rest of the mock data references.
      const seedIds = new Set(["log", "win", "axi"]);
      const seen = new Map<string, Company>();
      const noCode: Company[] = [];
      for (const c of existing) {
        const key = (c.code || c.shortName || "").toUpperCase();
        if (!key) { noCode.push(c); continue; }
        const prev = seen.get(key);
        if (!prev) seen.set(key, c);
        else if (seedIds.has(c.id) && !seedIds.has(prev.id)) seen.set(key, c);
      }
      const deduped: Company[] = [...seen.values(), ...noCode];

      // Merge DB rows into the local store. Existing entries (matched by
      // code) get their fields refreshed from the DB so updates made in the
      // Companies page show up everywhere; new rows are appended.
      const byCode = new Map(deduped.map((c) => [(c.code || c.shortName || "").toUpperCase(), c]));
      const merged: Company[] = [...deduped];
      let changed = deduped.length !== existing.length;

      const toEntry = (row: Record<string, unknown>, fallbackColorIdx: number): Company => {
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
          logoUrl: (row.logo_url as string) || undefined,
        };
      };

      const idMap: Array<{ localId: string; dbId: string }> = [];
      data.forEach((row, idx) => {
        const code = String((row as { code?: string }).code || "").toUpperCase();
        const entry = toEntry(row as Record<string, unknown>, deduped.length + idx);
        if (!code) {
          merged.push(entry);
          idMap.push({ localId: entry.id, dbId: row.id as string });
          changed = true;
          return;
        }
        const existingEntry = byCode.get(code);
        if (existingEntry) {
          const refreshed: Company = { ...entry, id: existingEntry.id };
          const i = merged.indexOf(existingEntry);
          if (i >= 0 && JSON.stringify(merged[i]) !== JSON.stringify(refreshed)) {
            merged[i] = refreshed;
            changed = true;
          }
          idMap.push({ localId: existingEntry.id, dbId: row.id as string });
        } else {
          merged.push(entry);
          byCode.set(code, entry);
          idMap.push({ localId: entry.id, dbId: row.id as string });
          changed = true;
        }
      });
      if (changed) companiesStore.replaceAll(merged);
      setCompanyIdMap(idMap);
      // Push local mock seed → DB once per user, then hydrate from DB.
      // Bump the suffix below to force a re-push for all users (e.g. when
      // new mock data is added or a previous push ran before the stores
      // were fully seeded).
      const seedFlag = `axel.seedPushed.${user.id}.v3`;
      const finSeedFlag = `axel.finSeedPushed.${user.id}.v3`;
      (async () => {
        try {
          // Always push if DB has no clients yet for this user.
          const { count: clientCount } = await supabase
            .from("clients").select("id", { count: "exact", head: true });
          if (!window.localStorage.getItem(seedFlag) || (clientCount ?? 0) === 0) {
            const res = await pushLocalSeed();
            window.localStorage.setItem(seedFlag, new Date().toISOString());
            console.info("[pushLocalSeed]", res);
          }
        } catch (e) {
          console.warn("[pushLocalSeed]", e);
        }
        try {
          // Always push if DB has no accounts yet (financial tables empty).
          const { count: accCount } = await supabase
            .from("accounts").select("id", { count: "exact", head: true });
          if (!window.localStorage.getItem(finSeedFlag) || (accCount ?? 0) === 0) {
            const res = await pushLocalFinancialSeed();
            window.localStorage.setItem(finSeedFlag, new Date().toISOString());
            console.info("[pushLocalFinancialSeed]", res);
          }
        } catch (e) {
          console.warn("[pushLocalFinancialSeed]", e);
        }
        try {
          const extrasFlag = `axel.extrasSeedPushed.${user.id}.v1`;
          const { count: opCount } = await supabase
            .from("opportunities").select("id", { count: "exact", head: true });
          if (!window.localStorage.getItem(extrasFlag) || (opCount ?? 0) === 0) {
            const res = await pushLocalExtrasSeed();
            window.localStorage.setItem(extrasFlag, new Date().toISOString());
            console.info("[pushLocalExtrasSeed]", res);
          }
        } catch (e) {
          console.warn("[pushLocalExtrasSeed]", e);
        }
        hydrateContacts().catch((e) => console.warn("[hydrateContacts]", e));
        hydrateFinancials().catch((e) => console.warn("[hydrateFinancials]", e));
        hydrateExtras().catch((e) => console.warn("[hydrateExtras]", e));
      })();

    })();
    return () => {
      cancelled = true;
    };
  }, [user]);



  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) {
        setAllowedCodes(null);
        setRoleByCompanyId(new Map());
        setAccessLoading(false);
        return;
      }
      setAccessLoading(true);
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
      for (const r of rows) nextRoles.set(r.company_id, r.role);
      setRoleByCompanyId(nextRoles);
      if (isGroupAdmin) {
        setAllowedCodes(null); // null = all
      } else {
        setAllowedCodes(rows.map((r) => r.companies?.code).filter((c): c is string => !!c));
      }
      setAccessLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, isGroupAdmin]);

  const accessibleCompanies = useMemo(() => {
    if (allowedCodes === null) return allCompanies;
    const set = new Set(allowedCodes.map((c) => c.toUpperCase()));
    return allCompanies.filter((c) => set.has((c.code || c.shortName || "").toUpperCase()));
  }, [allCompanies, allowedCodes]);

  useEffect(() => {
    if (accessLoading || isGroupAdmin || allowedCodes === null) return;
    restrictLocalStores(accessibleCompanies);
  }, [accessLoading, isGroupAdmin, allowedCodes, accessibleCompanies]);

  const setScope = (s: Scope) => {
    setScopeState(s);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        // ignore
      }
    }
  };

  // Auto-correct scope if user lost access to the currently selected company,
  // or if they only have access to a single company.
  useEffect(() => {
    if (accessLoading) return;
    if (accessibleCompanies.length === 0) return;
    if (scope.id === "company") {
      const stillOk = accessibleCompanies.some((c) => c.id === scope.companyId);
      if (!stillOk) {
        setScope({ id: "company", companyId: accessibleCompanies[0].id });
      }
    } else if (!isGroupAdmin) {
      // Non-group users should never see "group" scope. Pin to their first company.
      setScope({ id: "company", companyId: accessibleCompanies[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessLoading, accessibleCompanies, isGroupAdmin]);

  const value = useMemo<Ctx>(() => {
    const scopedCompanies =
      scope.id === "group"
        ? accessibleCompanies
        : accessibleCompanies.filter((c) => c.id === scope.companyId);
    const label =
      scope.id === "group"
        ? "Group · All companies"
        : accessibleCompanies.find((c) => c.id === scope.companyId)?.name ?? "—";
    const roleFor = (companyId: string): CompanyRole | undefined => {
      if (isGroupAdmin) return "company_admin";
      return roleByCompanyId.get(companyId);
    };
    const hasCompanyRole = (companyId: string, allowed: CompanyRole[]): boolean => {
      if (isGroupAdmin) return true;
      const r = roleByCompanyId.get(companyId);
      return !!r && allowed.includes(r);
    };
    return {
      scope, setScope, accessibleCompanies, scopedCompanies, label,
      accessLoading, isGroupAdmin, roleFor, hasCompanyRole,
    };
  }, [scope, accessibleCompanies, accessLoading, isGroupAdmin, roleByCompanyId]);

  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

export const useCompany = () => {
  const ctx = useContext(CompanyCtx);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
};

export const inScope = <T extends { companyId: string }>(items: T[], scope: Scope) =>
  scope.id === "group" ? items : items.filter((i) => i.companyId === scope.companyId);
