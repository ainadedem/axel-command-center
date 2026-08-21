/**
 * Server-side notification fan-out.
 *
 * Resolves who should hear about an event — the people directly involved plus
 * anyone (typically admins) who subscribed to that event for the company —
 * writes their inbox rows and, when they asked for it, emails them.
 *
 * Runs with the service role because one user cannot read another user's
 * notification preferences.
 */
import {
  resolveEventPrefs, resolveWatchRules, EVENT_LABEL,
  resolveEmailModes, resolveQuietHours, isQuiet, quietEndsAt, nextDigestAt,
} from "./notification-events";
import type { FanOutInput } from "./notifications.types";

const isUuid = (v?: string | null) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export async function fanOut(actorId: string, input: FanOutInput) {
  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) return { delivered: 0, emailed: 0 };

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const companyId = isUuid(input.companyId) ? (input.companyId as string) : null;
  const direct = new Set((input.recipients ?? []).filter(isUuid));
  direct.delete(actorId);

  // Everyone who has ever saved preferences is a fan-out candidate.
  const { data: prefRows } = await admin
    .from("notification_prefs")
    .select("user_id, events, watch_company_ids, watch_rules, quiet_hours, digest_modes, time_zone");
  const prefs = new Map<
    string,
    { events: unknown; companies: string[]; rules: unknown; quiet: unknown; modes: unknown; tz: string | null }
  >();
  for (const r of prefRows ?? []) {
    prefs.set(r.user_id as string, {
      events: r.events,
      companies: ((r.watch_company_ids as string[]) ?? []),
      rules: r.watch_rules,
      quiet: (r as Record<string, unknown>)["quiet_hours"],
      modes: (r as Record<string, unknown>)["digest_modes"],
      tz: ((r as Record<string, unknown>)["time_zone"] as string | null) ?? null,
    });
  }


  // Watchers: opted into this event, scope covers this company, and they
  // actually have access to it.
  const watchers = new Set<string>();
  if (companyId) {
    const { data: access } = await admin
      .from("user_company_access")
      .select("user_id")
      .eq("company_id", companyId);
    const accessible = new Set((access ?? []).map((a) => a.user_id as string));
    const { data: platform } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["super_admin", "group_admin"]);
    for (const p of platform ?? []) accessible.add(p.user_id as string);

    for (const [userId, p] of prefs) {
      if (userId === actorId || direct.has(userId)) continue;
      if (!accessible.has(userId)) continue;
      const events = resolveEventPrefs(p.events);
      const channels = events[input.kind];
      if (!channels?.inApp && !channels?.email) continue;
      if (p.companies.length > 0 && !p.companies.includes(companyId)) continue;
      const rules = resolveWatchRules(p.rules);
      if (rules.watchUnassigned === false) continue;
      if (rules.minAmount && (input.amount ?? 0) < rules.minAmount) continue;
      watchers.add(userId);
    }
  }

  const channelsFor = (userId: string) => {
    const stored = prefs.get(userId);
    // Nothing saved yet → sensible defaults from the catalogue.
    return resolveEventPrefs(stored?.events)[input.kind];
  };

  const targets = [...new Set([...direct, ...watchers])].filter((u) => u !== actorId);
  if (targets.length === 0) return { delivered: 0, emailed: 0 };

  const { data: actorProfile } = await admin
    .from("profiles").select("display_name, email").eq("user_id", actorId).maybeSingle();
  const actorName = (actorProfile?.display_name as string) || (actorProfile?.email as string) || "A teammate";

  const inAppTargets = targets.filter((u) => channelsFor(u).inApp);

  /**
   * Email routing per user: `immediate` sends now, `digest` (or an immediate
   * email that lands inside quiet hours) is queued for the next digest run.
   * In-app delivery is never delayed.
   */
  const emailPlan = targets.map((userId) => {
    const stored = prefs.get(userId);
    const channels = resolveEventPrefs(stored?.events);
    const mode = resolveEmailModes(stored?.modes, channels)[input.kind];
    const quiet = resolveQuietHours(stored?.quiet, stored?.tz);
    if (mode === "off") return { userId, action: "none" as const, at: null as Date | null };
    if (mode === "digest") return { userId, action: "queue" as const, at: nextDigestAt(quiet) };
    if (isQuiet(quiet)) return { userId, action: "queue" as const, at: quietEndsAt(quiet) };
    return { userId, action: "send" as const, at: null as Date | null };
  });
  const emailTargets = emailPlan.filter((p) => p.action === "send").map((p) => p.userId);
  const queuedPlan = emailPlan.filter((p) => p.action === "queue");

  let delivered = 0;
  if (inAppTargets.length > 0) {
    const rows = inAppTargets.map((userId) => ({
      user_id: userId,
      company_id: companyId,
      kind: input.kind,
      doc_type: input.docType ?? null,
      doc_id: isUuid(input.docId) ? input.docId : null,
      doc_number: input.docNumber ?? null,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      actor_id: actorId,
      actor_name: actorName,
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (!error) delivered = rows.length;
    else console.warn("[notifications]", error.message);
  }

  let queued = 0;
  if (queuedPlan.length > 0) {
    const rows = queuedPlan.map((p) => ({
      user_id: p.userId,
      company_id: companyId,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      href: input.href ?? null,
      doc_number: input.docNumber ?? null,
      actor_name: actorName,
      scheduled_for: (p.at ?? new Date()).toISOString(),
    }));
    const { error } = await admin.from("notification_email_queue").insert(rows);
    if (!error) queued = rows.length;
    else console.warn("[notifications:queue]", error.message);
  }

  let emailed = 0;
  const resendKey = process.env["RESEND_API_KEY"];
  if (resendKey && emailTargets.length > 0) {
    const { data: people } = await admin
      .from("profiles").select("user_id, email, display_name").in("user_id", emailTargets);
    const appUrl = process.env["PUBLIC_APP_URL"] ?? "https://axel-command-center.lovable.app";
    const link = input.href ? `${appUrl}${input.href}` : appUrl;
    for (const p of people ?? []) {
      const to = p.email as string | null;
      if (!to) continue;
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            from: process.env["AR_ALERT_FROM"] ?? "Axel <onboarding@resend.dev>",
            to: [to],
            subject: `[Axel] ${input.title}`,
            html: `<p><strong>${EVENT_LABEL[input.kind] ?? input.kind}</strong></p>
                   <p>${input.title}</p>
                   ${input.body ? `<p>${input.body}</p>` : ""}
                   <p style="color:#666">By ${actorName}</p>
                   <p><a href="${link}">Open in Axel</a></p>`,
          }),
        });
        if (res.ok) emailed += 1;
      } catch (e) {
        console.warn("[notifications:email]", e);
      }
    }
  }

  return { delivered, emailed, queued };

}
