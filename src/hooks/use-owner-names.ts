import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { firstName } from "@/lib/person-name";

/**
 * Resolves user ids (document creators) to readable names.
 * Falls back to the email address, then to an em dash.
 */
export function useOwnerNames(ids: (string | undefined)[]): {
  owners: Record<string, string>;
  ownerName: (id?: string) => string;
  /** First name only — for dense tables and boards. */
  ownerFirstName: (id?: string) => string;
} {
  const [owners, setOwners] = useState<Record<string, string>>({});

  // Only real uuids may be sent to PostgREST — a sentinel like "unassigned"
  // makes the whole `.in()` query fail with a cast error and wipes every name.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const key = useMemo(
    () => Array.from(new Set((ids.filter(Boolean) as string[]).filter((id) => UUID_RE.test(id)))).sort().join(","),
    [ids],
  );

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (list.length === 0) { setOwners({}); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("user_id, display_name, email")
      .in("user_id", list)
      .then(({ data }) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        for (const p of (data ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
          map[p.user_id] = p.display_name || p.email || "";
        }
        setOwners(map);
      });
    return () => { cancelled = true; };
  }, [key]);

  const ownerName = (id?: string) => (id ? owners[id] || "—" : "—");
  return { owners, ownerName, ownerFirstName: (id?: string) => firstName(id ? owners[id] : "", "—") };
}
