/**
 * Payment matching review dialog.
 *
 * Proposes bank transactions for invoices that record a payment without a
 * linked transaction. Nothing is written until the user confirms: each row is
 * accepted or rejected individually, and the whole batch can be undone for 10s.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fmtFull, invoicesStore, transactionsStore,
  useTransactions, useQuotes, usePurchaseOrders, useClients, useInvoices,
  type Invoice,
  type Currency,
} from "@/lib/mock-data";
const money = (v: number, c: string) => fmtFull(v, c as Currency);

import { invoicePayable } from "@/lib/invoice-money";
import {
  proposeMatches, proposeMatchesForTransaction, buildPaymentProof,
  type MatchProposal, type ProofInvoice, type ProofTransaction,
} from "@/lib/payment-proof";
import { logPaymentVerified, logPaymentReviewed, logPaymentUnlinked } from "@/lib/payment-audit";
import { withoutHistory } from "@/lib/history";

const toneOf = (c: string) =>
  c === "high" ? "text-success" : c === "medium" ? "text-warning" : "text-muted-foreground";

export function PaymentMatchDialog({
  open,
  onOpenChange,
  invoices,
  transaction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Invoices to review — a single invoice, a bulk selection, or the whole list. */
  invoices: Invoice[];
  /** Transaction-seeded mode: propose the invoices this receipt could settle. */
  transaction?: ProofTransaction;
}) {
  const allInvoices = useInvoices();
  const transactions = useTransactions();
  const quotes = useQuotes();
  const pos = usePurchaseOrders();
  const clients = useClients();
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const proposals: MatchProposal[] = useMemo(() => {
    if (!open) return [];
    if (transaction) {
      return proposeMatchesForTransaction({
        transaction,
        invoices: allInvoices as unknown as ProofInvoice[],
        transactions: transactions as never,
        quotes: quotes as never,
        pos: pos as never,
        clientName: (id) => clients.find((c) => c.id === id)?.name,
        clientTerms: (id) => clients.find((c) => c.id === id)?.paymentTermsDays,
      }).map((m) => ({ invoice: m.invoice, candidates: [m.candidate], best: m.candidate }));
    }
    const ids = new Set(invoices.map((i) => i.id));
    const scope = allInvoices.filter((i) => ids.has(i.id));
    return proposeMatches({
      invoices: scope as unknown as ProofInvoice[],
      transactions: transactions as never,
      quotes: quotes as never,
      pos: pos as never,
      clientName: (id) => clients.find((c) => c.id === id)?.name,
      clientTerms: (id) => clients.find((c) => c.id === id)?.paymentTermsDays,
    });
  }, [open, invoices, allInvoices, transactions, quotes, pos, clients, transaction]);

  useEffect(() => {
    if (!open) return;
    const next: Record<string, boolean> = {};
    for (const p of proposals) next[p.invoice.id] = !transaction && p.best.confidence === "high";
    setAccepted(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposals.length]);

  const selectedCount = proposals.filter((p) => accepted[p.invoice.id]).length;

  const apply = async () => {
    const picked = proposals.filter((p) => accepted[p.invoice.id]);
    if (picked.length === 0) return;
    setBusy(true);

    const reverts: Array<() => void> = [];

    for (const p of picked) {
      const inv = allInvoices.find((i) => i.id === p.invoice.id);
      if (!inv) continue;
      const tx = p.best.transaction;

      const txBefore = { invoiceId: tx.invoiceId, clientId: tx.clientId };
      const invBefore: Partial<Invoice> = {
        paidDate: inv.paidDate,
        quoteId: inv.quoteId,
        poId: inv.poId,
      };

      const invPatch: Partial<Invoice> = { paidDate: inv.paidDate ?? tx.date };
      if (!inv.quoteId && p.suggestedQuote) invPatch.quoteId = p.suggestedQuote.id;
      if (!inv.poId && p.suggestedPo) invPatch.poId = p.suggestedPo.id;

      await withoutHistory(async () => {
        transactionsStore.update(tx.id, {
          invoiceId: inv.id,
          clientId: tx.clientId ?? inv.clientId,
          projectId: (tx as { projectId?: string }).projectId ?? inv.projectId,
          category: tx.category || "Encaissements clients",
        });
        invoicesStore.update(inv.id, invPatch);
      });

      const outstanding = buildPaymentProof(
        inv as unknown as ProofInvoice, transactions as never, quotes as never, pos as never,
      ).outstanding;

      logPaymentVerified(
        { invoiceId: inv.id, invoiceNumber: inv.number, companyId: inv.companyId },
        {
          transactionId: tx.id,
          transactionDate: tx.date,
          transactionAmount: tx.amount,
          transactionCurrency: tx.currency,
          transactionDescription: tx.description,
          reasons: p.best.reasons,
          confidence: p.best.confidence,
          score: p.best.score,
          amountDelta: p.best.amountDelta,
          dayGap: p.best.dayGap,
          targetAmount: outstanding || invoicePayable(inv),
          quoteLinked: invPatch.quoteId ?? null,
          poLinked: invPatch.poId ?? null,
        },
        transaction ? "transaction" : accepted[p.invoice.id] && p.best.confidence === "high" ? "auto" : "manual",
      );

      reverts.push(() => {
        void withoutHistory(async () => {
          transactionsStore.update(tx.id, txBefore);
          invoicesStore.update(inv.id, invBefore);
        });
        logPaymentUnlinked(
          { invoiceId: inv.id, invoiceNumber: inv.number, companyId: inv.companyId },
          {
            transactionId: tx.id,
            transactionDate: tx.date,
            transactionAmount: tx.amount,
            transactionCurrency: tx.currency,
            reason: "undone by the user",
            source: "undo",
          },
        );
      });
    }

    for (const p of proposals) {
      if (accepted[p.invoice.id]) continue;
      const inv = allInvoices.find((i) => i.id === p.invoice.id);
      if (!inv) continue;
      logPaymentReviewed(
        { invoiceId: inv.id, invoiceNumber: inv.number, companyId: inv.companyId },
        {
          candidates: p.candidates.length,
          bestConfidence: p.best.confidence,
          bestTransactionId: p.best.transaction.id,
        },
      );
    }

    setBusy(false);
    onOpenChange(false);
    toast.success(`${picked.length} payment${picked.length > 1 ? "s" : ""} linked`, {
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: () => {
          reverts.forEach((r) => r());
          toast.message("Payment links reverted");
        },
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Match payments to bank transactions</DialogTitle>
          <DialogDescription>
            {transaction
              ? "Invoices this bank receipt could settle, scored against what is still outstanding on each. Review before confirming."
              : "Proposed links between invoices marked paid and unlinked income transactions. Review each one — nothing is written until you confirm."}
          </DialogDescription>
        </DialogHeader>

        {proposals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No candidate bank transaction found for the selected invoice(s).
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{proposals.length} proposal{proposals.length > 1 ? "s" : ""}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setAccepted((prev) => {
                    const next = { ...prev };
                    for (const p of proposals) if (p.best.confidence === "high") next[p.invoice.id] = true;
                    return next;
                  })
                }
              >
                Accept all high confidence
              </Button>
            </div>

            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {proposals.map((p) => {
                const c = p.best;
                return (
                  <label
                    key={p.invoice.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors hover:bg-[var(--surface-container)]"
                  >
                    <Checkbox
                      checked={!!accepted[p.invoice.id]}
                      onCheckedChange={(v) =>
                        setAccepted((prev) => ({ ...prev, [p.invoice.id]: v === true }))
                      }
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm">
                        <span className="font-medium">{p.invoice.number}</span>
                        <span className="font-tnum text-muted-foreground">
                          {money(invoicePayable(p.invoice), p.invoice.currency)}
                        </span>
                        <span className={`text-xs ${toneOf(c.confidence)}`}>{c.confidence} confidence</span>
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {c.transaction.date} · {c.transaction.description} ·{" "}
                        <span className="font-tnum">
                          {money(c.transaction.amount, c.transaction.currency)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.reasons.join(" · ")}
                        {c.amountDelta > 1 &&
                          ` · delta ${money(c.amountDelta, p.invoice.currency)}`}
                        {p.suggestedQuote && ` · will link quotation ${p.suggestedQuote.number}`}
                        {p.suggestedPo && ` · will link PO ${p.suggestedPo.number}`}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={apply} disabled={busy || selectedCount === 0}>
            Link {selectedCount || ""} payment{selectedCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
