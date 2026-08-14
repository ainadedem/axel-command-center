import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dbCompanyId } from "@/lib/db-sync";

export interface CompanyUser {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: string;
}

/** Company roles that are allowed to own and follow up on a quotation. */
const SALES_CAPABLE_ROLES = new Set([
  "sales",
  "company_admin",
  "manager",
  "project_manager",
]);

/**
 * Users who can log in AND have sales-capable access to the given company.
 * Used to pick quotation assignees — assignees must be real accounts so they
 * can actually see and follow up on the quote.
 */
export function useCompanySalesUsers(companyId: string | undefined): {
  users: CompanyUser[];
  loading: boolean;
  nameOf: (userId?: string) => string;
} {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);

  const dbId = companyId ? dbCompanyId(companyId) : undefined;

  useEffect(() => {
    if (!dbId) { setUsers([]); return; }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data: access } = await supabase
        .from("user_company_access")
        .select("user_id, role")
        .eq("company_id", dbId);
      const rows = ((access ?? []) as { user_id: string; role: string }[])
        .filter((r) => SALES_CAPABLE_ROLES.has(r.role));
      if (rows.length === 0) {
        if (!cancelled) { setUsers([]); setLoading(false); }
        return;
      }
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", rows.map((r) => r.user_id));
      if (cancelled) return;
      const byId = new Map(
        ((profs ?? []) as { user_id: string; display_name: string | null; email: string | null; avatar_url: string | null }[])
          .map((p) => [p.user_id, p]),
      );
      setUsers(
        rows.map((r) => {
          const p = byId.get(r.user_id);
          return {
            userId: r.user_id,
            name: p?.display_name || p?.email || "Unknown user",
            email: p?.email ?? null,
            avatarUrl: p?.avatar_url ?? null,
            role: r.role,
          };
        }).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dbId]);

  const nameOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.userId, u.name]));
    return (userId?: string) => (userId ? map.get(userId) ?? "" : "");
  }, [users]);

  return { users, loading, nameOf };
}
