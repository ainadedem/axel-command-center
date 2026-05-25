import { DocumentPreview, type DocumentData } from "./document-preview";
import type { Invoice, Company, Client, Project, PurchaseOrder, Quote } from "@/lib/mock-data";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice | null;
  company?: Company;
  client?: Client;
  project?: Project;
  po?: PurchaseOrder;
  quote?: Quote;
}

/** Thin wrapper for backward compatibility — delegates to <DocumentPreview>. */
export function InvoicePreview({ open, onOpenChange, invoice, company, client, project, po, quote }: Props) {
  const doc: DocumentData | null = invoice
    ? {
        kind: "invoice",
        number: invoice.number,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        amount: invoice.amount,
        paid: invoice.paid,
        currency: invoice.currency,
        lines: invoice.lines ?? po?.lines ?? quote?.lines,
        references: [
          po?.number ? { label: "PO", value: po.number } : null,
          quote?.number ? { label: "Quote", value: quote.number } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>,
      }
    : null;
  return (
    <DocumentPreview open={open} onOpenChange={onOpenChange} doc={doc} company={company} client={client} project={project} />
  );
}
