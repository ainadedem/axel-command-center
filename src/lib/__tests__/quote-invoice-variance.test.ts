import { describe, it, expect } from "vitest";
import { computeVariance } from "@/lib/quote-invoice-variance";
import { FX, type Quote, type Invoice, type QuoteLine } from "@/lib/mock-data";

const line = (description: string, quantity: number, rate: number): QuoteLine => ({
  id: description, description, unit: "fixed", quantity, rate,
});

const quote = (over: Partial<Quote> = {}): Quote => ({
  id: "q1", number: "Q-001", companyId: "c1", clientId: "cl1",
  issueDate: "2026-01-01", validUntil: "2026-02-01",
  amount: 1000, currency: "MGA", status: "accepted",
  lines: [line("Design", 1, 1000)], totalAmount: 1000,
  ...over,
});

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1", number: "F-001", companyId: "c1", clientId: "cl1",
  issueDate: "2026-01-10", dueDate: "2026-02-10",
  amount: 1000, paid: 0, currency: "MGA", status: "sent",
  lines: [line("Design", 1, 1000)], totalAmount: 1000,
  ...over,
});

describe("computeVariance", () => {
  it("reports no variance when quote and invoice match", () => {
    const v = computeVariance([quote()], [invoice()]);
    expect(v.total).toBe(0);
    expect(v.missing).toHaveLength(0);
    expect(v.extra).toHaveLength(0);
    expect(v.changed).toHaveLength(0);
  });

  it("attributes an uninvoiced line to scope", () => {
    const q = quote({ lines: [line("Design", 1, 1000), line("Print", 1, 400)], amount: 1400, totalAmount: 1400 });
    const v = computeVariance([q], [invoice()]);
    expect(v.total).toBe(-400);
    expect(v.scope).toBe(-400);
    expect(v.priceQty).toBe(0);
    expect(v.missing.map((l) => l.description)).toEqual(["Print"]);
    expect(v.notInvoiced).toBe(400);
  });

  it("attributes an unquoted invoice line to scope", () => {
    const i = invoice({ lines: [line("Design", 1, 1000), line("Rush fee", 1, 200)], amount: 1200, totalAmount: 1200 });
    const v = computeVariance([quote()], [i]);
    expect(v.scope).toBe(200);
    expect(v.extra.map((l) => l.description)).toEqual(["Rush fee"]);
  });

  it("attributes a rate or quantity change to price/qty", () => {
    const i = invoice({ lines: [line("Design", 2, 1000)], amount: 2000, totalAmount: 2000 });
    const v = computeVariance([quote()], [i]);
    expect(v.priceQty).toBe(1000);
    expect(v.scope).toBe(0);
    expect(v.changed[0]).toMatchObject({ quoted: 1000, invoiced: 2000, delta: 1000 });
  });

  it("isolates FX movement from scope and price", () => {
    const rate = FX.EUR;
    const q = quote({
      currency: "EUR", amount: 100, totalAmount: 100,
      lines: [line("Design", 1, 100)],
      fxRate: 1, fxBaseCurrency: "EUR" as const,
    });
    // Same document valued at a different snapshot rate.
    const qOld = { ...q, fxRate: (rate - 500) / rate, fxBaseCurrency: "EUR" as const };
    const v = computeVariance([qOld], [invoice({ currency: "EUR", amount: 100, totalAmount: 100, lines: [line("Design", 1, 100)] })]);
    expect(v.scope).toBe(0);
    expect(v.fx).toBeCloseTo(100 * 500, -1);
    expect(v.unexplained).toBeLessThanOrEqual(1);
  });

  it("ignores cancelled invoices and dead quotes", () => {
    const v = computeVariance(
      [quote({ status: "rejected" })],
      [invoice({ status: "cancelled" })],
    );
    expect(v.quoted).toBe(0);
    expect(v.invoiced).toBe(0);
    expect(v.total).toBe(0);
  });
});
