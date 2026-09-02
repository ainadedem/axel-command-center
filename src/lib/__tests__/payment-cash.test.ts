import { describe, expect, it } from "vitest";
import { outflowRows, outflowTotals, cashFlowByMonthWithOutflow } from "../cash-flow";
import type { PaymentRequest } from "../mock-data";

const req = (over: Partial<PaymentRequest>): PaymentRequest => ({
  id: over.id ?? "r1",
  companyId: "c1",
  kind: "supplier",
  title: "Server hosting",
  amount: 1_000_000,
  currency: "MGA",
  status: "approved",
  offCycle: false,
  ...over,
} as PaymentRequest);

describe("outgoing cash", () => {
  it("separates approved (committed) from paid (released)", () => {
    const rows = outflowRows([
      req({ id: "a", status: "approved", runId: "2026-09-03" }),
      req({ id: "b", status: "paid", paidAt: "2026-09-03T10:00:00Z", amount: 400_000 }),
      req({ id: "c", status: "submitted" }),
    ]);
    expect(rows).toHaveLength(2);
    const t = outflowTotals(rows);
    expect(t.committedMGA).toBe(1_000_000);
    expect(t.paidOutMGA).toBe(400_000);
  });

  it("nets collected against released money and carries a running balance", () => {
    const months = cashFlowByMonthWithOutflow(
      [],
      outflowRows([req({ id: "b", status: "paid", paidAt: "2026-09-03T10:00:00Z" })]),
    );
    const sep = months.find((m) => m.month === "2026-09")!;
    expect(sep.paidOutMGA).toBe(1_000_000);
    expect(sep.netMGA).toBe(-1_000_000);
    expect(sep.runningMGA).toBe(-1_000_000);
  });
});
