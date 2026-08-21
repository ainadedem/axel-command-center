/**
 * Unlink a bank transaction from an invoice.
 *
 * Removing a payment link is an auditable act: it is confirmed explicitly,
 * recorded in the invoice's verification history with a reason, and can be
 * undone for 10 seconds. Only the link is removed — the transaction, the
 * invoice figures, the quotation and the PO are untouched.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fmtFull, transactionsStore, useTransactions, useQuotes, usePurchaseOrders,
  type Invoice, type Currency,
} from "@/lib/mock-data";
import { buildPaymentProof, type ProofInvoice, type ProofTransaction } from "@/lib/payment-proof";
import { logPaymentUnlinked } from "@/lib/payment-audit";
import { withoutHistory } from "@/lib/history";

const money = (v: number, c: string) => fmtFull(v, c as Currency);

const VERDICT_LABEL: Record<string, string> = {
  verified: "Verified",
  installment: "Part-paid",
  partial: "Partly matched",
  unverified: "Unverified",
  "n/a": "Not applicable",
};

export function PaymentUnlinkDialog({
  open,
  onOpenChange,
  invoice,
  transaction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice;
  transaction: ProofTransaction;
}) {
  const transactions = useTransactions();
  const quotes = useQuotes();
  const pos = usePurchaseOrders();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // What the verdict becomes once this receipt no longer counts as evidence.
  const after = buildPaymentProof(
    invoice as unknown as ProofInvoice,
    (transactions as unknown as ProofTransaction[]).filter((t) => t.id !== transaction.id) as never,
    quotes as never,
    pos as never,
  );

  const confirm = async () => {
    setBusy(true);
    const before = { invoiceId: transaction.invoiceId };
    const why = reason.trim() || "no reason given";

    await withoutHistory(async () => {
      transactionsStore.update(transaction.id, { invoiceId: undefined });
    });

    logPaymentUnlinked(
      { invoiceId: invoice.id, invoiceNumber: invoice.number, companyId: invoice.companyId },
      {
        transactionId: transaction.id,
        transactionDate: transaction.date,
        transactionAmount: transaction.amount,
        transactionCurrency: transaction.currency,
        reason: why,
        source: "manual",
      },
    );

    setBusy(false);
    setReason("");
    onOpenChange(false);
    toast.success("Payment unlinked", {
      duration: 10_000,
      description: `${invoice.number} is now ${VERDICT_LABEL[after.verification] ?? after.verification}.`,
      action: {
        label: "Undo",
        onClick: () => {
          void withoutHistory(async () => {
            transactionsStore.update(transaction.id, { invoiceId: before.invoiceId ?? invoice.id });
          });
          toast.message("Payment link restored");
        },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Unlink this payment?</DialogTitle>
          <DialogDescription>
            The bank transaction stays in your books — only the evidence link to this invoice is removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-border bg-[var(--surface-container)] p-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">Invoice {invoice.number}</span>
              <span className="font-tnum text-muted-foreground">
                {money(invoice.amount, invoice.currency)}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2">
              <span className="min-w-0 truncate text-muted-foreground" title={transaction.description}>
                {transaction.date} · {transaction.description}
              </span>
              <span className="shrink-0 font-tnum text-muted-foreground">
                {money(transaction.amount, transaction.currency)}
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            After unlinking, this invoice becomes{" "}
            <span className="font-medium text-warning">
              {VERDICT_LABEL[after.verification] ?? after.verification}
            </span>
            . Its recorded paid amount is not changed — the badge is what tells you the money is no
            longer evidenced.
          </p>

          <div className="space-y-1.5">
            <label htmlFor="unlink-reason" className="text-xs text-muted-foreground">
              Reason (optional)
            </label>
            <Input
              id="unlink-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. wrong client, matched the wrong receipt"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            Unlink payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
