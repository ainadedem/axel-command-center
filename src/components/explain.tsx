/**
 * Explain — a small "what does this mean?" hint next to business jargon.
 *
 * The glossary lives here so the same wording is used everywhere in the app.
 */
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const GLOSSARY: Record<string, string> = {
  quotation: "A price offer you send to a client. It is not money yet — the client still has to say yes.",
  "purchase order": "The client's written order confirming they will pay. Usually a PDF they send you.",
  invoice: "The bill you send after the client agreed. Payment is only due once an invoice is sent.",
  receivables: "Money clients owe you: invoices sent but not yet paid.",
  payables: "Money you owe others: supplier bills not yet paid.",
  overdue: "The payment date has passed and the client still has not paid.",
  aging: "How long invoices have been unpaid, grouped by number of days late.",
  reconciliation: "Comparing your bank statement with Axel, line by line, to prove the balance is correct.",
  "opening balance": "How much was in the account on the day you started using Axel.",
  vat: "Tax added on top of your price. You collect it from the client and pass it to the state.",
  "conversion gap": "Work you have won or offered that has not turned into an invoice yet.",
  "payment terms": "How many days the client has to pay after the invoice date.",
  "cash flow": "The money actually moving in and out of your bank accounts.",
  pipeline: "Deals you are still trying to win, before any quotation is accepted.",
};

interface ExplainProps {
  /** Glossary key, or free-text explanation via `text`. */
  term?: string;
  text?: string;
  children?: ReactNode;
  className?: string;
}

/** Inline help icon. Wrap a label with it, or use it standalone. */
export function Explain({ term, text, children, className }: ExplainProps) {
  const body = text ?? (term ? GLOSSARY[term.toLowerCase()] : undefined);
  if (!body) return <>{children}</>;
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={term ? `What does ${term} mean?` : "More information"}
            className="text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:text-foreground"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
          {body}
        </TooltipContent>
      </Tooltip>
      </TooltipProvider>
    </span>
  );
}
