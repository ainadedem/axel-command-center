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
    const { supabase, userId } = context;

    // Authorize the caller before touching any privileged client.
    const [{ data: isSuper }, { data: isGroup }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "group_admin" }),
    ]);
    if (!isSuper && !isGroup) throw new Error("Forbidden: administrators only.");
    if (data.platformRole && !isSuper) throw new Error("Only a super admin can grant platform roles.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const meta = data.displayName ? { display_name: data.displayName } : undefined;
    let newUserId: string;

    if (data.mode === "invite") {
      const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
        data: meta,
        redirectTo: data.redirectTo,
      });
      if (error || !invited?.user) throw new Error(error?.message ?? "Could not send the invitation.");
      newUserId = invited.user.id;
    } else {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password!,
        email_confirm: true,
        user_metadata: meta,
      });
      if (error || !created?.user) throw new Error(error?.message ?? "Could not create the account.");
      newUserId = created.user.id;
    }

    try {
      if (data.platformRole) {
        const { error } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: newUserId, role: data.platformRole });
        if (error) throw new Error(error.message);
      }
      if (data.companyRoles && data.companyRoles.length > 0) {
        const { error } = await supabaseAdmin.from("user_company_access").insert(
          data.companyRoles.map((r) => ({ user_id: newUserId, company_id: r.companyId, role: r.role })),
        );
        if (error) throw new Error(error.message);
      }
    } catch (err) {
      // Never leave a half-provisioned account behind.
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => undefined);
      throw err instanceof Error ? err : new Error("Could not assign roles.");
    }

    return { userId: newUserId, email: data.email, invited: data.mode === "invite" };
  });
