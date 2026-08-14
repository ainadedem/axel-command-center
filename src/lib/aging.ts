import { differenceInDays, parseISO } from "date-fns";

/**
 * Shared aging bucket definitions used by Invoices, Receivables and Payables.
 * A single source of truth keeps the bucket thresholds, labels and colours in
 * sync across every page that shows an aging breakdown.
 */
export type AgingKey = "current" | "0-30" | "31-60" | "61-90" | "90+";

export interface AgingBucketDef {
  key: AgingKey;
  /** Long label used on tiles ("31-60 days"). */
  label: string;
  /** Short label used on chart axes ("31-60 d"). */
  short: string;
  /** Semantic tone driving text / dot colours. */
  tone: "neutral" | "primary" | "warning" | "danger";
}

export const AGING_BUCKETS: AgingBucketDef[] = [
  { key: "current", label: "Current", short: "Current", tone: "neutral" },
  { key: "0-30", label: "1-30 days", short: "1-30 d", tone: "primary" },
  { key: "31-60", label: "31-60 days", short: "31-60 d", tone: "warning" },
  { key: "61-90", label: "61-90 days", short: "61-90 d", tone: "danger" },
  { key: "90+", label: "90+ days", short: "90+ d", tone: "danger" },
];

/** Buckets shown on the "days past due" tiles (excludes Current). */
export const PAST_DUE_BUCKETS = AGING_BUCKETS.filter((b) => b.key !== "current");

export const AGING_TONE_TEXT: Record<AgingBucketDef["tone"], string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  warning: "text-warning",
  danger: "text-destructive",
};

export const AGING_TONE_DOT: Record<AgingBucketDef["tone"], string> = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
};

/** Days past due (negative / zero means not yet due). */
export function daysLate(dueDate: string | undefined, today: Date = new Date()): number {
  if (!dueDate) return 0;
  try {
    return differenceInDays(today, parseISO(dueDate));
  } catch {
    return 0;
  }
}

/** Map a "days past due" number onto a bucket key. */
export function bucketOf(late: number): AgingKey {
  if (late <= 0) return "current";
  if (late <= 30) return "0-30";
  if (late <= 60) return "31-60";
  if (late <= 90) return "61-90";
  return "90+";
}

export interface AgingRow {
  key: AgingKey;
  label: string;
  /** Chart x-axis label. */
  bucket: string;
  tone: AgingBucketDef["tone"];
  count: number;
  amount: number;
}

export interface AgingResult {
  rows: AgingRow[];
  /** Past-due rows only (tiles). */
  pastDue: AgingRow[];
  totalOpen: number;
  totalOverdue: number;
  overdueCount: number;
  /** Weighted average days late across overdue balance. */
  avgDaysLate: number;
  hasData: boolean;
  byKey: Record<AgingKey, AgingRow>;
}

export interface AgingAccessors<T> {
  /** Due date (ISO). Items without one are skipped. */
  due: (item: T) => string | undefined;
  /** Outstanding balance in MGA. Non-positive balances are skipped. */
  balance: (item: T) => number;
  /** Optional: exclude settled / cancelled rows. */
  include?: (item: T) => boolean;
}

/** Bucket a collection of open documents by days past due. */
export function buildAging<T>(items: T[], acc: AgingAccessors<T>, today: Date = new Date()): AgingResult {
  const byKey = Object.fromEntries(
    AGING_BUCKETS.map((b) => [b.key, { key: b.key, label: b.label, bucket: b.short, tone: b.tone, count: 0, amount: 0 }]),
  ) as Record<AgingKey, AgingRow>;

  let totalOpen = 0;
  let totalOverdue = 0;
  let overdueCount = 0;
  let weightedLate = 0;

  for (const item of items) {
    if (acc.include && !acc.include(item)) continue;
    const due = acc.due(item);
    if (!due) continue;
    const bal = acc.balance(item);
    if (!(bal > 0)) continue;
    const late = daysLate(due, today);
    const key = bucketOf(late);
    byKey[key].count++;
    byKey[key].amount += bal;
    totalOpen += bal;
    if (late > 0) {
      totalOverdue += bal;
      overdueCount++;
      weightedLate += bal * late;
    }
  }

  const rows = AGING_BUCKETS.map((b) => byKey[b.key]);
  return {
    rows,
    pastDue: rows.filter((r) => r.key !== "current"),
    totalOpen,
    totalOverdue,
    overdueCount,
    avgDaysLate: totalOverdue > 0 ? weightedLate / totalOverdue : 0,
    hasData: rows.some((r) => r.count > 0),
    byKey,
  };
}

/** Does an item fall in the selected bucket? Used for click-to-filter. */
export function inBucket(dueDate: string | undefined, selected: AgingKey | null, today: Date = new Date()): boolean {
  if (!selected) return true;
  if (!dueDate) return false;
  return bucketOf(daysLate(dueDate, today)) === selected;
}
