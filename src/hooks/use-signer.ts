import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SignerProfile {
  name?: string;
  signatureRef?: string;
}

const cache = new Map<string, SignerProfile>();

/**
 * Resolves the display name and stored signature reference of the user who
 * last touched a document, so both can be printed in its signature block.
 */
export function useSigner(userId?: string | null): SignerProfile {
  const [signer, setSigner] = useState<SignerProfile>(() => (userId ? cache.get(userId) ?? {} : {}));

  useEffect(() => {
    let active = true;
    if (!userId) { setSigner({}); return; }
    const cached = cache.get(userId);
    if (cached) { setSigner(cached); return; }
    supabase
      .from("profiles")
      .select("display_name, signature_url")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const next: SignerProfile = {
          name: data?.display_name ?? undefined,
          signatureRef: data?.signature_url ?? undefined,
        };
        cache.set(userId, next);
        if (active) setSigner(next);
      });
    return () => { active = false; };
  }, [userId]);

  return signer;
}
