/**
 * Notification digest / quiet-hours flush.
 *
 * Sends every queued notification email whose scheduled time has passed, one
 * grouped message per user, then marks the queue rows as sent. Runs hourly
 * from pg_cron with the same server-only secret as the AR alert job.
 */
import { createFileRoute } from "@tanstack/react-router";
import { EVENT_LABEL, groupOfKind, EVENT_GROUPS } from "@/lib/notification-events";

interface QueueRow {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  doc_number: string | null;
  actor_name: string | null;
  created_at: string;
}

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function handle() {
  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) return Response.json({ error: "backend_not_configured" }, { status: 500 });

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await admin
    .from("notification_email_queue")
    .select("id, user_id, kind, title, body, href, doc_number, actor_name, created_at")
    .is("sent_at", null)
    .lte("scheduled_for", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as QueueRow[];
  if (rows.length === 0) return Response.json({ users: 0, events: 0, sent: 0 });

  const byUser = new Map<string, QueueRow[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  const { data: people } = await admin
    .from("profiles")
    .select("user_id, email, display_name")
    .in("user_id", [...byUser.keys()]);
  const emailOf = new Map(
    (people ?? []).map((p) => [p.user_id as string, (p.email as string | null) ?? null]),
  );

  const resendKey = process.env["RESEND_API_KEY"];
  const appUrl = process.env["PUBLIC_APP_URL"] ?? "https://axel-command-center.lovable.app";
  const from = process.env["AR_ALERT_FROM"] ?? "Axel <onboarding@resend.dev>";

  let sent = 0;
  const settled: string[] = [];

  for (const [userId, items] of byUser) {
    const to = emailOf.get(userId);
    // No address or no mail provider → drop the backlog rather than replaying it.
    if (!to || !resendKey) { settled.push(...items.map((i) => i.id)); continue; }

    const sections = EVENT_GROUPS.map((g) => {
      const list = items.filter((i) => groupOfKind(i.kind) === g.key);
      if (list.length === 0) return "";
      const li = list
        .map((i) => {
          const link = i.href ? `${appUrl}${i.href}` : appUrl;
          const meta = [i.actor_name, new Date(i.created_at).toUTCString()].filter(Boolean).join(" · ");
          return `<li style="margin:6px 0">
            <a href="${link}" style="color:#0B57D1;text-decoration:none"><strong>${escape(i.title)}</strong></a>
            ${i.doc_number ? ` <span style="color:#666">${escape(i.doc_number)}</span>` : ""}
            ${i.body ? `<div style="color:#444">${escape(i.body)}</div>` : ""}
            <div style="color:#888;font-size:12px">${escape(meta)} · ${escape(EVENT_LABEL[i.kind] ?? i.kind)}</div>
          </li>`;
        })
        .join("");
      return `<h3 style="margin:18px 0 4px;font-size:14px">${g.label} (${list.length})</h3><ul style="padding-left:18px;margin:0">${li}</ul>`;
    }).join("");

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `[Axel] Your digest — ${items.length} update${items.length > 1 ? "s" : ""}`,
          html: `<div style="font-family:system-ui,Arial,sans-serif">
                   <h2 style="font-size:16px">Axel digest</h2>
                   <p style="color:#666">${items.length} update${items.length > 1 ? "s" : ""} while you were away.</p>
                   ${sections}
                   <p style="margin-top:20px"><a href="${appUrl}" style="color:#0B57D1">Open Axel</a></p>
                 </div>`,
        }),
      });
      if (res.ok) sent += 1;
      settled.push(...items.map((i) => i.id));
    } catch (e) {
      console.warn("[notification-digest]", e);
    }
  }

  if (settled.length > 0) {
    await admin
      .from("notification_email_queue")
      .update({ sent_at: new Date().toISOString() })
      .in("id", settled);
  }

  return Response.json({ users: byUser.size, events: rows.length, sent });
}

function authorize(request: Request): Response | null {
  const expected = process.env["AR_ALERT_CRON_SECRET"];
  if (!expected) return new Response("Unauthorized", { status: 401 });
  const provided =
    request.headers.get("x-cron-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided || provided !== expected) return new Response("Unauthorized", { status: 401 });
  return null;
}

export const Route = createFileRoute("/api/public/hooks/notification-digest")({
  server: {
    handlers: {
      POST: async ({ request }) => authorize(request) ?? handle(),
      GET: async ({ request }) => authorize(request) ?? handle(),
    },
  },
});
