import { CalendarClock, TimerReset } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCompany, inScope } from "@/lib/company-context";
import { useQuotes, quotesStore, fmt, type Quote } from "@/lib/mock-data";
import { useQuoteExpiry, daysUntilExpiry } from "@/lib/quote-expiry";
import { applyQuoteStatus } from "@/lib/quote-status";
import { useAuth } from "@/lib/auth-context";
import { docDeepLink } from "@/hooks/use-focus-row";
import { cn } from "@/lib/utils";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * Dashboard reminder: quotations lapsing in the next week and the ones that
 * just expired, each with the three actions that resolve them.
 */
export function QuoteExpiryCard({ windowDays = 7 }: { windowDays?: number }) {
  const { scope } = useCompany();
  const { user } = useAuth();
  const scoped = inScope(useQuotes(), scope);
  const { expiringSoon, recentlyExpired } = useQuoteExpiry(scoped, windowDays);

  const rows = [...expiringSoon, ...recentlyExpired.slice(0, 5)];
  if (rows.length === 0) return null;

  const extend = (q: Quote) => {
    const base = q.validUntil < new Date().toISOString().slice(0, 10)
      ? new Date().toISOString().slice(0, 10)
      : q.validUntil;
    quotesStore.update(q.id, { validUntil: addDays(base, 30) });
    if (q.status === "expired") applyQuoteStatus(q, "sent", { userId: user?.id });
    toast.success(`${q.number} extended by 30 days.`);
  };

  return (
    <section className="panel p-4 space-y-3">
      <header className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <h2 className="t-body font-medium">Quotations to chase</h2>
        <span className="t-label text-muted-foreground">
          {expiringSoon.length} expiring soon · {recentlyExpired.length} expired
        </span>
      </header>
      <ul className="divide-y divide-border/50">
        {rows.map((q) => {
          const left = daysUntilExpiry(q);
          const expired = q.status === "expired" || left < 0;
          return (
            <li key={q.id} className="flex flex-wrap items-center gap-2 py-2">
              <a href={docDeepLink("/quotations", q.id)} className="t-body font-medium hover:underline">
                {q.number}
              </a>
              <span className="t-label tabular-nums text-muted-foreground">{fmt(q.amount, q.currency)}</span>
              <span className={cn("t-label", expired ? "text-destructive" : "text-muted-foreground")}>
                {expired
                  ? `expired ${Math.abs(left)}d ago`
                  : left === 0 ? "expires today" : `expires in ${left}d`}
              </span>
              <span className="flex-1" />
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 t-label" onClick={() => extend(q)}>
                <TimerReset className="h-3.5 w-3.5" /> Extend 30d
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 t-label"
                onClick={() => applyQuoteStatus(q, "accepted", { userId: user?.id })}
              >
                Accepted
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 t-label text-muted-foreground"
                onClick={() => applyQuoteStatus(q, "rejected", { userId: user?.id })}
              >
                Close
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
