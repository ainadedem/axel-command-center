import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

const ALLOWED_COMPANY_ROLES = ["company_admin", "finance", "sales", "viewer"];

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
  details?: Record<string, unknown> | null;
};

/**
 * Audit writes must never mask the operation's own outcome, so failures here are
 * swallowed after being logged server-side.
 */
async function writeAudit(entry: AuditEntry) {
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
      details: entry.details ?? null,
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
async function diagnose(context: {
  supabase: any;
  userId: string | null;
  claims: any;
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

/** Read-only: reports how the server currently sees the caller's admin rights. */
export const checkMyAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => diagnose(context as any));

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateAppUserInput) => {
    const email = (input?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("A valid email is required.");
    if (input.mode === "password" && (input.password ?? "").length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    const companyRoles = (input.companyRoles ?? []).filter((r) => ALLOWED_COMPANY_ROLES.includes(r.role));
    return { ...input, email, companyRoles };
  })
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    const actorEmail: string | null = claims?.email ?? null;

    const diag = await diagnose(context as any);

    const fail = async (message: string) => {
      await writeAudit({
        actorUserId: userId ?? null,
        actorEmail,
        action: "create_user",
        targetEmail: data.email,
        requestedRole: data.platformRole ?? null,
        success: false,
        errorMessage: message,
        details: {
          mode: data.mode,
          companyRoles: data.companyRoles,
          diagnostics: diag.checks,
        },
      });
      throw new Error(message);
    };

    // Report the failing condition precisely instead of a blanket refusal.
    if (diag.lookupError) {
      await fail(`Could not verify your role: ${diag.lookupError}`);
    }
    if (!diag.canCreateUsers) {
      await fail(
        diag.roles.length > 0
          ? `Not allowed: the server sees your platform roles as "${diag.roles.join(", ")}", which does not include super_admin or group_admin.`
          : `Not allowed: the server sees no platform role for ${diag.email ?? "your account"} (user ${diag.userId}). Creating users requires super_admin or group_admin.`,
      );
    }
    if (data.platformRole && !diag.isSuperAdmin) {
      await fail("Not allowed: only a super admin can grant platform roles (your session resolves as group admin).");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const meta = data.displayName ? { display_name: data.displayName } : undefined;
    let newUserId: string;

    if (data.mode === "invite") {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: meta,
        redirectTo: data.redirectTo,
      });
      if (error || !invited?.user) {
        await fail(error?.message ?? "Could not send the invitation.");
      }
      newUserId = invited!.user!.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password!,
        email_confirm: true,
        user_metadata: meta,
      });
      if (error || !created?.user) {
        await fail(error?.message ?? "Could not create the account.");
      }
      newUserId = created!.user!.id;
    }

    try {
      if (data.platformRole) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUserId, role: data.platformRole });
        if (error) throw new Error(error.message);
        await writeAudit({
          actorUserId: userId,
          actorEmail,
          action: "assign_platform_role",
          targetEmail: data.email,
          targetUserId: newUserId,
          requestedRole: data.platformRole,
          success: true,
        });
      }
      if (data.companyRoles && data.companyRoles.length > 0) {
        const { error } = await supabaseAdmin.from("user_company_access").insert(
          data.companyRoles.map((r) => ({ user_id: newUserId, company_id: r.companyId, role: r.role })),
        );
        if (error) throw new Error(error.message);
        for (const r of data.companyRoles) {
          await writeAudit({
            actorUserId: userId,
            actorEmail,
            action: "assign_company_role",
            targetEmail: data.email,
            targetUserId: newUserId,
            companyId: r.companyId,
            requestedRole: r.role,
            success: true,
          });
        }
      }
    } catch (err) {
      // Never leave a half-provisioned account behind.
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => undefined);
      const message = err instanceof Error ? err.message : "Could not assign roles.";
      await writeAudit({
        actorUserId: userId,
        actorEmail,
        action: "create_user",
        targetEmail: data.email,
        targetUserId: newUserId,
        success: false,
        errorMessage: `Roles could not be assigned, account rolled back: ${message}`,
      });
      throw new Error(`Roles could not be assigned, so the account was rolled back: ${message}`);
    }

    await writeAudit({
      actorUserId: userId,
      actorEmail,
      action: "create_user",
      targetEmail: data.email,
      targetUserId: newUserId,
      requestedRole: data.platformRole ?? null,
      success: true,
      details: { mode: data.mode, companyRoles: data.companyRoles },
    });

    return { userId: newUserId, email: data.email, invited: data.mode === "invite" };
  });

export type LogRoleChangeInput = {
  action: "assign_platform_role" | "assign_company_role" | "revoke_company_role" | "revoke_platform_role";
  targetUserId: string;
  targetEmail?: string | null;
  companyId?: string | null;
  requestedRole?: string | null;
  success: boolean;
  errorMessage?: string | null;
};

/**
 * Records a role change performed through the page's inline selects. The actor is
 * taken from the verified session, never from the request body.
 */
export const logRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LogRoleChangeInput) => input)
  .handler(async ({ data, context }) => {
    const { userId, claims } = context as any;
    await writeAudit({
      actorUserId: userId,
      actorEmail: claims?.email ?? null,
      action: data.action,
      targetUserId: data.targetUserId,
      targetEmail: data.targetEmail ?? null,
      companyId: data.companyId ?? null,
      requestedRole: data.requestedRole ?? null,
      success: data.success,
      errorMessage: data.errorMessage ?? null,
    });
    return { ok: true };
  });
