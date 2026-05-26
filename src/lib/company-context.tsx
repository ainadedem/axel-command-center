import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useCompanies, type Company } from "./mock-data";
import { useAuth } from "./auth-context";
import { supabase } from "@/integrations/supabase/client";

type Scope = { id: "group" } | { id: "company"; companyId: string };

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

  const isGroupAdmin = roles.includes("group_admin" as never) || (roles as string[]).includes("super_admin");

  const [allowedCodes, setAllowedCodes] = useState<string[] | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setAllowedCodes(null);
        setAccessLoading(false);
        return;
      }
      if (isGroupAdmin) {
        setAllowedCodes(null); // null = all
        setAccessLoading(false);
        return;
      }
      setAccessLoading(true);
      const { data } = await supabase
        .from("user_company_access")
        .select("companies ( code )")
        .eq("user_id", user.id);
      if (cancelled) return;
      const codes = ((data ?? []) as Array<{ companies: { code: string } | null }>)
        .map((r) => r.companies?.code)
        .filter((c): c is string => !!c);
      setAllowedCodes(codes);
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
    return { scope, setScope, accessibleCompanies, scopedCompanies, label, accessLoading, isGroupAdmin };
  }, [scope, accessibleCompanies, accessLoading, isGroupAdmin]);

  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

export const useCompany = () => {
  const ctx = useContext(CompanyCtx);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
};

export const inScope = <T extends { companyId: string }>(items: T[], scope: Scope) =>
  scope.id === "group" ? items : items.filter((i) => i.companyId === scope.companyId);
