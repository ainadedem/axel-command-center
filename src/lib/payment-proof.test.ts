import { describe, it, expect } from "vitest";
import {
  buildPaymentProof,
  proposeMatches,
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
