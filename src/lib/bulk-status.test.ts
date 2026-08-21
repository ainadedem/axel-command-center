import { describe, it, expect } from "vitest";
import { planBulkStatus, type BulkStatusRow } from "@/lib/bulk-status";

const row = (id: string, status: string, companyId = "c1"): BulkStatusRow => ({
  id, number: `Q-${id}`, companyId, status,
});

describe("planBulkStatus", () => {
  it("separates changes, no-ops and permission blocks", () => {
    const rows = [row("1", "draft"), row("2", "sent"), row("3", "draft", "other")];
    const plan = planBulkStatus(rows, "sent", { canWrite: (r) => r.companyId === "c1" });
    expect(plan.change.map((r) => r.id)).toEqual(["1"]);
    expect(plan.same.map((r) => r.id)).toEqual(["2"]);
    expect(plan.blocked).toEqual([{ row: rows[2], reason: "No permission" }]);
  });

  it("applies custom validation rules", () => {
    const rows = [row("1", "draft"), row("2", "draft")];
    const plan = planBulkStatus(rows, "paid", {
      canWrite: () => true,
      validate: (r) => (r.id === "2" ? "Outstanding balance" : null),
    });
    expect(plan.change.map((r) => r.id)).toEqual(["1"]);
    expect(plan.blocked[0]?.reason).toBe("Outstanding balance");
  });

  it("flags cancellations as needing a reason", () => {
    expect(planBulkStatus([row("1", "draft")], "cancelled", { canWrite: () => true }).needsReason).toBe(true);
    expect(planBulkStatus([row("1", "draft")], "sent", { canWrite: () => true }).needsReason).toBe(false);
  });
});
