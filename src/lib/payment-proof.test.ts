import { describe, it, expect } from "vitest";
import {
  buildPaymentProof,
  proposeMatches,
  proposeMatchesForTransaction,
  badgeState,
  scoreCandidate,
  type ProofInvoice,
  type ProofTransaction,
} from "./payment-proof";

const inv = (o: Partial<ProofInvoice> = {}): ProofInvoice => ({
  id: "inv1",
  number: "FA-2026-001",
  companyId: "log",
  clientId: "cli1",
  status: "paid",
  amount: 1_000_000,
  taxAmount: 200_000,
  totalAmount: 1_200_000,
  paid: 1_200_000,
  paidDate: "2026-06-10",
  issueDate: "2026-05-01",
  currency: "MGA",
  ...o,
});

const tx = (o: Partial<ProofTransaction> = {}): ProofTransaction => ({
  id: "tx1",
  companyId: "log",
  accountId: "acc1",
  date: "2026-06-12",
  type: "income",
  description: "VIREMENT CLIENT",
  amount: 1_200_000,
  currency: "MGA",
  ...o,
});

describe("buildPaymentProof", () => {
  it("is unverified when no transaction is linked", () => {
    expect(buildPaymentProof(inv(), [tx()], [], []).verification).toBe("unverified");
  });

  it("is verified when the linked transaction covers the paid amount", () => {
    const p = buildPaymentProof(inv(), [tx({ invoiceId: "inv1" })], [], []);
    expect(p.verification).toBe("verified");
    expect(p.covered).toBe(1_200_000);
    expect(p.shortfall).toBe(0);
  });

  it("is partial when the linked transactions fall short", () => {
    const p = buildPaymentProof(inv(), [tx({ invoiceId: "inv1", amount: 500_000 })], [], []);
    expect(p.verification).toBe("partial");
    expect(p.shortfall).toBe(700_000);
  });

  it("tolerates 1 unit of rounding", () => {
    const p = buildPaymentProof(inv(), [tx({ invoiceId: "inv1", amount: 1_199_999 })], [], []);
    expect(p.verification).toBe("verified");
  });

  it("is n/a for an unpaid invoice", () => {
    expect(buildPaymentProof(inv({ status: "sent", paid: 0 }), [], [], []).verification).toBe("n/a");
  });

  it("resolves the quotation through the PO when the invoice has none", () => {
    const p = buildPaymentProof(
      inv({ poId: "po1" }),
      [],
      [{ id: "q1", number: "DEV-1", companyId: "log", status: "accepted", amount: 1, currency: "MGA" }],
      [{ id: "po1", number: "PO-1", companyId: "log", quoteId: "q1", amount: 1, currency: "MGA" }],
    );
    expect(p.quote?.number).toBe("DEV-1");
    expect(p.po?.number).toBe("PO-1");
  });
});

describe("scoreCandidate", () => {
  it("gives high confidence to an exact same-client match in the same week", () => {
    const c = scoreCandidate(inv(), tx({ clientId: "cli1" }));
    expect(c.confidence).toBe("high");
    expect(c.amountDelta).toBe(0);
  });

  it("recognises the invoice number in the narrative", () => {
    const c = scoreCandidate(inv(), tx({ description: "VIR FA 2026 001 CLIENT", clientId: undefined }));
    expect(c.reasons).toContain("invoice number in narrative");
  });

  it("penalises distant dates and wrong amounts", () => {
    const c = scoreCandidate(inv(), tx({ date: "2027-06-12", amount: 40_000, clientId: undefined }));
    expect(c.confidence).toBe("low");
  });
});

describe("proposeMatches", () => {
  it("never proposes the same transaction twice", () => {
    const a = inv({ id: "a", number: "FA-A" });
    const b = inv({ id: "b", number: "FA-B" });
    const t = tx({ id: "t1", clientId: "cli1" });
    const res = proposeMatches({ invoices: [a, b], transactions: [t], quotes: [], pos: [] });
    expect(res).toHaveLength(1);
    expect(res[0].best.transaction.id).toBe("t1");
  });

  it("skips invoices that already have a linked payment", () => {
    const res = proposeMatches({
      invoices: [inv()],
      transactions: [tx({ invoiceId: "inv1" })],
      quotes: [],
      pos: [],
    });
    expect(res).toHaveLength(0);
  });

  it("suggests the quotation reachable through the PO", () => {
    const res = proposeMatches({
      invoices: [inv({ poId: "po1" })],
      transactions: [tx({ clientId: "cli1" })],
      quotes: [{ id: "q1", number: "DEV-1", companyId: "log", status: "accepted", amount: 1, currency: "MGA" }],
      pos: [{ id: "po1", number: "PO-1", companyId: "log", quoteId: "q1", amount: 1, currency: "MGA" }],
    });
    expect(res[0].suggestedQuote?.id).toBe("q1");
  });
});

describe("installments", () => {
  const half = 600_000;

  it("reports a part-payment as an installment with the balance outstanding", () => {
    const proof = buildPaymentProof(
      inv({ status: "sent", paid: half }),
      [tx({ id: "p1", invoiceId: "inv1", amount: half })],
      [], [],
    );
    expect(proof.verification).toBe("installment");
    expect(proof.covered).toBe(half);
    expect(proof.outstanding).toBe(600_000);
    expect(proof.shortfall).toBe(0);
    expect(proof.installments).toHaveLength(1);
    expect(proof.installments[0].remainingAfter).toBe(600_000);
  });

  it("chains several installments with running coverage", () => {
    const proof = buildPaymentProof(
      inv({ paid: 1_200_000 }),
      [
        tx({ id: "p2", invoiceId: "inv1", amount: half, date: "2026-07-02" }),
        tx({ id: "p1", invoiceId: "inv1", amount: half, date: "2026-06-12" }),
      ],
      [], [],
    );
    expect(proof.verification).toBe("verified");
    expect(proof.installments.map((i) => i.transaction.id)).toEqual(["p1", "p2"]);
    expect(proof.installments[0].runningCovered).toBe(half);
    expect(proof.installments[1].remainingAfter).toBe(0);
  });

  it("keeps 'partial' when money was recorded as paid without a bank trail", () => {
    const proof = buildPaymentProof(
      inv({ paid: 1_200_000 }),
      [tx({ id: "p1", invoiceId: "inv1", amount: half })],
      [], [],
    );
    expect(proof.verification).toBe("partial");
    expect(proof.shortfall).toBe(600_000);
  });

  it("maps every verdict onto the three-state badge", () => {
    expect(badgeState("installment")).toBe("partial");
    expect(badgeState("verified")).toBe("verified");
    expect(badgeState("unverified")).toBe("unverified");
  });
});

describe("proposeMatchesForTransaction", () => {
  it("ranks invoices a receipt could settle, scored on the outstanding balance", () => {
    const target = inv({ id: "a", number: "FA-A", status: "sent", paid: 600_000 });
    const other = inv({ id: "b", number: "FA-B", status: "sent", paid: 0, clientId: "cli2" });
    const receipt = tx({ id: "r1", amount: 600_000, clientId: "cli1", invoiceId: undefined });
    const res = proposeMatchesForTransaction({
      transaction: receipt,
      invoices: [target, other],
      transactions: [tx({ id: "p1", invoiceId: "a", amount: 600_000 }), receipt],
      quotes: [], pos: [],
    });
    expect(res[0].invoice.id).toBe("a");
    expect(res[0].outstanding).toBe(600_000);
    expect(res[0].candidate.reasons).toContain("exact amount");
  });

  it("ignores expenses and fully verified invoices", () => {
    const res = proposeMatchesForTransaction({
      transaction: tx({ type: "expense" }),
      invoices: [inv()],
      transactions: [], quotes: [], pos: [],
    });
    expect(res).toHaveLength(0);
  });
});

describe("unlinking a payment", () => {
  const half = 600_000;

  it("falls back to partly-matched when one of two installments is removed", () => {
    const txs = [
      tx({ id: "p1", invoiceId: "inv1", amount: half, date: "2026-06-12" }),
      tx({ id: "p2", invoiceId: "inv1", amount: half, date: "2026-07-02" }),
    ];
    const before = buildPaymentProof(inv({ paid: 1_200_000 }), txs, [], []);
    expect(before.verification).toBe("verified");

    const after = buildPaymentProof(
      inv({ paid: 1_200_000 }),
      txs.filter((t) => t.id !== "p2"),
      [], [],
    );
    expect(after.verification).toBe("partial");
    expect(after.covered).toBe(half);
    expect(after.installments).toHaveLength(1);
  });

  it("falls back to unverified when the only payment is removed", () => {
    const after = buildPaymentProof(inv(), [tx({ id: "p1" })], [], []);
    expect(after.verification).toBe("unverified");
    expect(after.installments).toHaveLength(0);
    expect(badgeState(after.verification)).toBe("unverified");
  });

  it("drops all evidence when several installments are removed at once", () => {
    const txs = [
      tx({ id: "p1", invoiceId: "inv1", amount: 400_000, date: "2026-06-12" }),
      tx({ id: "p2", invoiceId: "inv1", amount: 400_000, date: "2026-07-02" }),
      tx({ id: "p3", invoiceId: "inv1", amount: 400_000, date: "2026-07-20" }),
    ];
    expect(buildPaymentProof(inv(), txs, [], []).verification).toBe("verified");

    const removed = new Set(["p2", "p3"]);
    const after = buildPaymentProof(inv(), txs.filter((t) => !removed.has(t.id)), [], []);
    expect(after.verification).toBe("partial");
    expect(after.covered).toBe(400_000);
    expect(after.outstanding).toBe(800_000);
    expect(after.installments).toHaveLength(1);

    const none = buildPaymentProof(inv(), [], [], []);
    expect(none.verification).toBe("unverified");
    expect(none.installments).toHaveLength(0);
  });
});

describe("30-day payers and repeated monthly amounts", () => {
  const monthly = (n: number, month: string): ProofInvoice =>
    inv({
      id: `m${n}`,
      number: `FA-2026-10${n}`,
      status: "sent",
      paid: 0,
      paidDate: undefined,
      issueDate: `2026-${month}-01`,
      amount: 1_000_000,
      taxAmount: 200_000,
      totalAmount: 1_200_000,
    });

  it("does not penalise a receipt that lands on the client's 30-day terms", () => {
    const invoice = monthly(1, "05");
    const late = tx({ date: "2026-05-31", description: "VIREMENT AIRTEL" });
    const withTerms = scoreCandidate(invoice, late, "Airtel", undefined, {
      behaviour: { termsDays: 30 },
    });
    const without = scoreCandidate(invoice, late, "Airtel");
    expect(withTerms.dayGap).toBeLessThanOrEqual(7);
    expect(withTerms.score).toBeGreaterThan(without.score);
    expect(withTerms.expectedDate).toBe("2026-05-31");
  });

  it("flags identical monthly amounts as ambiguous and never auto-confirms them", () => {
    const c = scoreCandidate(monthly(1, "05"), tx({ date: "2026-05-31" }), "Airtel", undefined, {
      behaviour: { termsDays: 30 },
      ambiguousWith: 2,
    });
    expect(c.ambiguousWith).toBe(2);
    expect(c.confidence).not.toBe("high");
  });

  it("keeps high confidence when the narrative names the billing period", () => {
    const c = scoreCandidate(
      monthly(1, "05"),
      tx({ date: "2026-05-31", description: "AIRTEL MAI 2026 ABONNEMENT" }),
      "Airtel",
      undefined,
      { behaviour: { termsDays: 30 }, ambiguousWith: 2 },
    );
    expect(c.narrativeMatch).toBe(true);
    expect(c.confidence).toBe("high");
  });

  it("matches a monthly stream in order instead of arbitrarily", () => {
    const invoices = [monthly(1, "05"), monthly(2, "06"), monthly(3, "07")];
    const receipts = [
      tx({ id: "t3", date: "2026-07-31", description: "VIREMENT AIRTEL" }),
      tx({ id: "t1", date: "2026-05-31", description: "VIREMENT AIRTEL" }),
      tx({ id: "t2", date: "2026-06-30", description: "VIREMENT AIRTEL" }),
    ];
    const out = proposeMatches({
      invoices,
      transactions: receipts,
      quotes: [],
      pos: [],
      clientName: () => "Airtel",
      clientTerms: () => 30,
    });
    const picked = Object.fromEntries(out.map((p) => [p.invoice.id, p.best.transaction.id]));
    expect(picked).toEqual({ m1: "t1", m2: "t2", m3: "t3" });
  });
});
