import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { FileText, Receipt, ArrowUpRight } from "lucide-react";
import { fmtCompact, toMGA, type Opportunity } from "@/lib/mock-data";
import { invoicePayable, invoiceBalance } from "@/lib/invoice-money";
import { quotePayable, type OpportunityRollup } from "@/lib/pipeline-link";
import { StatusBadge } from "@/components/status-badge";

/** Drill-down of everything a pipeline deal is linked to. */
export function OpportunityRevenueDrawer({
  opportunity, rollup, open, onOpenChange,
}: {
  opportunity: Opportunity | null;
  rollup: OpportunityRollup | null;
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
