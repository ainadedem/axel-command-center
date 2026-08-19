import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SignerProfile {
  name?: string;
  signatureRef?: string;
}

const cache = new Map<string, SignerProfile>();

/** Turn "jane.doe@axiom.mg" into "Jane Doe" so documents never print an email. */
function humanizeEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  const local = email.split("@")[0] ?? "";
  const words = local
    .split(/[._\-+\d]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  return words.length ? words.join(" ") : undefined;
}

/**
 * Resolves the full display name and stored signature reference of the user who
 * signs a document. Name resolution order: profile display name → team member
 * full name → humanized email local part. A raw email is never returned.
 */
export function useSigner(userId?: string | null): SignerProfile {
  const [signer, setSigner] = useState<SignerProfile>(() => (userId ? cache.get(userId) ?? {} : {}));

  useEffect(() => {
    let active = true;
    if (!userId) { setSigner({}); return; }
    const cached = cache.get(userId);
    if (cached) { setSigner(cached); return; }

    (async () => {
      const [{ data: prof }, { data: member }] = await Promise.all([
        supabase.from("profiles").select("display_name, email, signature_url").eq("user_id", userId).maybeSingle(),
        supabase.from("team_members").select("name, first_name, last_name").eq("user_id", userId).maybeSingle(),
      ]);
      const memberName =
        [member?.first_name, member?.last_name].filter(Boolean).join(" ").trim() || member?.name?.trim() || undefined;
      const profileName = prof?.display_name?.trim();
      const name =
        (profileName && !profileName.includes("@") ? profileName : undefined) ??
        memberName ??
        humanizeEmail(prof?.email ?? profileName);
      const next: SignerProfile = { name, signatureRef: prof?.signature_url ?? undefined };
      cache.set(userId, next);
      if (active) setSigner(next);
    })();

    return () => { active = false; };
  }, [userId]);

  return signer;
}
