/**
 * Client-side helper that turns a payment request into a readable alert and
 * hands it to the server-side fan-out. Never throws — a failed notification
 * must not block a payment decision.
 */
import { dbCompanyId } from "./db-sync";
import { fmt, type PaymentRequest } from "./mock-data";
import { notifyPaymentRequest } from "./payment-notify.functions";
import { runLabel, STATUS_LABEL } from "./payment-approvals";

export interface PaymentContext {
  payee?: string;
  projectName?: string;
  quoteNumber?: string;
  invoiceNumber?: string;
}

export type PaymentStage = "submitted" | "reviewed" | "approved" | "rejected" | "paid";

const HEADLINE: Record<PaymentStage, (r: PaymentRequest) => string> = {
  submitted: (r) => `Payment request needs review — ${r.title}`,
  reviewed: (r) => `Reviewed by finance, awaiting approval — ${r.title}`,
  approved: (r) => `Payment approved — ${r.title}`,
  rejected: (r) => `Payment rejected — ${r.title}`,
  paid: (r) => `Payment released — ${r.title}`,
};

export function paymentSummary(r: PaymentRequest, ctx: PaymentContext = {}): string {
  const parts = [`Amount: ${fmt(r.amount, r.currency)}`];
  if (ctx.payee) parts.push(`Pay to: ${ctx.payee}`);
  if (ctx.projectName) parts.push(`Project: ${ctx.projectName}`);
  if (ctx.quoteNumber) parts.push(`Quotation: ${ctx.quoteNumber}`);
  if (ctx.invoiceNumber) parts.push(`Invoice: ${ctx.invoiceNumber}`);
  if (r.runId) parts.push(`Run day: ${runLabel(r.runId)}`);
  if (r.neededBy) parts.push(`Needed by: ${r.neededBy}`);
  if (r.offCycle) parts.push(`Off-cycle: ${r.offCycleReason ?? "urgent"}`);
  if (r.rejectionReason) parts.push(`Reason: ${r.rejectionReason}`);
  parts.push(`Status: ${STATUS_LABEL[r.status]}`);
  return parts.join(" · ");
}

export function announcePaymentRequest(
  request: PaymentRequest,
  stage: PaymentStage,
  ctx: PaymentContext = {},
): void {
  void (async () => {
    try {
      const companyId = dbCompanyId(request.companyId);
      if (!companyId) return;
      await notifyPaymentRequest({
        data: {
          companyId,
          stage,
          title: HEADLINE[stage](request),
          body: paymentSummary(request, ctx),
          href: "/payment-approvals",
          amount: request.amount,
          requesterId: request.requestedBy ?? null,
        },
      });
    } catch (e) {
      console.warn("[payment-notify]", e);
    }
  })();
}
