// Cash flow view: what was invoiced, what actually came in, and what is still
// owed — per invoice and rolled up by month.
import { toMGA, type Invoice, type Transaction } from "./mock-data";
import { invoicePayable, invoiceBalance } from "./invoice-money";

export type CashFlowState = "paid" | "partial" | "overdue" | "open" | "cancelled";

export interface CashFlowRow {
  invoice: Invoice;
  /** Amount due on the document, in its own currency. */
  invoiced: number;
  paid: number;
  balance: number;
  invoicedMGA: number;
  paidMGA: number;
  balanceMGA: number;
  paidDate?: string;
  daysLate?: number;
  state: CashFlowState;
  /** Bank movements already matched to this invoice. */
  payments: Transaction[];
}

export interface CashFlowMonth {
  /** YYYY-MM */
  month: string;
  invoicedMGA: number;
  collectedMGA: number;
  outstandingMGA: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function cashFlowState(inv: Invoice, today = new Date()): CashFlowState {
  if (inv.status === "cancelled") return "cancelled";
  const balance = invoiceBalance(inv);
  if (balance <= 0.5) return "paid";
  if (inv.paid > 0.5) return "partial";
  return inv.dueDate < iso(today) ? "overdue" : "open";
}

export function cashFlowRows(
  invoices: Invoice[],
  transactions: Transaction[],
  today = new Date(),
): CashFlowRow[] {
  const byInvoice = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.invoiceId) continue;
    if (!byInvoice.has(t.invoiceId)) byInvoice.set(t.invoiceId, []);
    byInvoice.get(t.invoiceId)!.push(t);
  }

  return invoices
    .map((inv) => {
      const invoiced = invoicePayable(inv);
      const balance = Math.max(0, invoiceBalance(inv));
      const state = cashFlowState(inv, today);
      const daysLate =
        state === "overdue"
          ? Math.max(0, Math.round((today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000))
          : undefined;
      return {
        invoice: inv,
        invoiced,
        paid: inv.paid,
        balance,
        invoicedMGA: toMGA(invoiced, inv.currency),
        paidMGA: toMGA(inv.paid, inv.currency),
        balanceMGA: toMGA(balance, inv.currency),
        paidDate: inv.paidDate,
        daysLate,
        state,
        payments: (byInvoice.get(inv.id) ?? []).sort((a, b) => a.date.localeCompare(b.date)),
      };
    })
    .sort((a, b) => b.invoice.issueDate.localeCompare(a.invoice.issueDate));
}

/** Invoiced by issue month, collected by payment month, outstanding by issue month. */
export function cashFlowByMonth(rows: CashFlowRow[]): CashFlowMonth[] {
  const map = new Map<string, CashFlowMonth>();
  const bucket = (month: string) => {
    if (!map.has(month)) map.set(month, { month, invoicedMGA: 0, collectedMGA: 0, outstandingMGA: 0 });
    return map.get(month)!;
  };

  for (const r of rows) {
    if (r.state === "cancelled") continue;
    const issued = bucket(r.invoice.issueDate.slice(0, 7));
    issued.invoicedMGA += r.invoicedMGA;
    issued.outstandingMGA += r.balanceMGA;

    if (r.payments.length > 0) {
      for (const p of r.payments) bucket(p.date.slice(0, 7)).collectedMGA += toMGA(Math.abs(p.amount), p.currency);
    } else if (r.paidMGA > 0.5) {
      bucket((r.paidDate ?? r.invoice.issueDate).slice(0, 7)).collectedMGA += r.paidMGA;
    }
  }

  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function cashFlowTotals(rows: CashFlowRow[]) {
  return rows.reduce(
    (acc, r) => {
      if (r.state === "cancelled") return acc;
      acc.invoicedMGA += r.invoicedMGA;
      acc.collectedMGA += r.paidMGA;
      acc.outstandingMGA += r.balanceMGA;
      if (r.state === "overdue") acc.overdueMGA += r.balanceMGA;
      return acc;
    },
    { invoicedMGA: 0, collectedMGA: 0, outstandingMGA: 0, overdueMGA: 0 },
  );
}
