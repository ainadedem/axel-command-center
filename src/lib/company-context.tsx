import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useCompanies, type Company } from "./mock-data";

type Scope = { id: "group" } | { id: "company"; companyId: string };

interface Ctx {
  scope: Scope;
  setScope: (s: Scope) => void;
  scopedCompanies: Company[];
  label: string;
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
  const companies = useCompanies();

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

  const value = useMemo<Ctx>(() => {
    const scopedCompanies =
      scope.id === "group" ? companies : companies.filter((c) => c.id === scope.companyId);
    const label =
      scope.id === "group" ? "Group · All companies" : companies.find((c) => c.id === scope.companyId)?.name ?? "—";
    return { scope, setScope, scopedCompanies, label };
  }, [scope, companies]);

  return <CompanyCtx.Provider value={value}>{children}</CompanyCtx.Provider>;
}

export const useCompany = () => {
  const ctx = useContext(CompanyCtx);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
};

export const inScope = <T extends { companyId: string }>(items: T[], scope: Scope) =>
  scope.id === "group" ? items : items.filter((i) => i.companyId === scope.companyId);
