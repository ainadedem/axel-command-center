import { describe, expect, it } from "vitest";
import {
  backfillCandidates, findByNumber, invoicesByNumberForQuote,
  normalizeDocNumber, resolveInvoiceQuote, textReferencesNumber,
} from "@/lib/doc-number-link";
import type { Invoice, PurchaseOrder, Quote } from "@/lib/mock-data";

const quote = (o: Partial<Quote>) =>
  ({ id: "q1", companyId: "log", number: "DEV/LOG/08-26/534", status: "accepted", currency: "MGA", amount: 100, ...o } as Quote);

const invoice = (o: Partial<Invoice>) =>
  ({ id: "i1", companyId: "log", number: "FAC/LOG/08-26/12", status: "sent", currency: "MGA", amount: 100, ...o } as Invoice);

describe("normalizeDocNumber", () => {
  it("strips punctuation and case", () => {
    expect(normalizeDocNumber("dev/log/08-26/534")).toBe("DEVLOG0826534");
  });
});

describe("textReferencesNumber", () => {
  it("matches the full number regardless of punctuation", () => {
    expect(textReferencesNumber("Per devis DEV LOG 08 26 534", "DEV/LOG/08-26/534")).toBe(true);
  });
  it("matches a bare sequence only inside the same series", () => {
    expect(textReferencesNumber("Ref 534", "DEV/LOG/08-26/534", "DEV/LOG/08-26/540")).toBe(true);
    expect(textReferencesNumber("Ref 534", "DEV/LOG/08-26/534", "FAC/AXM/01-26/9")).toBe(false);
  });
  it("does not match unrelated text", () => {
    expect(textReferencesNumber("Consulting August", "DEV/LOG/08-26/534")).toBe(false);
  });
});

describe("findByNumber", () => {
  const quotes = [quote({}), quote({ id: "q2", number: "DEV/LOG/08-26/535" })];
  it("is company scoped", () => {
    expect(findByNumber("Devis DEV/LOG/08-26/534", quotes, "axm")).toHaveLength(0);
  });
  it("skips cancelled documents", () => {
    const cancelled = [quote({ status: "cancelled" })];
    expect(findByNumber("Devis DEV/LOG/08-26/534", cancelled, "log")).toHaveLength(0);
  });
  it("finds the referenced quote", () => {
    expect(findByNumber("Devis DEV/LOG/08-26/535", quotes, "log").map((q) => q.id)).toEqual(["q2"]);
  });
});

describe("resolveInvoiceQuote", () => {
  const q = quote({});
  it("prefers the stored link", () => {
    const r = resolveInvoiceQuote(invoice({ quoteId: "q1" }, [q]);
    expect(r.source).toBe("stored");
    expect(r.doc?.id).toBe("q1");
  });
  it("falls back to the number in the object line", () => {
    const r = resolveInvoiceQuote(invoice({ subject: "Suite au devis DEV/LOG/08-26/534" }, [q]);
    expect(r.source).toBe("number");
    expect(r.doc?.id).toBe("q1");
  });
  it("refuses ambiguous matches", () => {
    const dupe = quote({ id: "q9" }) as Quote;
    const r = resolveInvoiceQuote(invoice({ subject: "Devis DEV/LOG/08-26/534" }, [q, dupe]);
    expect(r.doc).toBeUndefined();
    expect(r.ambiguous).toBe(2);
  });
});

describe("invoicesByNumberForQuote", () => {
  it("finds invoices that mention the quote", () => {
    const q = quote({});
    const rows = invoicesByNumberForQuote(q, [invoice({ subject: "Devis DEV/LOG/08-26/534" })]);
    expect(rows.map((i) => i.id)).toEqual(["i1"]);
  });
});

describe("backfillCandidates", () => {
  it("lists only unstored, unambiguous matches", () => {
    const q = quote({});
    const inv = invoice({ subject: "Devis DEV/LOG/08-26/534" }) as Invoice;
    const po = { id: "p1", companyId: "log", number: "PO/LOG/1", status: "issued", subject: "DEV/LOG/08-26/534" } as PurchaseOrder;
    const out = backfillCandidates({ invoices: [inv], pos: [po], quotes: [q] });
    expect(out.map((c) => c.kind).sort()).toEqual(["invoice-quote", "po-quote"]);
  });
});
