import { useContext } from "react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { CompanyCtx, type CompanyRole } from "@/lib/company-context";

export type EffectiveRole = {
  /** Role that applies in the company currently selected (platform roles win). */
  role: AppRole | null;
  isGroupAdmin: boolean;
  /** Company admin in the active scope, or a platform admin. */
  isAdmin: boolean;
  /** May see money in the active scope. */
  canSeeFinance: boolean;
  /** Sales-scoped: no finance visibility in the active scope. */
  isSalesOnly: boolean;
};

const FINANCE_ROLES: AppRole[] = ["super_admin", "group_admin", "company_admin", "manager", "finance"];

/**
 * Permissions are per company: a user can be sales in one company and finance in
 * another. Everything derives from the role that applies in the selected scope,
 * never from a flattened list of every role the user holds.
 */
export function useEffectiveRole(): EffectiveRole {
  const { roles } = useAuth();
  // The sales gate in the authenticated layout renders outside CompanyProvider,
  // so the company context is read optionally here.
  const company = useContext(CompanyCtx);

  const isGroupAdmin = roles.includes("super_admin") || roles.includes("group_admin");
  if (isGroupAdmin) {
    return {
      role: roles.includes("super_admin") ? "super_admin" : "group_admin",
      isGroupAdmin: true,
      isAdmin: true,
      canSeeFinance: true,
      isSalesOnly: false,
    };
  }

  const scoped: CompanyRole | undefined = company?.currentRole;
  const role = (scoped ?? null) as AppRole | null;
  const canSeeFinance = !!role && FINANCE_ROLES.includes(role);

  return {
    role,
    isGroupAdmin: false,
    isAdmin: role === "company_admin",
    canSeeFinance,
    isSalesOnly: !canSeeFinance,
  };
}
