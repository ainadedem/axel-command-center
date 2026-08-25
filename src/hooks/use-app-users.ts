import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dbCompanyId } from "@/lib/db-sync";

export interface AppUserOption {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  companyIds: string[];
}

/**
 * All app users the current session can see, optionally narrowed to one company.
 * Used to link a team member record to a real login account.
 */
export function useAppUsers(companyId?: string): { users: AppUserOption[]; loading: boolean } {
  const [users, setUsers] = useState<AppUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const dbId = companyId ? dbCompanyId(companyId) : undefined;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      let q = supabase.from("user_company_access").select("user_id, company_id");
      if (dbId) q = q.eq("company_id", dbId);
      const { data: access } = await q;
      const rows = (access ?? []) as { user_id: string; company_id: string }[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) {
        if (!cancelled) { setUsers([]); setLoading(false); }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", ids);
      if (cancelled) return;
      const byUser = new Map<string, string[]>();
      for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.company_id]);
      const list = ((profs ?? []) as { user_id: string; display_name: string | null; email: string | null; avatar_url: string | null }[])
        .map((p) => ({
          userId: p.user_id,
          name: p.display_name || p.email || "Unknown user",
          email: p.email ?? null,
          avatarUrl: p.avatar_url ?? null,
          companyIds: byUser.get(p.user_id) ?? [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setUsers(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dbId]);

  return useMemo(() => ({ users, loading }), [users, loading]);
}
