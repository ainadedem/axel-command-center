/**
 * Next-step hint — one plain sentence telling the user what this document needs,
 * shown at the top of a quotation / invoice / purchase order detail panel.
 */
import type { Invoice, PurchaseOrder, Quote } from "@/lib/mock-data";
import { invoiceNextStep, poNextStep, quoteNextStep, type DocNextStep } from "@/lib/next-actions";
import { cn } from "@/lib/utils";
import { CheckCircle2, Hourglass, Target } from "lucide-react";

const STYLE = {
  you: { icon: Target, cls: "border-warning/40 bg-warning/10 text-warning", label: "Your move" },
  client: { icon: Hourglass, cls: "border-primary/30 bg-primary/10 text-primary", label: "Waiting on the client" },
  nobody: { icon: CheckCircle2, cls: "border-border bg-surface/70 text-muted-foreground", label: "Nothing to do" },
} as const;

export function NextStepHint({ step, className }: { step: DocNextStep; className?: string }) {
  const s = STYLE[step.waitingOn];
  const Icon = s.icon;
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2", s.cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="t-label font-medium uppercase tracking-wide opacity-80">{s.label}</p>
        <p className="t-label leading-relaxed text-foreground">{step.step}</p>
      </div>
    </div>
  );
}

export const QuoteNextStepHint = ({ quote, invoices, className }: { quote: Quote; invoices: Invoice[]; className?: string }) => (
  <NextStepHint step={quoteNextStep(quote, invoices)} className={className} />
);

export const InvoiceNextStepHint = ({ invoice, className }: { invoice: Invoice; className?: string }) => (
  <NextStepHint step={invoiceNextStep(invoice)} className={className} />
);

export const PoNextStepHint = ({ po, className }: { po: PurchaseOrder; className?: string }) => (
  <NextStepHint step={poNextStep(po)} className={className} />
);
