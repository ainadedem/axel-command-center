import { DocumentPreview, type DocumentData } from "./document-preview";
import { invoicesStore, type Invoice, type Company, type Client, type Project, type PurchaseOrder, type Quote } from "@/lib/mock-data";
import { useCompanySalesUsers } from "@/hooks/use-company-users";
import { invoicePayable } from "@/lib/invoice-money";


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
        subject: invoice.subject,
        bankAccountId: invoice.bankAccountId,
        status: invoice.status,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        paidDate: invoice.paidDate,
        amount: invoice.amount,
        paid: invoice.paid,
        cancelledAt: invoice.cancelledAt,
        cancellationReason: invoice.cancellationReason,
        currency: invoice.currency,
        lines: invoice.lines ?? po?.lines ?? quote?.lines,
        discountPct: invoice.discountPct,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        totalAmount: invoicePayable(invoice),

        references: [
          po?.number ? { label: "PO", value: po.number } : null,
          quote?.number ? { label: "Quote", value: quote.number } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>,
        signerId: invoice.signerId ?? invoice.updatedBy ?? invoice.createdBy,
        stampX: invoice.stampX,
        stampY: invoice.stampY,
        stampScale: invoice.stampScale,
      }
    : null;
  const { users } = useCompanySalesUsers(invoice?.companyId);
  return (
    <DocumentPreview
      open={open} onOpenChange={onOpenChange} doc={doc}
      company={company} client={client} project={project}
      signers={users.map((u) => ({ userId: u.userId, name: u.name }))}
      statusOptions={["draft", "sent", "partial", "paid", "overdue", "cancelled"]}
      onDocChange={(patch) => { if (invoice) invoicesStore.update(invoice.id, patch as Partial<Invoice>); }}
      audit={invoice ? { docType: "invoice", docId: invoice.id, companyId: invoice.companyId } : undefined}
    />
  );
}
