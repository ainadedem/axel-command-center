import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { FileCheck2, ReceiptText } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth-context";
import { applyQuoteStatus } from "@/lib/quote-status";
import { withoutHistory } from "@/lib/history";
import { nextNumber, primeNumbering } from "@/lib/numbering";
import {
  acceptTermsDays, createFromAcceptedQuote, quoteInvoiceLink,
  recordAcceptance, recordAcceptanceRedone, recordAcceptanceUndone,
} from "@/lib/quote-accept";
import {
  invoicesStore, purchaseOrdersStore, useClients, useInvoices, usePurchaseOrders,
  fmtCompact, type Quote,
} from "@/lib/mock-data";

/**
 * Confirmation step for "quotation accepted": previews the purchase order and
 * invoice that will be created from the quote, then creates the ones the user
 * keeps ticked — as drafts, linked back to the quotation.
 */
export function useAcceptQuote() {
  const { user } = useAuth();
  const clients = useClients();
  const invoices = useInvoices();
  const pos = usePurchaseOrders();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [invNumber, setInvNumber] = useState("");
  const [makePo, setMakePo] = useState(true);
  const [makeInvoice, setMakeInvoice] = useState(true);
  const [busy, setBusy] = useState(false);

  const client = quote ? clients.find((c) => c.id === quote.clientId) : undefined;
  const link = quote ? quoteInvoiceLink(quote, invoices) : null;
  const existingPo = quote ? pos.find((p) => p.quoteId === quote.id && p.status !== "cancelled") : undefined;
  const alreadyInvoiced = !!link && link.state !== "not-invoiced";

  useEffect(() => {
    if (!quote) return;
    let cancelled = false;
    setMakePo(!existingPo);
    setMakeInvoice(!alreadyInvoiced);
    void (async () => {
      await primeNumbering("po", quote.companyId);
      await primeNumbering("invoice", quote.companyId);
      if (cancelled) return;
      setPoNumber(nextNumber("po", quote.companyId));
      setInvNumber(nextNumber("invoice", quote.companyId));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.id]);

  const request = (q: Quote) => setQuote(q);

  const confirm = async () => {
    if (!quote) return;
    setBusy(true);
    try {
      const result = createFromAcceptedQuote({
        quote, client, makePo, makeInvoice,
        poNumber, invoiceNumber: invNumber,
        existingPoId: existingPo?.id, userId: user?.id,
      });
      const { poId, invoiceId, created } = result;
      const status = applyQuoteStatus(quote, "accepted", { userId: user?.id, silent: true });
      // Audit trail + notifications for the whole automation, in one place.
      recordAcceptance({ quote, client, result });

      toast.success(
        created.length ? `${quote.number} accepted \u00b7 ${created.join(" \u00b7 ")} created as drafts` : `${quote.number} accepted`,
        {
          duration: 10000,
          action: {
            label: "Undo",
            onClick: () => {
              void withoutHistory(() => {
                if (invoiceId) invoicesStore.remove(invoiceId);
                if (poId && !existingPo) purchaseOrdersStore.remove(poId);
              });
              status.revert();
              recordAcceptanceUndone({ quote, result });
              toast("Acceptance undone", {
                description: created.length
                  ? `${created.join(" \u00b7 ")} removed. The team was told.`
                  : "The quotation is back to its previous status.",
                action: {
                  label: "Redo",
                  onClick: () => {
                    const redone = createFromAcceptedQuote({
                      quote, client, makePo, makeInvoice,
                      poNumber, invoiceNumber: invNumber,
                      existingPoId: existingPo?.id, userId: user?.id,
                    });
                    applyQuoteStatus(quote, "accepted", { userId: user?.id, silent: true });
                    recordAcceptanceRedone({ quote, result: redone });
                  },
                },
              });
            },
          },
        },
      );
      setQuote(null);
    } finally {
      setBusy(false);
    }
  };

  const totals = quote
    ? {
        subtotal: quote.amount,
        tax: quote.taxAmount ?? 0,
        total: quote.totalAmount ?? quote.amount + (quote.taxAmount ?? 0),
      }
    : null;
  const terms = acceptTermsDays(client, quote?.currency);

  const dialog = (
    <Dialog open={!!quote} onOpenChange={(v) => { if (!v && !busy) setQuote(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Accept {quote?.number}</DialogTitle>
          <DialogDescription>
            These documents will be created as drafts from the quotation and linked back to it.
          </DialogDescription>
        </DialogHeader>

        {quote && totals && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-surface p-3 space-y-1 text-xs">
              <Row label="Client" value={client?.displayName || client?.name || "—"} />
              <Row label="Currency" value={quote.currency} />
              <Row label="Subtotal" value={fmtCompact(totals.subtotal, quote.currency)} mono />
              <Row label={`VAT ${quote.taxRate ? `${quote.taxRate}%` : ""}`.trim()} value={fmtCompact(totals.tax, quote.currency)} mono />
              <Row label="Payable total" value={fmtCompact(totals.total, quote.currency)} mono strong />
              <Row label="Lines copied" value={String(quote.lines?.length ?? 0)} mono />
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover-lift">
              <Checkbox checked={makePo} onCheckedChange={(v) => setMakePo(v === true)} className="mt-0.5" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium"><FileCheck2 className="h-3.5 w-3.5" /> Purchase order {poNumber}</span>
                <span className="block text-xs text-muted-foreground">
                  {existingPo
                    ? `A purchase order (${existingPo.number}) already exists for this quotation.`
                    : "Draft PO with the same client, lines and amount."}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover-lift">
              <Checkbox checked={makeInvoice} onCheckedChange={(v) => setMakeInvoice(v === true)} className="mt-0.5" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium"><ReceiptText className="h-3.5 w-3.5" /> Invoice {invNumber}</span>
                <span className="block text-xs text-muted-foreground">
                  {alreadyInvoiced
                    ? `Already invoiced (${link?.invoices.map((i) => i.number).join(", ")}).`
                    : `Draft invoice issued ${format(new Date(), "MMM d, yyyy")}, due in ${terms} days.`}
                </span>
              </span>
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setQuote(null)} disabled={busy}>Cancel</Button>
          <Button onClick={() => void confirm()} disabled={busy}>
            {makePo || makeInvoice ? "Accept & create" : "Accept only"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { request, dialog };
}

function Row({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={[mono ? "font-tnum" : "", strong ? "font-semibold" : ""].join(" ")}>{value}</span>
    </div>
  );
}
