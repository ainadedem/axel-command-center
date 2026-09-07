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

interface DirectoryRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
}

/** Turn "jane.doe@axiom.mg" into "Jane Doe" so we never show a raw email. */
function humanizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._\-+\d]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.length ? words.join(" ") : undefined;
}

function toCompanyUser(r: DirectoryRow): CompanyUser {
  const display = r.display_name?.trim();
  return {
    userId: r.user_id,
    name:
      (display && !display.includes("@") ? display : undefined) ??
      humanizeEmail(r.email ?? display) ??
      "Unknown user",
    email: r.email ?? null,
    avatarUrl: r.avatar_url ?? null,
    role: r.role,
  };
}

/**
 * Everyone with access to the given company, resolved through the
 * `company_directory` security-definer function (the `user_company_access`
 * table itself only exposes your own row, which is why a plain select
 * returned an empty list for non-admins).
 */
export function useCompanyUsers(companyId: string | undefined): {
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
      const { data } = await supabase.rpc("company_directory", { _company_id: dbId });
      if (cancelled) return;
      const rows = (data ?? []) as DirectoryRow[];
      setUsers(rows.map(toCompanyUser).sort((a, b) => a.name.localeCompare(b.name)));
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
  const { users: all, loading } = useCompanyUsers(companyId);
  const users = useMemo(() => all.filter((u) => SALES_CAPABLE_ROLES.has(u.role)), [all]);
  const nameOf = useMemo(() => {
    const map = new Map(users.map((u) => [u.userId, u.name]));
    return (userId?: string) => (userId ? map.get(userId) ?? "" : "");
  }, [users]);
  return { users, loading, nameOf };
}
