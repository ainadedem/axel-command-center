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

// ---------------------------------------------------------------------------
// Money going out: approved payment requests.
//
// Approving a payment commits the money; it only leaves the bank when the
// request is marked paid. Cash flow shows both so a run can be planned
// without pretending the cash has already moved.
// ---------------------------------------------------------------------------

import type { PaymentRequest } from "./mock-data";

export interface OutflowRow {
  request: PaymentRequest;
  amountMGA: number;
  /** Approved but not yet released. */
  committed: boolean;
  /** Released — the money left the account. */
  released: boolean;
  /** Run day (paid date when known, otherwise the scheduled Thursday). */
  date: string;
}

export function outflowRows(requests: PaymentRequest[]): OutflowRow[] {
  return requests
    .filter((r) => r.status === "approved" || r.status === "paid")
    .map((r) => ({
      request: r,
      amountMGA: toMGA(r.amount, r.currency),
      committed: r.status === "approved",
      released: r.status === "paid",
      date: (r.paidAt ?? r.runId ?? r.approvedAt ?? new Date().toISOString()).slice(0, 10),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface CashFlowMonthNet extends CashFlowMonth {
  /** Money actually released this month. */
  paidOutMGA: number;
  /** Approved, scheduled for this month, not yet released. */
  committedMGA: number;
  /** collected − paid out */
  netMGA: number;
  /** Running net across months, oldest first. */
  runningMGA: number;
}

export function cashFlowByMonthWithOutflow(
  rows: CashFlowRow[],
  outflows: OutflowRow[],
): CashFlowMonthNet[] {
  const base = new Map<string, CashFlowMonthNet>();
  for (const m of cashFlowByMonth(rows)) {
    base.set(m.month, { ...m, paidOutMGA: 0, committedMGA: 0, netMGA: 0, runningMGA: 0 });
  }
  const bucket = (month: string) => {
    if (!base.has(month)) {
      base.set(month, {
        month, invoicedMGA: 0, collectedMGA: 0, outstandingMGA: 0,
        paidOutMGA: 0, committedMGA: 0, netMGA: 0, runningMGA: 0,
      });
    }
    return base.get(month)!;
  };

  for (const o of outflows) {
    const m = bucket(o.date.slice(0, 7));
    if (o.released) m.paidOutMGA += o.amountMGA;
    else m.committedMGA += o.amountMGA;
  }

  let running = 0;
  return [...base.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      m.netMGA = m.collectedMGA - m.paidOutMGA;
      running += m.netMGA;
      m.runningMGA = running;
      return m;
    });
}

export function outflowTotals(outflows: OutflowRow[]) {
  return outflows.reduce(
    (acc, o) => {
      if (o.released) acc.paidOutMGA += o.amountMGA;
      else acc.committedMGA += o.amountMGA;
      return acc;
    },
    { paidOutMGA: 0, committedMGA: 0 },
  );
}
