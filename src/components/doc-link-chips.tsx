import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, FileCheck2, ReceiptText, FileText, HelpCircle, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtCompact, type Currency } from "@/lib/mock-data";
import type { QuoteInvoiceLink } from "@/lib/quote-accept";
import type { LinkSource } from "@/lib/doc-number-link";

const base =
  "inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 t-micro font-medium leading-none transition-colors";

const tones = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  muted: "border-border bg-surface text-muted-foreground",
  link: "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10",
} as const;

/** Inferred links are drawn with a dashed outline so they read as "not confirmed". */
const inferred = "border-dashed";

export function DocChip({
  icon: Icon,
  label,
  tone = "muted",
  title,
  to,
  focusId,
  onClick,
  source = "stored",
  onConfirm,
}: {
  icon: typeof FileText;
  label: string;
  tone?: keyof typeof tones;
  title?: string;
  to?: "/invoices" | "/quotations" | "/purchase-orders";
  focusId?: string;
  onClick?: () => void;
  source?: LinkSource;
  /** Shown next to an inferred chip: writes the real link. */
  onConfirm?: () => void;
}) {
  const dashed = source === "number" ? inferred : "";
  const fullTitle = source === "number" ? `${title ?? label} — matched by number, not confirmed` : (title ?? label);
  const inner = (
    <>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </>
  );

  const chip =
    to && focusId ? (
      <Link
        to={to}
        search={{ focus: focusId } as never}
        title={fullTitle}
        onClick={(e) => e.stopPropagation()}
        className={cn(base, tones.link, dashed)}
      >
        {inner}
      </Link>
    ) : onClick ? (
      <button type="button" title={fullTitle} onClick={(e) => { e.stopPropagation(); onClick(); }} className={cn(base, tones[tone], dashed)}>
        {inner}
      </button>
    ) : (
      <span title={fullTitle} className={cn(base, tones[tone], dashed)}>{inner}</span>
    );

  if (source === "number" && onConfirm) {
    return (
      <span className="inline-flex items-center gap-1">
        {chip}
        <button
          type="button"
          title="Confirm this link so it is stored on the document"
          onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          className={cn(base, tones.muted, "hover:text-foreground press-scale")}
        >
          <Link2 className="h-3 w-3" aria-hidden="true" />
          <span className="truncate">Confirm</span>
        </button>
      </span>
    );
  }
  return chip;
}

/** Several documents carry the same number — a person has to choose. */
export function AmbiguousChip({ count, what, className }: { count: number; what: string; className?: string }) {
  return (
    <span className={className}>
      <DocChip
        icon={HelpCircle}
        label={`${count} possible ${what}`}
        tone="warn"
        title={`This number matches ${count} ${what} — open the document and pick the right one`}
      />
    </span>
  );
}

/** "Was this quotation invoiced?" — shown on quotation rows and cards. */
export function QuoteInvoiceChip({
  link,
  currency,
  status,
  className,
  onConfirm,
}: {
  link: QuoteInvoiceLink;
  currency: Currency;
  status: string;
  className?: string;
  onConfirm?: () => void;
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
          source={link.source}
          onConfirm={onConfirm}
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
          source={link.source}
          onConfirm={onConfirm}
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
  quoteSource = "stored",
  onConfirmQuote,
  quoteAmbiguous = 0,
  poId,
  poNumber,
  poSource = "stored",
  onConfirmPo,
  poAmbiguous = 0,
  poWaived,
  className,
}: {
  quoteId?: string;
  quoteNumber?: string;
  quoteSource?: LinkSource;
  onConfirmQuote?: () => void;
  quoteAmbiguous?: number;
  poId?: string;
  poNumber?: string;
  poSource?: LinkSource;
  onConfirmPo?: () => void;
  poAmbiguous?: number;
  poWaived?: boolean;
  className?: string;
}) {
  const hasAny =
    (quoteId && quoteNumber) || (poId && poNumber) || poWaived || quoteAmbiguous > 0 || poAmbiguous > 0;
  if (!hasAny) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {quoteId && quoteNumber && (
        <DocChip
          icon={FileText}
          label={quoteNumber}
          title={`Source quotation ${quoteNumber}`}
          to="/quotations"
          focusId={quoteId}
          source={quoteSource}
          onConfirm={onConfirmQuote}
        />
      )}
      {!quoteId && quoteAmbiguous > 1 && <AmbiguousChip count={quoteAmbiguous} what="quotations" />}
      {poId && poNumber && (
        <DocChip
          icon={FileCheck2}
          label={poNumber}
          title={`Purchase order ${poNumber}`}
          to="/purchase-orders"
          focusId={poId}
          source={poSource}
          onConfirm={onConfirmPo}
        />
      )}
      {!poId && poAmbiguous > 1 && <AmbiguousChip count={poAmbiguous} what="purchase orders" />}
      {!poId && poWaived && <DocChip icon={AlertTriangle} label="PO waived" tone="warn" title="Invoice approved without a client PO" />}
    </span>
  );
}
