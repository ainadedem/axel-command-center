import { describe, it, expect, vi, beforeEach } from "vitest";
import { canUnlinkIn, UNLINK_ROLES, type UnlinkActor } from "@/lib/payment-permissions";
import { bulkUnlinkPayments, UnlinkPermissionError, type UnlinkTarget } from "@/lib/payment-audit";

const COMPANY_A = "company-a";
const COMPANY_B = "company-b";

/** Builds an actor whose company roles are declared per company. */
const actor = (roles: string[], perCompany: Record<string, string[]> = {}): UnlinkActor => ({
  roles,
  hasCompanyRole: (companyId, allowed) =>
    (perCompany[companyId] ?? []).some((r) => allowed.includes(r as (typeof UNLINK_ROLES)[number])),
});

describe("canUnlinkIn — company-scoped RBAC", () => {
  it("lets finance unlink only inside the company they are finance in", () => {
    const a = actor([], { [COMPANY_A]: ["finance"], [COMPANY_B]: ["sales"] });
    expect(canUnlinkIn(a, COMPANY_A)).toBe(true);
    expect(canUnlinkIn(a, COMPANY_B)).toBe(false);
  });

  it("lets a company admin unlink in their own company only", () => {
    const a = actor([], { [COMPANY_A]: ["company_admin"] });
    expect(canUnlinkIn(a, COMPANY_A)).toBe(true);
    expect(canUnlinkIn(a, COMPANY_B)).toBe(false);
  });

  it("never lets sales or viewer unlink, in any company", () => {
    const sales = actor([], { [COMPANY_A]: ["sales"], [COMPANY_B]: ["viewer"] });
    expect(canUnlinkIn(sales, COMPANY_A)).toBe(false);
    expect(canUnlinkIn(sales, COMPANY_B)).toBe(false);
  });

  it("lets platform admins unlink across every company", () => {
    for (const role of ["super_admin", "group_admin"]) {
      const a = actor([role]);
      expect(canUnlinkIn(a, COMPANY_A)).toBe(true);
      expect(canUnlinkIn(a, COMPANY_B)).toBe(true);
    }
  });

  it("denies when the document carries no company", () => {
    expect(canUnlinkIn(actor([], { [COMPANY_A]: ["finance"] }), undefined)).toBe(false);
    // A platform admin is still allowed — their grant is not company-scoped.
    expect(canUnlinkIn(actor(["super_admin"]), undefined)).toBe(true);
  });
});

const target = (companyId: string, n: number): UnlinkTarget => ({
  invoiceId: `inv-${companyId}-${n}`,
  invoiceNumber: `INV-${n}`,
  companyId,
  transactionId: `tx-${companyId}-${n}`,
  transactionDate: "2026-03-01",
  transactionAmount: 1_000,
  transactionCurrency: "MGA",
});

const updates: Array<[string, unknown]> = [];

vi.mock("@/lib/mock-data", () => ({
  transactionsStore: { update: (id: string, patch: unknown) => updates.push([id, patch]) },
}));
vi.mock("@/lib/history", () => ({ withoutHistory: async (fn: () => Promise<void>) => fn() }));
vi.mock("@/lib/document-activity", () => ({ logActivity: async () => "entry-1" }));

describe("bulkUnlinkPayments — enforces the company boundary", () => {
  beforeEach(() => {
    updates.length = 0;
  });

  it("rejects the whole batch when one invoice is outside the caller's companies", async () => {
    const allow = (companyId: string) =>
      canUnlinkIn(actor([], { [COMPANY_A]: ["finance"] }), companyId);
    await expect(
      bulkUnlinkPayments([target(COMPANY_A, 1), target(COMPANY_B, 2)], "cleanup", "manual", allow),
    ).rejects.toBeInstanceOf(UnlinkPermissionError);
    // Nothing was written: the guard runs before any store mutation.
    expect(updates).toHaveLength(0);
  });

  it("names the blocked targets so the UI can explain the denial", async () => {
    const allow = (companyId: string) =>
      canUnlinkIn(actor([], { [COMPANY_A]: ["finance"] }), companyId);
    try {
      await bulkUnlinkPayments([target(COMPANY_B, 3)], "cleanup", "manual", allow);
      throw new Error("expected a permission error");
    } catch (e) {
      const err = e as UnlinkPermissionError;
      expect(err.blocked?.map((t) => t.companyId)).toEqual([COMPANY_B]);
    }
  });

  it("rejects every target for a sales-only user", async () => {
    const allow = (companyId: string) =>
      canUnlinkIn(actor([], { [COMPANY_A]: ["sales"], [COMPANY_B]: ["sales"] }), companyId);
    await expect(
      bulkUnlinkPayments([target(COMPANY_A, 4)], "cleanup", "manual", allow),
    ).rejects.toBeInstanceOf(UnlinkPermissionError);
    expect(updates).toHaveLength(0);
  });

  it("applies the batch when the caller is finance in every affected company", async () => {
    const allow = (companyId: string) =>
      canUnlinkIn(
        actor([], { [COMPANY_A]: ["finance"], [COMPANY_B]: ["company_admin"] }),
        companyId,
      );
    const res = await bulkUnlinkPayments(
      [target(COMPANY_A, 5), target(COMPANY_B, 6)],
      "cleanup",
      "manual",
      allow,
    );
    expect(res.count).toBe(2);
    expect(updates.map(([id]) => id)).toEqual([`tx-${COMPANY_A}-5`, `tx-${COMPANY_B}-6`]);
  });

  it("applies across companies for a platform admin", async () => {
    const allow = (companyId: string) => canUnlinkIn(actor(["group_admin"]), companyId);
    const res = await bulkUnlinkPayments([target(COMPANY_B, 7)], "cleanup", "manual", allow);
    expect(res.count).toBe(1);
  });
});
