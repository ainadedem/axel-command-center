import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FileCheck2, ReceiptText, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCompact, type Currency } from "@/lib/mock-data";
import type { QuoteInvoiceLink } from "@/lib/quote-accept";

const base =
  "inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none transition-colors";

const tones = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  muted: "border-border bg-surface text-muted-foreground",
  link: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
} as const;

export function DocChip({
  icon: Icon,
  label,
  tone = "muted",
  title,
  to,
  focusId,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  tone?: keyof typeof tones;
  title?: string;
  to?: "/invoices" | "/quotations" | "/purchase-orders";
  focusId?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  );
  if (to && focusId) {
    return (
      <Link
        to={to}
        search={{ focus: focusId } as never}
        title={title ?? label}
        onClick={(e) => e.stopPropagation()}
        className={cn(base, tones.link)}
      >
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" title={title ?? label} onClick={(e) => { e.stopPropagation(); onClick(); }} className={cn(base, tones[tone])}>
        {inner}
      </button>
    );
  }
  return <span title={title ?? label} className={cn(base, tones[tone])}>{inner}</span>;
}

/** "Was this quotation invoiced?" — shown on quotation rows and cards. */
export function QuoteInvoiceChip({
  link,
  currency,
  status,
  className,
}: {
  link: QuoteInvoiceLink;
  currency: Currency;
  status: string;
  className?: string;
}) {
  const first = link.invoices[0];
  if (link.state === "invoiced" && first) {
    return (
      <span className={className}>
        <DocChip
          icon={CheckCircle2}
          label={link.invoices.length > 1 ? `${link.invoices.length} invoices` : first.number}
          tone="ok"
          title={`Invoiced: ${link.invoices.map((i) => i.number).join(", ")}`}
          to="/invoices"
          focusId={first.id}
        />
      </span>
    );
  }
  if (link.state === "partial" && first) {
    return (
      <span className={className}>
        <DocChip
          icon={ReceiptText}
          label={`${fmtCompact(link.invoiced, currency)} / ${fmtCompact(link.quoted, currency)}`}
          tone="warn"
          title={`Partially invoiced: ${link.invoices.map((i) => i.number).join(", ")}`}
          to="/invoices"
          focusId={first.id}
        />
      </span>
    );
  }
  if (status === "accepted") {
    return (
      <span className={className}>
        <DocChip icon={AlertTriangle} label="Not invoiced" tone="warn" title="Accepted but no invoice raised yet" />
      </span>
    );
  }
  return null;
}

/** Back-links from an invoice to its source quotation and purchase order. */
export function InvoiceSourceChips({
  quoteId,
  quoteNumber,
  poId,
  poNumber,
  poWaived,
  className,
}: {
  quoteId?: string;
  quoteNumber?: string;
  poId?: string;
  poNumber?: string;
  poWaived?: boolean;
  className?: string;
}) {
  const hasAny = (quoteId && quoteNumber) || (poId && poNumber) || poWaived;
  if (!hasAny) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {quoteId && quoteNumber && (
        <DocChip icon={FileText} label={quoteNumber} title={`Source quotation ${quoteNumber}`} to="/quotations" focusId={quoteId} />
      )}
      {poId && poNumber && (
        <DocChip icon={FileCheck2} label={poNumber} title={`Purchase order ${poNumber}`} to="/purchase-orders" focusId={poId} />
      )}
      {!poId && poWaived && <DocChip icon={AlertTriangle} label="PO waived" tone="warn" title="Invoice approved without a client PO" />}
    </span>
  );
}
