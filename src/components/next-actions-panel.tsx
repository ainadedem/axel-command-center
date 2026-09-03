/**
 * "Run the business" panel — a prioritised, plain-language to-do list derived
 * from live data, plus the money journey (offer → won → billed → paid).
 *
 * Designed for somebody with no finance background: every item says what to do,
 * why it matters, how much money is involved, and links straight to the screen.
 */
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  useQuotes, useInvoices, usePurchaseOrders, useAccounts, fmtCompact,
} from "@/lib/mock-data";
import { inScope, useCompany } from "@/lib/company-context";
import { buildCycle, buildNextActions, type ActionTone } from "@/lib/next-actions";
import { Explain } from "@/components/explain";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertOctagon, ArrowRight, CheckCircle2, Clock, ListChecks } from "lucide-react";

const money = (n: number) => fmtCompact(n, "MGA");

const TONE: Record<ActionTone, { label: string; dot: string; text: string; icon: typeof Clock }> = {
  urgent: { label: "Do today", dot: "bg-destructive", text: "text-destructive", icon: AlertOctagon },
  attention: { label: "This week", dot: "bg-warning", text: "text-warning", icon: Clock },
  routine: { label: "When you can", dot: "bg-primary", text: "text-primary", icon: ListChecks },
};

export function NextActionsPanel() {
  const { scope } = useCompany();
  const quotes = inScope(useQuotes(), scope);
  const invoices = inScope(useInvoices(), scope);
  const purchaseOrders = inScope(usePurchaseOrders(), scope);
  const accounts = inScope(useAccounts(), scope);

  const actions = useMemo(
    () => buildNextActions({ quotes, invoices, purchaseOrders, accounts }),
    [quotes, invoices, purchaseOrders, accounts],
  );
  const cycle = useMemo(
    () => buildCycle({ quotes, invoices, purchaseOrders }),
    [quotes, invoices, purchaseOrders],
  );

  return (
    <section className="space-y-4">
      {/* Money journey */}
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="t-body font-semibold">How money moves through your business</h2>
          <Explain text="Every deal walks left to right. If a stage is stuck, the stages after it stay empty and cash never arrives." />
        </div>
        <ol className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {cycle.map((stage, idx) => (
            <li key={stage.key}>
              <Link
                to={stage.to}
                className="group flex h-full flex-col gap-1 rounded-lg border border-border/70 bg-surface/60 p-3 transition-all hover-lift press-scale"
              >
                <span className="flex items-center gap-1.5 t-label font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="tabular-nums">{idx + 1}</span>
                  {stage.label}
                  <Explain text={stage.hint} />
                </span>
                <span className="t-subtitle font-semibold tabular-nums">{money(stage.amountMGA)}</span>
                <span className="t-label text-muted-foreground">
                  {stage.count} document{stage.count === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {/* To-do list */}
      <div className="rounded-xl border border-border bg-[var(--gradient-surface)] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="t-body font-semibold">What to do next</h2>
          <Explain text="This list is built from your own data and refreshes on its own. Work from the top: the first items cost you the most money." />
        </div>

        {!actions.length ? (
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface/60 p-4">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            <div>
              <p className="t-body font-medium">Nothing needs you right now</p>
              <p className="t-label text-muted-foreground">
                Every quotation is sent, every accepted deal is invoiced and no invoice is late. Good place to be.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {actions.map((a) => {
              const tone = TONE[a.tone];
              const Icon = tone.icon;
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface/60 p-3 transition-all hover-lift sm:flex-row sm:items-center sm:gap-4"
                >
                  <Icon className={cn("h-4 w-4 shrink-0", tone.text)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="t-body font-medium leading-snug">{a.title}</p>
                      <span className={cn("inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 t-micro font-medium uppercase tracking-wide", tone.text)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                        {tone.label}
                      </span>
                    </div>
                    <p className="t-label text-muted-foreground leading-relaxed">{a.why}</p>
                  </div>
                  {a.amountMGA !== undefined && (
                    <span className="t-body font-semibold tabular-nums shrink-0">{money(a.amountMGA)}</span>
                  )}
                  <Button asChild size="sm" variant="outline" className="shrink-0 press-scale">
                    <Link to={a.to} search={a.search as never}>
                      {a.cta}
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
