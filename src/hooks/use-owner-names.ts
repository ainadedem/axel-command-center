import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves user ids (document creators) to readable names.
 * Falls back to the email address, then to an em dash.
 */
export function useOwnerNames(ids: (string | undefined)[]): {
  owners: Record<string, string>;
  ownerName: (id?: string) => string;
} {
  const [owners, setOwners] = useState<Record<string, string>>({});

  const key = useMemo(
    () => Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(","),
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

  return { owners, ownerName: (id?: string) => (id ? owners[id] || "—" : "—") };
}
