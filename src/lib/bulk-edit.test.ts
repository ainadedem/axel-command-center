import { describe, it, expect } from "vitest";
import { resolveRowPatch, previewBulk, describePatch, type BulkDoc } from "@/lib/bulk-edit";

const doc = (over: Partial<BulkDoc> = {}): BulkDoc => ({
  id: "1",
  number: "INV-001",
  companyId: "log",
  clientId: "c1",
  status: "draft",
  currency: "MGA",
  amount: 1000,
  paid: 0,
  lines: [{ quantity: 2, rate: 500 }],
  issueDate: "2026-08-01",
  dueDate: "2026-08-31",
  validUntil: "2026-08-31",
  ...over,
});

describe("resolveRowPatch", () => {
  it("shifts the due date from each row's own date", () => {
    const res = resolveRowPatch(doc(), { dueDate: { mode: "shift", days: 15 } });
    expect(res).toEqual({ patch: { dueDate: "2026-09-15" } });
  });

  it("shifts backwards", () => {
    const res = resolveRowPatch(doc(), { validUntil: { mode: "shift", days: -1 } });
    expect(res).toEqual({ patch: { validUntil: "2026-08-30" } });
  });

  it("recomputes tax and total when the rate changes", () => {
    const res = resolveRowPatch(doc(), { taxRate: 20 });
    expect(res).toEqual({ patch: { taxRate: 20, amount: 1000, taxAmount: 200, totalAmount: 1200 } });
  });

  it("recomputes the subtotal when a global discount is applied", () => {
    const res = resolveRowPatch(doc(), { discountPct: 10, taxRate: 20 });
    expect(res).toEqual({
      patch: { taxRate: 20, discountPct: 10, amount: 900, taxAmount: 180, totalAmount: 1080 },
    });
  });

  it("skips paid documents for money changes", () => {
    expect(resolveRowPatch(doc({ status: "paid" }), { taxRate: 20 })).toEqual({ skip: "paid — money fields locked" });
  });

  it("skips cancelled documents for money changes", () => {
    expect(resolveRowPatch(doc({ status: "cancelled" }), { discountPct: 5 })).toEqual({
      skip: "cancelled — money fields locked",
    });
  });

  it("locks currency once a payment exists", () => {
    expect(resolveRowPatch(doc({ paid: 100 }), { currency: "EUR" })).toEqual({
      skip: "payment recorded — currency locked",
    });
  });

  it("allows non-money edits on paid documents", () => {
    expect(resolveRowPatch(doc({ status: "paid", paid: 1000 }), { language: "fr" })).toEqual({
      patch: { language: "fr" },
    });
  });

  it("marks the stamp dirty when the signer changes", () => {
    expect(resolveRowPatch(doc(), { signerId: "u1" })).toEqual({ patch: { signerId: "u1", stampDirty: true } });
  });

  it("skips rows that are already in the target state", () => {
    expect(resolveRowPatch(doc({ clientId: "c1" }), { clientId: "c1" })).toEqual({ skip: "nothing to change" });
  });

  it("adds assignees without duplicates and enforces the cap", () => {
    expect(resolveRowPatch(doc({ assignedTo: ["a"] }), { assignees: { mode: "add", ids: ["a", "b"] } })).toEqual({
      patch: { assignedTo: ["a", "b"] },
    });
    expect(
      resolveRowPatch(doc({ assignedTo: ["a", "b", "c"] }), { assignees: { mode: "add", ids: ["d"] } }),
    ).toEqual({ skip: "assignee limit reached" });
  });

  it("removes and replaces assignees", () => {
    expect(resolveRowPatch(doc({ assignedTo: ["a", "b"] }), { assignees: { mode: "remove", ids: ["a"] } })).toEqual({
      patch: { assignedTo: ["b"] },
    });
    expect(resolveRowPatch(doc({ assignedTo: ["a"] }), { assignees: { mode: "replace", ids: ["z"] } })).toEqual({
      patch: { assignedTo: ["z"] },
    });
  });
});

describe("previewBulk", () => {
  it("splits rows into targets and skips", () => {
    const rows = [doc({ id: "1" }), doc({ id: "2", number: "INV-002", status: "paid" })];
    const { targets, skipped } = previewBulk(rows, { taxRate: 20 });
    expect(targets).toHaveLength(1);
    expect(skipped).toEqual([{ id: "2", number: "INV-002", reason: "paid — money fields locked" }]);
  });

  it("treats an empty patch as nothing to change", () => {
    const { targets, skipped } = previewBulk([doc()], {});
    expect(targets).toHaveLength(0);
    expect(skipped[0]?.reason).toBe("nothing to change");
  });
});

describe("describePatch", () => {
  it("renders readable change bits", () => {
    const bits = describePatch(
      { clientId: "c9", dueDate: { mode: "shift", days: 7 }, taxRate: 20 },
      { client: () => "Acme" },
    );
    expect(bits).toEqual(["client → Acme", "due date shifted +7d", "tax → 20%"]);
  });
});
