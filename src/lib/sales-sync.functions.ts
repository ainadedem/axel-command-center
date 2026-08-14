import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Keeps the Sales team page in sync with who actually holds the "sales" company
 * role. Runs as an idempotent reconciliation: link/create team profiles by
 * email, add missing sales rows, drop auto-added rows whose role went away.
 */
export const syncSalesTeamFromRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as {
      supabase: { rpc: (fn: string, args: unknown) => Promise<{ data: unknown }> };
      userId: string | null;
    };
    if (!userId) return { skipped: true as const, reason: "no-session" };

    const isAdmin = await (async () => {
      for (const role of ["super_admin", "group_admin", "company_admin"]) {
        const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: role });
        if (data === true) return true;
      }
      return false;
    })();
    if (!isAdmin) return { skipped: true as const, reason: "not-admin" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: accessRows }, { data: profileRows }, { data: teamRows }, { data: salesRows }] =
      await Promise.all([
        supabaseAdmin.from("user_company_access").select("user_id, company_id, role").eq("role", "sales"),
        supabaseAdmin.from("profiles").select("user_id, display_name, email, avatar_url"),
        supabaseAdmin.from("team_members").select("id, name, email, user_id, company_id, is_global"),
        supabaseAdmin.from("sales_members").select("id, team_member_id, role, source"),
      ]);

    const access = accessRows ?? [];
    const profiles = new Map((profileRows ?? []).map((p) => [p.user_id, p]));
    const team = teamRows ?? [];
    const sales = salesRows ?? [];

    // sales-role users → the companies they hold it in
    const companiesByUser = new Map<string, string[]>();
    for (const a of access) {
      const list = companiesByUser.get(a.user_id) ?? [];
      if (a.company_id) list.push(a.company_id);
      companiesByUser.set(a.user_id, list);
    }

    const byUserId = new Map(team.filter((t) => t.user_id).map((t) => [t.user_id as string, t]));
    const byEmail = new Map(
      team.filter((t) => t.email).map((t) => [(t.email as string).trim().toLowerCase(), t]),
    );

    const linkedTeamIds: string[] = [];
    let created = 0;
    let linked = 0;

    for (const [uid, companyIds] of companiesByUser) {
      const profile = profiles.get(uid);
      const email = (profile?.email ?? "").trim().toLowerCase();
      let member = byUserId.get(uid) ?? (email ? byEmail.get(email) : undefined);

      if (member && !member.user_id) {
        await supabaseAdmin.from("team_members").update({ user_id: uid }).eq("id", member.id);
        linked += 1;
      }

      if (!member) {
        const name = profile?.display_name || profile?.email || "New sales user";
        const single = companyIds.length === 1 ? companyIds[0] : null;
        const { data: inserted } = await supabaseAdmin
          .from("team_members")
          .insert({
            name,
            first_name: name.split(" ")[0] ?? name,
            last_name: name.split(" ").slice(1).join(" ") || null,
            email: profile?.email ?? null,
            avatar_url: profile?.avatar_url ?? null,
            job_title: "Sales",
            company_id: single,
            is_global: companyIds.length !== 1,
            user_id: uid,
          })
          .select("id")
          .single();
        if (!inserted) continue;
        member = { ...inserted, user_id: uid } as (typeof team)[number];
        created += 1;
      }

      linkedTeamIds.push(member.id);
      if (!sales.some((s) => s.team_member_id === member!.id)) {
        await supabaseAdmin
          .from("sales_members")
          .insert({ team_member_id: member.id, role: "acquisition", source: "role_sync" });
      }
    }

    // Auto-added entries whose user no longer holds the sales role.
    const stale = sales
      .filter((s) => s.source === "role_sync" && !linkedTeamIds.includes(s.team_member_id))
      .map((s) => s.id);
    if (stale.length > 0) await supabaseAdmin.from("sales_members").delete().in("id", stale);

    return { skipped: false as const, created, linked, removed: stale.length };
  });
