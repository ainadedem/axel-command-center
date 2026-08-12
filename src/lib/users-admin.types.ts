/** Shared, client-safe types for the user administration flow. */

export type CreateAppUserInput = {
  email: string;
  displayName?: string;
  /** "invite" sends an email link, "password" activates the account immediately. */
  mode: "invite" | "password";
  password?: string;
  platformRole?: "group_admin" | "super_admin" | null;
  companyRoles?: Array<{ companyId: string; role: string }>;
  redirectTo?: string;
};

/** A single check performed by the admin gate, reported verbatim to the caller. */
export type AccessCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "info";
  detail: string;
};

export type AccessDiagnostics = {
  userId: string | null;
  email: string | null;
  roles: string[];
  isSuperAdmin: boolean;
  isGroupAdmin: boolean;
  canCreateUsers: boolean;
  canGrantPlatformRoles: boolean;
  lookupError: string | null;
  checks: AccessCheck[];
  /** One-sentence verdict safe to show in a toast. */
  verdict: string;
};

export type LogRoleChangeInput = {
  action:
    | "assign_platform_role"
    | "assign_company_role"
    | "revoke_company_role"
    | "revoke_platform_role";
  targetUserId: string;
  targetEmail?: string | null;
  companyId?: string | null;
  requestedRole?: string | null;
  success: boolean;
  errorMessage?: string | null;
};

export type AuditRow = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_email: string | null;
  target_user_id: string | null;
  company_id: string | null;
  requested_role: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
};
