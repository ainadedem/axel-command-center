// Quotation expiry: quotations that pass their "valid until" date are closed
// automatically so nothing sits open forever, and the ones about to lapse are
// surfaced on the dashboard while there is still time to act.
import { useEffect, useMemo, useRef } from "react";
import { useQuotes, type Quote } from "./mock-data";
import { applyQuoteStatus } from "./quote-status";
import { useAuth } from "./auth-context";

/** Statuses still "live" — anything else is already closed. */
const OPEN_STATUSES = new Set(["draft", "sent"]);

export const isQuoteOpen = (q: Quote) => OPEN_STATUSES.has(q.status);

const today = () => new Date().toISOString().slice(0, 10);

export function daysUntilExpiry(q: Quote, from = today()): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${q.validUntil}T00:00:00`).getTime();
  if (Number.isNaN(b)) return Number.POSITIVE_INFINITY;
  return Math.round((b - a) / 86_400_000);
}

export const isQuoteExpired = (q: Quote, from = today()) =>
  isQuoteOpen(q) && !!q.validUntil && q.validUntil < from;

export interface QuoteExpiryBuckets {
  /** Open quotations already past their validity — closed automatically. */
  lapsed: Quote[];
  /** Open quotations expiring within the window (default 7 days). */
  expiringSoon: Quote[];
}

export function quoteExpiryBuckets(quotes: Quote[], windowDays = 7, from = today()): QuoteExpiryBuckets {
  const lapsed: Quote[] = [];
  const expiringSoon: Quote[] = [];
  for (const q of quotes) {
    if (!isQuoteOpen(q) || !q.validUntil) continue;
    const left = daysUntilExpiry(q, from);
    if (left < 0) lapsed.push(q);
    else if (left <= windowDays) expiringSoon.push(q);
  }
  const byDate = (a: Quote, b: Quote) => a.validUntil.localeCompare(b.validUntil);
  return { lapsed: lapsed.sort(byDate), expiringSoon: expiringSoon.sort(byDate) };
}

/**
 * Watches the scoped quotations, closes the lapsed ones as `expired`
 * (audit trail and notifications come from `applyQuoteStatus`) and returns
 * what is about to lapse. Each quotation is only closed once per session;
 * a refused write rolls back through the usual status guard.
 */
export function useQuoteExpiry(scopedQuotes: Quote[], windowDays = 7) {
  const { user } = useAuth();
  const handled = useRef(new Set<string>());

  const buckets = useMemo(() => quoteExpiryBuckets(scopedQuotes, windowDays), [scopedQuotes, windowDays]);

  useEffect(() => {
    for (const q of buckets.lapsed) {
      if (handled.current.has(q.id)) continue;
      handled.current.add(q.id);
      applyQuoteStatus(q, "expired", { userId: user?.id, silent: true });
    }
  }, [buckets.lapsed, user?.id]);

  /** Recently expired quotations, still worth a reminder. */
  const recentlyExpired = useMemo(
    () =>
      scopedQuotes
        .filter((q) => q.status === "expired" && daysUntilExpiry(q) >= -30)
        .sort((a, b) => b.validUntil.localeCompare(a.validUntil)),
    [scopedQuotes],
  );

  return { ...buckets, recentlyExpired };
}

/** Convenience hook over every quotation in the store. */
export function useAllQuoteExpiry(windowDays = 7) {
  return useQuoteExpiry(useQuotes(), windowDays);
}
