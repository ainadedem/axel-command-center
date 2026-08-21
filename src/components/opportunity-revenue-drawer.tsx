import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { FileText, Receipt, ArrowUpRight, Scale } from "lucide-react";
import { fmtCompact, toMGA, type Opportunity } from "@/lib/mock-data";
import { invoicePayable, invoiceBalance } from "@/lib/invoice-money";
import { quotePayable, type OpportunityRollup } from "@/lib/pipeline-link";
import { StatusBadge } from "@/components/status-badge";
import { SignedAmount } from "@/components/signed-amount";
import type { QuoteInvoiceVariance, VarianceLine } from "@/lib/quote-invoice-variance";

/** Drill-down of everything a pipeline deal is linked to. */
export function OpportunityRevenueDrawer({
  opportunity, rollup, variance, open, onOpenChange,
}: {
  opportunity: Opportunity | null;
  rollup: OpportunityRollup | null;
  variance?: QuoteInvoiceVariance | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
        <SheetHeader className="p-5 border-b border-border space-y-1 text-left">
          <SheetTitle className="text-base">{opportunity?.name ?? "Deal"}</SheetTitle>
          <SheetDescription>
            {opportunity ? `${opportunity.client || "—"} · ${opportunity.stage}` : ""}
          </SheetDescription>
        </SheetHeader>

        {opportunity && rollup && (
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Deal value" value={fmtCompact(toMGA(opportunity.value, opportunity.currency), "MGA")} />
              <Metric label="Weighted forecast" value={fmtCompact(rollup.forecast, "MGA")} />
              <Metric label="Quoted" value={fmtCompact(rollup.quoted, "MGA")} />
              <Metric label="Invoiced" value={fmtCompact(rollup.invoiced, "MGA")} />
              <Metric label="Collected" value={fmtCompact(rollup.collected, "MGA")} tone="success" />
              <Metric label="Outstanding" value={fmtCompact(rollup.outstanding, "MGA")} tone={rollup.outstanding > 0 ? "warning" : undefined} />
            </div>

            {variance && (variance.quoted > 0 || variance.invoiced > 0) && (
              <VarianceSection v={variance} />
            )}

            <Section icon={<FileText className="h-3.5 w-3.5" />} title={`Quotations (${rollup.quotes.length})`}>
              {rollup.quotes.length === 0 ? (
                <Empty>No quotation linked to this deal yet.</Empty>
              ) : rollup.quotes.map((q) => (
                <Row
                  key={q.id}
                  to="/quotations"
                  focus={q.id}
                  title={q.number}
                  meta={`${format(parseISO(q.issueDate), "MMM d, yyyy")}`}
                  amount={fmtCompact(toMGA(quotePayable(q), q.currency), "MGA")}
                  badge={<StatusBadge status={q.status} />}
                />
              ))}
            </Section>

            <Section icon={<Receipt className="h-3.5 w-3.5" />} title={`Invoices (${rollup.invoices.length})`}>
              {rollup.invoices.length === 0 ? (
                <Empty>No invoice raised against this deal yet.</Empty>
              ) : rollup.invoices.map((i) => (
                <Row
                  key={i.id}
                  to="/invoices"
                  focus={i.id}
                  title={i.number}
                  meta={`${format(parseISO(i.issueDate), "MMM d, yyyy")}${invoiceBalance(i) > 0 ? ` · ${fmtCompact(toMGA(invoiceBalance(i), i.currency), "MGA")} open` : ""}`}
                  amount={fmtCompact(toMGA(invoicePayable(i), i.currency), "MGA")}
                  badge={<StatusBadge status={i.status} />}
                />
              ))}
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-tnum ${tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">{icon}{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-muted-foreground border border-dashed border-border rounded-lg py-4 text-center">{children}</p>
);

function Row({ to, focus, title, meta, amount, badge }: {
  to: string; focus: string; title: string; meta: string; amount: string; badge: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      search={{ focus }}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-elevated transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium truncate flex items-center gap-1.5">
          {title}
          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
        <div className="text-[11px] text-muted-foreground truncate">{meta}</div>
      </div>
      {badge}
      <div className="text-xs font-tnum shrink-0">{amount}</div>
    </Link>
  );
}

/* ─── Quoted → invoiced variance ─────────────────────────────────── */

function VarianceSection({ v }: { v: QuoteInvoiceVariance }) {
  const signed = (n: number) => (
    <SignedAmount value={n} formatted={`${n > 0 ? "+" : ""}${fmtCompact(n, "MGA")}`} />
  );
  return (
    <Section icon={<Scale className="h-3.5 w-3.5" />} title="Quoted vs invoiced">
      <div className="rounded-lg border border-border bg-surface p-3 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {fmtCompact(v.quoted, "MGA")} quoted → {fmtCompact(v.invoiced, "MGA")} invoiced
          </div>
          <div className="text-sm font-tnum">{signed(v.total)}</div>
        </div>

        <div className="h-1.5 w-full rounded-full bg-surface-elevated overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(100, Math.round(v.invoicedPct * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{Math.round(v.invoicedPct * 100)}% of the quote invoiced</span>
          {v.notInvoiced > 0 && <span>{fmtCompact(v.notInvoiced, "MGA")} not yet invoiced</span>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Bucket label="Scope" value={v.scope} />
          <Bucket label="Price / qty" value={v.priceQty} />
          <Bucket label="FX" value={v.fx} />
        </div>

        {v.partialDetail && (
          <p className="text-[11px] text-muted-foreground">
            Some documents have no line detail — the split below covers only documents with lines.
          </p>
        )}

        {v.missing.length > 0 && (
          <LineGroup title="Quoted, not invoiced" lines={v.missing} tone="destructive" />
        )}
        {v.extra.length > 0 && (
          <LineGroup title="Invoiced, not quoted" lines={v.extra} tone="success" />
        )}
        {v.changed.length > 0 && (
          <LineGroup title="Amount changed" lines={v.changed} />
        )}
        {v.missing.length === 0 && v.extra.length === 0 && v.changed.length === 0 && (
          <p className="text-[11px] text-muted-foreground">Every quoted line matches an invoiced line.</p>
        )}
      </div>
    </Section>
  );
}

function Bucket({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface-elevated px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-tnum">
        <SignedAmount value={value} formatted={`${value > 0 ? "+" : ""}${fmtCompact(value, "MGA")}`} />
      </div>
    </div>
  );
}

function LineGroup({ title, lines, tone }: { title: string; lines: VarianceLine[]; tone?: "success" | "destructive" }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{title}</div>
      {lines.slice(0, 8).map((l) => (
        <div key={l.key} className="flex items-center gap-2 text-[11px] border-t border-border/60 pt-1">
          <div className="min-w-0 flex-1">
            <div className="truncate">{l.description}</div>
            <div className="text-muted-foreground truncate">
              {[...l.quoteNumbers, ...l.invoiceNumbers].join(" · ") || "—"}
              {l.quantityQuoted !== undefined && l.quantityInvoiced !== undefined && l.quantityQuoted !== l.quantityInvoiced
                ? ` · qty ${l.quantityQuoted} → ${l.quantityInvoiced}`
                : ""}
            </div>
          </div>
          <div className={`font-tnum shrink-0 ${tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : ""}`}>
            {l.delta > 0 ? "+" : ""}{fmtCompact(l.delta, "MGA")}
          </div>
        </div>
      ))}
      {lines.length > 8 && (
        <div className="text-[11px] text-muted-foreground">+{lines.length - 8} more</div>
      )}
    </div>
  );
}
