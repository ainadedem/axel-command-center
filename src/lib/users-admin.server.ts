import type { AccessCheck, AccessDiagnostics } from "./users-admin.types";

type AuditEntry = {
  actorUserId: string | null;
  actorEmail?: string | null;
  action: string;
  targetEmail?: string | null;
  targetUserId?: string | null;
  companyId?: string | null;
  requestedRole?: string | null;
  success: boolean;
  errorMessage?: string | null;
  details?: unknown;
};

/**
 * Audit writes must never mask the operation's own outcome, so failures here are
 * swallowed after being logged server-side.
 */
export async function writeAudit(entry: AuditEntry) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_admin_audit").insert({
      actor_user_id: entry.actorUserId,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      target_email: entry.targetEmail ?? null,
      target_user_id: entry.targetUserId ?? null,
      company_id: entry.companyId ?? null,
      requested_role: entry.requestedRole ?? null,
      success: entry.success,
      error_message: entry.errorMessage ?? null,
      details: (entry.details ?? null) as never,
    });
  } catch (err) {
    console.error("[user-admin-audit] could not record entry", err);
  }
}

/**
 * Resolves the caller's platform role exactly the way the create gate does, and
 * reports each step so a refusal can be explained instead of guessed at.
 * Only the caller's own facts are exposed — no keys, no other users' data.
 */
export async function diagnose(context: {
  supabase: any;
  userId: string | null;
  claims?: any;
}): Promise<AccessDiagnostics> {
  const { supabase, userId, claims } = context;
  const email: string | null = claims?.email ?? null;
  const checks: AccessCheck[] = [];

  checks.push({
    id: "bearer",
    label: "Bearer token reached the server",
    status: userId ? "pass" : "fail",
    detail: userId ? "Authenticated request" : "No user id on the request — sign out and back in.",
  });
  checks.push({
    id: "identity",
    label: "Server sees you as",
    status: userId ? "info" : "fail",
    detail: email ?? userId ?? "unknown",
  });

  if (!userId) {
    return {
      userId: null,
      email,
      roles: [],
      isSuperAdmin: false,
      isGroupAdmin: false,
      canCreateUsers: false,
      canGrantPlatformRoles: false,
      lookupError: "No authenticated session reached the server.",
      checks,
      verdict: "Your session did not reach the server — sign out and sign in again.",
    };
  }

  const [superRes, groupRes, rowsRes] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "group_admin" }),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const lookupError: string | null = superRes.error?.message ?? groupRes.error?.message ?? null;
  checks.push({
    id: "has_role",
    label: "Role check function is callable",
    status: lookupError ? "fail" : "pass",
    detail: lookupError ?? "public.has_role executed successfully",
  });

  const roles: string[] = ((rowsRes.data ?? []) as Array<{ role: string }>).map((r) => r.role);
  checks.push({
    id: "role_rows",
    label: "Platform role rows readable",
    status: rowsRes.error ? "fail" : "info",
    detail: rowsRes.error
      ? rowsRes.error.message
      : roles.length > 0
        ? roles.join(", ")
        : "no platform role row for your account",
  });

  const isSuperAdmin = superRes.data === true;
  const isGroupAdmin = groupRes.data === true;
  checks.push({
    id: "super_admin",
    label: "super_admin resolves",
    status: isSuperAdmin ? "pass" : "fail",
    detail: isSuperAdmin ? "yes" : "no",
  });
  checks.push({
    id: "group_admin",
    label: "group_admin resolves",
    status: isGroupAdmin ? "pass" : "fail",
    detail: isGroupAdmin ? "yes" : "no",
  });

  const canCreateUsers = isSuperAdmin || isGroupAdmin;
  checks.push({
    id: "create_users",
    label: "Allowed to create users",
    status: canCreateUsers ? "pass" : "fail",
    detail: canCreateUsers ? "yes" : "requires super_admin or group_admin",
  });
  checks.push({
    id: "grant_platform",
    label: "Allowed to grant platform roles",
    status: isSuperAdmin ? "pass" : "fail",
    detail: isSuperAdmin ? "yes" : "super_admin only",
  });

  const verdict = lookupError
    ? `Your role could not be verified: ${lookupError}`
    : isSuperAdmin
      ? "Your session is recognised as super administrator."
      : isGroupAdmin
        ? "Your session is recognised as group administrator (not super administrator)."
        : roles.length > 0
          ? `The server sees your platform roles as: ${roles.join(", ")} — no administrator role.`
          : "The server sees no platform role on your account.";

  return {
    userId,
    email,
    roles,
    isSuperAdmin,
    isGroupAdmin,
    canCreateUsers,
    canGrantPlatformRoles: isSuperAdmin,
    lookupError,
    checks,
    verdict,
  };
}
