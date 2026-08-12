import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CreateAppUserInput, LogRoleChangeInput } from "./users-admin.types";

export type { CreateAppUserInput, LogRoleChangeInput };

const ALLOWED_COMPANY_ROLES = ["company_admin", "finance", "sales", "viewer"];

/** Read-only: reports how the server currently sees the caller's admin rights. */
export const checkMyAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { diagnose } = await import("./users-admin.server");
    return diagnose(context as any);
  });

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
    const { diagnose, writeAudit } = await import("./users-admin.server");
    const { userId, claims } = context as any;
    const actorEmail: string | null = claims?.email ?? null;

    const diag = await diagnose(context as any);

    const fail = async (message: string): Promise<never> => {
      await writeAudit({
        actorUserId: userId ?? null,
        actorEmail,
        action: "create_user",
        targetEmail: data.email,
        requestedRole: data.platformRole ?? null,
        success: false,
        errorMessage: message,
        details: { mode: data.mode, companyRoles: data.companyRoles, diagnostics: diag.checks },
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
      await fail(
        "Not allowed: only a super admin can grant platform roles (your session resolves as group admin).",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const meta = data.displayName ? { display_name: data.displayName } : undefined;
    let newUserId: string;

    if (data.mode === "invite") {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: meta,
        redirectTo: data.redirectTo,
      });
      if (error || !invited?.user) await fail(error?.message ?? "Could not send the invitation.");
      newUserId = invited!.user!.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password!,
        email_confirm: true,
        user_metadata: meta,
      });
      if (error || !created?.user) await fail(error?.message ?? "Could not create the account.");
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

/**
 * Records a role change performed through the page's inline selects. The actor is
 * taken from the verified session, never from the request body.
 */
export const logRoleChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LogRoleChangeInput) => input)
  .handler(async ({ data, context }) => {
    const { writeAudit } = await import("./users-admin.server");
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
