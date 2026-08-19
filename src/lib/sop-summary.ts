/**
 * Weekly compliance summary — pure derivation over the SOP rule engine.
 *
 * The previous-week comparison re-runs the same engine with the clock wound
 * back seven days and documents issued after that date removed, so aging
 * rules recompute honestly instead of being guessed at.
 */

import { subDays, parseISO, isAfter } from "date-fns";
import { toMGA, type Invoice, type Currency } from "@/lib/mock-data";
import { invoiceBalance } from "@/lib/invoice-money";
import {
  evaluateCompliance, agingDays, dueStage, ESCALATION_STAGES,
  type ComplianceInput, type Violation,
} from "@/lib/sop";


export interface AgingBucket {
  label: string;
  min: number;
  max: number | null;
  count: number;
  exposureMGA: number;
}

export interface OwnerLoad {
  /** Auth user id of the invoice creator, or "unassigned". */
  ownerId: string;
  count: number;
  exposureMGA: number;
  criticals: number;
}

export interface WeeklySummary {
  critical: number;
  warning: number;
  criticalDelta: number;
  warningDelta: number;
  buckets: AgingBucket[];
  overdueCount: number;
  overdueExposureMGA: number;
  /** Ladder steps that became due at any point in the last 7 days. */
  stepsDueThisWeek: number;
  /** Steps actually logged in the last 7 days. */
  stepsLoggedThisWeek: number;
  owners: OwnerLoad[];
}

const BUCKETS: Array<Pick<AgingBucket, "label" | "min" | "max">> = [
  { label: "15–29 days", min: 15, max: 29 },
  { label: "30–44 days", min: 30, max: 44 },
  { label: "45–59 days", min: 45, max: 59 },
  { label: "60+ days", min: 60, max: null },
];

const isOpen = (i: Invoice) =>
  i.status !== "cancelled" && i.status !== "draft" && invoiceBalance(i) > 0.5;

function exposureOf(v: Violation): number {
  if (v.amount == null || !v.currency) return 0;
  return toMGA(v.amount, v.currency as Currency);
}

export function weeklySummary(
  input: ComplianceInput,
  violations: Violation[],
  today = new Date(),
): WeeklySummary {
  const weekAgo = subDays(today, 7);

  const critical = violations.filter((v) => v.severity === "critical").length;
  const warning = violations.length - critical;

  // Snapshot of the same books as they stood a week ago.
  const cutoff = weekAgo;
  const existedLastWeek = (iso?: string) => !iso || !isAfter(parseISO(iso), cutoff);
  const lastWeekInput: ComplianceInput = {
    invoices: input.invoices.filter((i) => existedLastWeek(i.issueDate)),
    purchaseOrders: input.purchaseOrders.filter((p) => existedLastWeek(p.issueDate)),
    expenses: input.expenses.filter((e) => existedLastWeek(e.issueDate)),
    pvrs: input.pvrs.filter((p) => existedLastWeek(p.signedDate)),
    escalations: input.escalations.filter((e) => existedLastWeek(e.performedAt)),
  };
  const prev = evaluateCompliance(lastWeekInput, weekAgo);
  const prevCritical = prev.filter((v) => v.severity === "critical").length;

  const openInvoices = input.invoices.filter(isOpen);
  const buckets: AgingBucket[] = BUCKETS.map((b) => ({ ...b, count: 0, exposureMGA: 0 }));
  let overdueCount = 0;
  let overdueExposureMGA = 0;

  for (const inv of openInvoices) {
    const days = agingDays(inv, today);
    if (days < 15) continue;
    const balance = toMGA(invoiceBalance(inv), inv.currency);
    overdueCount += 1;
    overdueExposureMGA += balance;
    const bucket = buckets.find((b) => days >= b.min && (b.max === null || days <= b.max));
    if (bucket) { bucket.count += 1; bucket.exposureMGA += balance; }
  }

  // Steps that crossed their threshold during the last 7 days.
  let stepsDueThisWeek = 0;
  for (const inv of openInvoices) {
    const now = dueStage(inv, today);
    const before = dueStage(inv, weekAgo);
    if (now > before) stepsDueThisWeek += ESCALATION_STAGES.filter((s) => s > before && s <= now).length;
  }
  const stepsLoggedThisWeek = input.escalations.filter(
    (e) => isAfter(parseISO(e.performedAt), weekAgo),
  ).length;

  // Who needs to act — grouped by the person who created the document.
  const creatorByInvoice = new Map(input.invoices.map((i) => [i.id, i.createdBy]));
  const byOwner = new Map<string, OwnerLoad>();
  for (const v of violations) {
    const ownerId = (v.entity === "invoice" ? creatorByInvoice.get(v.entityId) : undefined) || "unassigned";
    const row = byOwner.get(ownerId) ?? { ownerId, count: 0, exposureMGA: 0, criticals: 0 };
    row.count += 1;
    row.exposureMGA += exposureOf(v);
    if (v.severity === "critical") row.criticals += 1;
    byOwner.set(ownerId, row);
  }

  return {
    critical,
    warning,
    criticalDelta: critical - prevCritical,
    warningDelta: warning - (prev.length - prevCritical),
    buckets,
    overdueCount,
    overdueExposureMGA,
    stepsDueThisWeek,
    stepsLoggedThisWeek,
    owners: [...byOwner.values()].sort((a, b) => b.criticals - a.criticals || b.exposureMGA - a.exposureMGA),
  };
}
