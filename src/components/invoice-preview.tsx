import { useState } from "react";
import { toast } from "sonner";
import { DocumentPreview, type DocumentData } from "./document-preview";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { planStatusChange, commitStatusChange } from "@/lib/invoice-status";
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
  const [markPaid, setMarkPaid] = useState(false);

  const handleStatusChange = (next: string) => {
    if (!invoice) return;
    const status = next as Invoice["status"];
    let reason: string | undefined;
    if (status === "cancelled") {
      const input = window.prompt("Reason for cancelling this invoice?", invoice.cancellationReason ?? "");
      if (input == null) return;
      reason = input.trim();
      if (!reason) { toast.error("A cancellation reason is required."); return; }
    }
    const plan = planStatusChange(invoice, status, { reason });
    if (plan.requiresPayment) {
      // Never flip to "paid" without a recorded payment — capture it first.
      setMarkPaid(true);
      return;
    }
    if (plan.requiresReason) { toast.error("A cancellation reason is required."); return; }
    const committed = commitStatusChange(invoice, plan);
    toast.success(`${invoice.number} · ${invoice.status} → ${status}`, {
      description: committed.diff,
      duration: 10000,
      action: { label: "Undo", onClick: () => { void committed.revert(); } },
    });
  };

  return (
    <>
    <DocumentPreview
      open={open} onOpenChange={onOpenChange} doc={doc}
      company={company} client={client} project={project}
      signers={users.map((u) => ({ userId: u.userId, name: u.name }))}
      statusOptions={["draft", "sent", "partial", "paid", "overdue", "cancelled"]}
      onDocChange={(patch) => { if (invoice) invoicesStore.update(invoice.id, patch as Partial<Invoice>); }}
      onStatusChange={handleStatusChange}
      audit={invoice ? { docType: "invoice", docId: invoice.id, companyId: invoice.companyId } : undefined}
    />
    <MarkPaidDialog open={markPaid} onOpenChange={setMarkPaid} invoice={invoice} />
    </>
  );
}
