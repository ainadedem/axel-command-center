import { FileText, Receipt } from "lucide-react";
import { fmtCompact } from "@/lib/mock-data";
import type { OpportunityRollup } from "@/lib/pipeline-link";

export type DocSection = "quotes" | "invoices";

/**
 * Compact indicator of the quotations / invoices linked to a deal.
 * Clicking a chip opens the deal drawer on that section — it never bubbles up
 * to the card/row click (which opens the edit dialog).
 */
export function OpportunityDocChips({
  rollup, onOpen, size = "sm", showOutstanding = true, className = "",
}: {
  rollup: OpportunityRollup | undefined;
  onOpen?: (section: DocSection) => void;
  size?: "xs" | "sm";
  showOutstanding?: boolean;
  className?: string;
}) {
  const quotes = rollup?.quotes.length ?? 0;
  const invoices = rollup?.invoices.length ?? 0;
  const outstanding = rollup?.outstanding ?? 0;
  const text = size === "xs" ? "t-micro" : "t-label";
  const icon = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";

  if (!quotes && !invoices) {
    return (
      <span className={`${text} text-muted-foreground/70 inline-flex items-center gap-1 ${className}`}>
        <FileText className={icon} /> No documents
      </span>
    );
  }

  const chip = (section: DocSection, count: number, label: string, Icon: typeof FileText) => (
    <button
      type="button"
      title={`Open ${label}`}
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen?.(section); }}
      className={`${text} inline-flex items-center gap-1 rounded-full border border-border bg-surface-elevated/70 px-1.5 py-0.5 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-surface-elevated transition-colors`}
    >
      <Icon className={icon} />
      <span className="font-tnum">{count}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );

  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {quotes > 0 && chip("quotes", quotes, quotes > 1 ? "quotes" : "quote", FileText)}
      {invoices > 0 && chip("invoices", invoices, invoices > 1 ? "invoices" : "invoice", Receipt)}
      {showOutstanding && outstanding > 0 && (
        <span className={`${text} text-warning font-tnum`}>{fmtCompact(outstanding, "MGA")} open</span>
      )}
    </span>
  );
}
