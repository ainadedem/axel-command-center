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

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<Scope>({ id: "group" });
  const companies = useCompanies();

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
