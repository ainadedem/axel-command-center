/**
 * Payment-approval notifications.
 *
 * A payment request must reach the people who can act on it: the finance team
 * and the administrators who give final approval. Those recipients depend on
 * company roles, which one user cannot read for another, so the resolution
 * happens server-side and the fan-out does the rest (in-app inbox, email,
 * quiet hours, digests).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PaymentNotifyInput {
  /** Database company id. */
  companyId: string;
  /** "submitted" | "reviewed" | "approved" | "rejected" | "paid" | "reminder" */
  stage: string;
  title: string;
  body: string;
  href: string;
  amount?: number | null;
  /** The requester, so decisions travel back to them. */
  requesterId?: string | null;
}

const FINANCE_ROLES = ["company_admin", "manager", "finance", "project_manager"];

export const notifyPaymentRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: PaymentNotifyInput) => {
    if (!input?.companyId) throw new Error("companyId is required");
    if (!input?.title) throw new Error("title is required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { userId } = context as { userId: string };
    const url = process.env["SUPABASE_URL"];
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !serviceKey) return { delivered: 0, emailed: 0, queued: 0 };

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const recipients = new Set<string>();

    // Finance and managers on this company.
    const { data: access } = await admin
      .from("user_company_access")
      .select("user_id, role")
      .eq("company_id", data.companyId);
    for (const row of access ?? []) {
      if (FINANCE_ROLES.includes(row.role as string)) recipients.add(row.user_id as string);
    }

    // Whoever gives final approval.
    const { data: platform } = await admin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["super_admin", "group_admin"]);
    for (const row of platform ?? []) recipients.add(row.user_id as string);

    // Decisions travel back to the person who asked for the money.
    if (data.requesterId) recipients.add(data.requesterId);
    recipients.delete(userId);

    const { fanOut } = await import("./notifications.server");
    return fanOut(userId, {
      kind: data.stage === "reminder" ? "payment_run_reminder" : "payment_request_decision",
      companyId: data.companyId,
      title: data.title,
      body: data.body,
      href: data.href,
      amount: data.amount ?? null,
      recipients: [...recipients],
      forceEmail: true,
    });
  });
