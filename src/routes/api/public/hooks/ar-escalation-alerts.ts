/**
 * Nightly AR escalation alerts.
 *
 * Scans open invoices, works out which rung of the SOP-OPS-FIN-002 ladder
 * each one has crossed, and emails the finance / company administrators of
 * the owning company once per invoice-stage (deduplicated via ar_alert_log).
 *
 * Called by pg_cron with the project anon key in the `apikey` header.
 */
import { createFileRoute } from "@tanstack/react-router";

const STAGES = [15, 30, 45, 60] as const;

const STAGE_ACTIONS: Record<number, string> = {
  15: "Courtesy confirmation — confirm the invoice is booked and scheduled.",
  30: "Written follow-up to the client finance contact, copying the project sponsor.",
  45: "Formal reminder with the completion certificate and handover proof attached.",
  60: "Executive escalation — suspend new work pending settlement.",
};

const daysBetween = (from: string, to: Date) =>
  Math.floor((to.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);

const money = (n: number, ccy: string) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n)} ${ccy}`;

async function handle() {
  const url = process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceKey) return Response.json({ error: "backend_not_configured" }, { status: 500 });

  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const today = new Date();
  const appUrl = process.env["PUBLIC_APP_URL"] ?? "https://axel-command-center.lovable.app";
  const resendKey = process.env["RESEND_API_KEY"];

  const { data: invoices, error } = await admin
    .from("invoices")
    .select("id, company_id, client_id, number, amount, paid, total_amount, tax_amount, currency, status, issue_date, ingestion_date, handover_proof_url, po_id, po_waived")
    .not("status", "in", "(draft,cancelled,paid)");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const payable = (i: { amount: unknown; tax_amount?: unknown; total_amount?: unknown }) =>
    Number(i.total_amount) > 0 ? Number(i.total_amount) : Number(i.amount) + (Number(i.tax_amount) || 0);
  const open = (invoices ?? []).filter((i) => payable(i) - Number(i.paid) > 0.5);
  if (open.length === 0) return Response.json({ scanned: 0, sent: 0 });

  const { data: logged } = await admin.from("ar_alert_log").select("invoice_id, stage");
  const already = new Set((logged ?? []).map((r) => `${r.invoice_id}:${r.stage}`));

  const due: Array<{ inv: (typeof open)[number]; stage: number; days: number }> = [];
  for (const inv of open) {
    const start = (inv.ingestion_date as string | null) ?? (inv.issue_date as string);
    if (!start) continue;
    const days = daysBetween(start, today);
    let stage = 0;
    for (const s of STAGES) if (days >= s) stage = s;
    if (stage === 0) continue;
    if (already.has(`${inv.id}:${stage}`)) continue;
    due.push({ inv, stage, days });
  }
  if (due.length === 0) return Response.json({ scanned: open.length, sent: 0 });

  const companyIds = [...new Set(due.map((d) => d.inv.company_id as string))];
  const clientIds = [...new Set(due.map((d) => d.inv.client_id as string).filter(Boolean))];

  const [{ data: access }, { data: companies }, { data: clients }] = await Promise.all([
    admin.from("user_company_access").select("user_id, company_id, role").in("company_id", companyIds),
    admin.from("companies").select("id, name").in("id", companyIds),
    clientIds.length
      ? admin.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
  ]);

  const finance = (access ?? []).filter((a) =>
    ["company_admin", "finance", "manager"].includes(a.role as string),
  );
  const userIds = [...new Set(finance.map((a) => a.user_id as string))];
  const [{ data: profiles }, { data: prefs }] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("user_id, email, display_name").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; email: string | null; display_name: string | null }> }),
    userIds.length
      ? admin.from("notification_prefs").select("user_id, ar_alerts_enabled, stages").in("user_id", userIds)
      : Promise.resolve({ data: [] as Array<{ user_id: string; ar_alerts_enabled: boolean; stages: number[] }> }),
  ]);

  const emailByUser = new Map((profiles ?? []).map((p) => [p.user_id as string, p.email as string | null]));
  const prefByUser = new Map((prefs ?? []).map((p) => [p.user_id as string, p]));
  const companyName = new Map((companies ?? []).map((c) => [c.id as string, c.name as string]));
  const clientName = new Map((clients ?? []).map((c) => [c.id as string, c.name as string]));

  let sent = 0;
  for (const { inv, stage, days } of due) {
    const recipients = finance
      .filter((a) => a.company_id === inv.company_id)
      .filter((a) => {
        const p = prefByUser.get(a.user_id as string);
        if (!p) return true; // default on
        return p.ar_alerts_enabled && (p.stages ?? STAGES).includes(stage);
      })
      .map((a) => emailByUser.get(a.user_id as string))
      .filter((e): e is string => !!e);

    const balance = payable(inv) - Number(inv.paid);
    const gaps: string[] = [];
    if (!inv.po_id && !inv.po_waived) gaps.push("no client purchase order recorded");
    if (!inv.handover_proof_url) gaps.push("no stamped handover proof archived");
    if (!inv.ingestion_date) gaps.push("client ingestion date not recorded");

    let errorMessage: string | null = null;
    if (recipients.length === 0) {
      errorMessage = "no_recipients";
    } else if (!resendKey) {
      errorMessage = "email_not_configured";
    } else {
      const subject = `Day ${stage} — invoice ${inv.number} is ${days} days outstanding`;
      const html = `
        <p><strong>${companyName.get(inv.company_id as string) ?? "Company"}</strong> — invoice <strong>${inv.number}</strong>
        to ${clientName.get(inv.client_id as string) ?? "the client"} has reached <strong>day ${stage}</strong>
        of the receivables ladder.</p>
        <ul>
          <li>Outstanding balance: <strong>${money(balance, inv.currency as string)}</strong></li>
          <li>Days outstanding: <strong>${days}</strong></li>
          <li>Required action: ${STAGE_ACTIONS[stage]}</li>
          ${gaps.length ? `<li>Documentation gaps: ${gaps.join(", ")}</li>` : ""}
        </ul>
        <p><a href="${appUrl}/sops">Open the escalation ladder in Axel</a></p>
      `;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: process.env["AR_ALERT_FROM"] ?? "Axel <onboarding@resend.dev>",
          to: recipients,
          subject,
          html,
        }),
      });
      if (!res.ok) errorMessage = `send_failed_${res.status}`;
      else sent += 1;
    }

    await admin.from("ar_alert_log").insert({
      company_id: inv.company_id,
      invoice_id: inv.id,
      stage,
      recipients,
      error_message: errorMessage,
    });
  }

  return Response.json({ scanned: open.length, due: due.length, sent });
}

/**
 * Authorises the scheduler. The Supabase anon/publishable key ships in every
 * browser bundle, so it can never gate this job: we require a server-only
 * secret (`AR_ALERT_CRON_SECRET`) supplied by the pg_cron job instead.
 */
function authorize(request: Request): Response | null {
  const expected = process.env["AR_ALERT_CRON_SECRET"];
  if (!expected) return new Response("Unauthorized", { status: 401 });
  const provided =
    request.headers.get("x-cron-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided || provided !== expected) return new Response("Unauthorized", { status: 401 });
  return null;
}

export const Route = createFileRoute("/api/public/hooks/ar-escalation-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => authorize(request) ?? handle(),
      GET: async ({ request }) => authorize(request) ?? handle(),
    },
  },
});
