/**
 * Who may break a payment's evidence chain.
 *
 * Unlinking a matched payment changes what the books can prove, so it is
 * restricted to the roles that answer for the money: platform admins, the
 * company admin, and finance — evaluated in the company the invoice belongs
 * to, never globally. A user can be finance in one company and sales in
 * another, and the permission follows the document, not the session.
 */
import { useContext, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { CompanyCtx, type CompanyRole } from "@/lib/company-context";

/** Company-scoped roles allowed to remove a payment link. */
export const UNLINK_ROLES: CompanyRole[] = ["company_admin", "finance"];

export const UNLINK_ROLES_LABEL = "Finance, company administrators and group administrators";

export const UNLINK_DENIED_MESSAGE = (company?: string) =>
  `You do not have permission to unlink payments${company ? ` in ${company}` : ""}. ${UNLINK_ROLES_LABEL} can do this.`;

export interface UnlinkPermission {
  /** True when the signed-in user may unlink payments in that company. */
  can: (companyId?: string) => boolean;
  /** True for at least one accessible company — used to hide dead controls. */
  canAny: boolean;
  /** Readable company name, for the denial message. */
  companyName: (companyId?: string) => string | undefined;
}

export function useUnlinkPermission(): UnlinkPermission {
  const { roles } = useAuth();
  const company = useContext(CompanyCtx);
  const isPlatformAdmin = roles.includes("super_admin") || roles.includes("group_admin");

  const can = useCallback(
    (companyId?: string) => {
      if (isPlatformAdmin) return true;
      if (!companyId) return false;
      return company?.hasCompanyRole(companyId, UNLINK_ROLES) ?? false;
    },
    [isPlatformAdmin, company],
  );

  const companyName = useCallback(
    (companyId?: string) =>
      companyId ? company?.accessibleCompanies.find((c) => c.id === companyId)?.name : undefined,
    [company],
  );

  const canAny =
    isPlatformAdmin ||
    !!company?.accessibleCompanies.some((c) => company.hasCompanyRole(c.id, UNLINK_ROLES));

  return { can, canAny, companyName };
}
