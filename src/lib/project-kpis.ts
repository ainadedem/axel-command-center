// Portfolio-level delivery and money health, derived from project workflows.
import { toMGA, type Invoice, type Project, type Transaction } from "./mock-data";
import type { ProjectWorkflow } from "./project-stages";

export interface PortfolioKpis {
  /** Average completion across all projects, 0–100. */
  avgProgress: number;
  /** Projects with every step done. */
  completed: number;
  /** Projects started but not finished. */
  inFlight: number;
  /** Projects with at least one blocked step. */
  blocked: number;
  /** Projects with at least one step past its due date. */
  atRisk: number;
  /** Delivered (PVR or delivery done) but not yet invoiced — revenue stuck. */
  deliveredNotInvoiced: number;
  deliveredNotInvoicedMGA: number;
  /** Invoiced but not fully paid. */
  invoicedNotPaid: number;
  outstandingMGA: number;
}

export function portfolioKpis(
  projects: Project[],
  workflows: Map<string, ProjectWorkflow>,
  invoices: Invoice[],
): PortfolioKpis {
  let sum = 0, completed = 0, inFlight = 0, blocked = 0, atRisk = 0;
  let deliveredNotInvoiced = 0, deliveredNotInvoicedMGA = 0;
  let invoicedNotPaid = 0, outstandingMGA = 0;

  for (const p of projects) {
    const wf = workflows.get(p.id);
    if (!wf) continue;
    sum += wf.progress.pct;
    if (wf.progress.total > 0 && wf.progress.pct === 100) completed += 1;
    else if (wf.progress.done > 0) inFlight += 1;
    if (wf.progress.blocked > 0) blocked += 1;
    if (wf.progress.overdue > 0) atRisk += 1;

    const delivered = wf.stages.some((s) => (s.key === "delivery" || s.key === "pvr") && s.status === "done");
    if (delivered && !wf.evidence.invoiced) {
      deliveredNotInvoiced += 1;
      deliveredNotInvoicedMGA += toMGA(p.revenue, p.currency);
    }

    const projInv = invoices.filter((i) => i.projectId === p.id && i.status !== "cancelled");
    const due = projInv.reduce((s, i) => s + toMGA(i.amount - i.paid, i.currency), 0);
    if (due > 0.5) { invoicedNotPaid += 1; outstandingMGA += due; }
  }

  return {
    avgProgress: projects.length > 0 ? Math.round(sum / projects.length) : 0,
    completed, inFlight, blocked, atRisk,
    deliveredNotInvoiced, deliveredNotInvoicedMGA,
    invoicedNotPaid, outstandingMGA,
  };
}

/** Money actually spent on a project, in MGA. */
export function projectSpendMGA(projectId: string, transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.projectId === projectId && t.type === "expense")
    .reduce((s, t) => s + toMGA(t.amount, t.currency), 0);
}
