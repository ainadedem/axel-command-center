import { describe, it, expect } from "vitest";
import { planStatusChange, invoiceKpis, describeStatusChange, type StatusInvoice } from "@/lib/invoice-status";

const base: StatusInvoice = {
  status: "sent",
  amount: 1000,
  paid: 0,
  taxAmount: 200,
  totalAmount: 1200,
};

describe("planStatusChange", () => {
  it("requires a payment before marking an open invoice paid", () => {
    const plan = planStatusChange(base, "paid");
    expect(plan.requiresPayment).toBe(true);
    expect(plan.patch.paid).toBe(1200);
  });

  it("does not require payment once one is confirmed", () => {
    const plan = planStatusChange(base, "paid", { paymentConfirmed: true, paymentDate: "2026-04-02" });
    expect(plan.requiresPayment).toBe(false);
    expect(plan.patch.paid).toBe(1200);
    expect(plan.patch.paidDate).toBe("2026-04-02");
  });

  it("requires a reason when cancelling and stamps cancelledAt", () => {
    expect(planStatusChange(base, "cancelled").requiresReason).toBe(true);
    const plan = planStatusChange(base, "cancelled", { reason: "Duplicate" });
    expect(plan.requiresReason).toBe(false);
    expect(plan.patch.cancellationReason).toBe("Duplicate");
    expect(plan.patch.cancelledAt).toBeTruthy();
  });

  it("clears cancellation metadata when leaving cancelled", () => {
    const cancelled: StatusInvoice = { ...base, status: "cancelled", cancelledAt: "2026-01-01T00:00:00Z", cancellationReason: "Oops" };
    const plan = planStatusChange(cancelled, "sent");
    expect(plan.patch.cancelledAt).toBeUndefined();
    expect(plan.patch.cancellationReason).toBeUndefined();
    expect(plan.previous.cancellationReason).toBe("Oops");
  });

  it("captures previous values for every patched field (undo safety)", () => {
    const plan = planStatusChange(base, "paid", { paymentConfirmed: true });
    expect(plan.previous.status).toBe("sent");
    expect(plan.previous.paid).toBe(0);
    Object.keys(plan.patch).forEach((k) => expect(k in plan.previous).toBe(true));
  });
});

const apply = (inv: StatusInvoice, patch: Partial<StatusInvoice>): StatusInvoice => ({ ...inv, ...patch });

describe("KPI consistency across status changes", () => {
  it("keeps open + collected consistent when marking paid", () => {
    const before = invoiceKpis([base]);
    expect(before.open).toBe(1200);
    expect(before.paidTotal).toBe(0);

    const plan = planStatusChange(base, "paid", { paymentConfirmed: true });
    const after = invoiceKpis([apply(base, plan.patch as Partial<StatusInvoice>)]);
    expect(after.open).toBe(0);
    expect(after.paidTotal).toBe(1200);
  });

  it("never counts a paid invoice with an unrecorded balance", () => {
    // simulating the old bug: status flipped without paid moving
    const broken = apply(base, { status: "paid" });
    expect(invoiceKpis([broken]).paidTotal).toBe(0);
    // the planner prevents it
    const plan = planStatusChange(base, "paid", { paymentConfirmed: true });
    const fixed = apply(base, plan.patch as Partial<StatusInvoice>);
    expect(invoiceKpis([fixed]).paidTotal).toBe(1200);
  });

  it("removes cancelled invoices from receivables and restores them on undo", () => {
    const plan = planStatusChange(base, "cancelled", { reason: "Client withdrew" });
    const cancelled = apply(base, plan.patch as Partial<StatusInvoice>);
    expect(invoiceKpis([cancelled]).open).toBe(0);
    const reverted = apply(cancelled, plan.previous as Partial<StatusInvoice>);
    expect(invoiceKpis([reverted]).open).toBe(1200);
    expect(reverted.status).toBe("sent");
  });

  it("round-trips paid → undo back to the original KPIs", () => {
    const plan = planStatusChange(base, "paid", { paymentConfirmed: true });
    const paid = apply(base, plan.patch as Partial<StatusInvoice>);
    const undone = apply(paid, plan.previous as Partial<StatusInvoice>);
    expect(invoiceKpis([undone])).toEqual(invoiceKpis([base]));
  });
});

describe("describeStatusChange", () => {
  it("summarises status and money movement", () => {
    const plan = planStatusChange(base, "paid", { paymentConfirmed: true });
    const text = describeStatusChange(base, plan.patch, "MGA");
    expect(text).toContain("sent → paid");
    expect(text).toContain("1,200");
  });
});
