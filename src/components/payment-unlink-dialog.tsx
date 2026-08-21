/**
 * Unlink one or several bank transactions from their invoices.
 *
 * Removing a payment link is an auditable act: it is confirmed explicitly,
 * recorded in each invoice's verification history with a reason, and can be
 * undone for 10 seconds. Only the links are removed — the transactions, the
 * invoice figures, the quotations and the POs are untouched.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fmtFull, useTransactions, useQuotes, usePurchaseOrders,
  type Invoice, type Currency,
} from "@/lib/mock-data";
import { buildPaymentProof, type ProofInvoice, type ProofTransaction } from "@/lib/payment-proof";
import { bulkUnlinkPayments, UnlinkPermissionError, type UnlinkTarget } from "@/lib/payment-audit";
import { useUnlinkPermission, UNLINK_DENIED_MESSAGE, UNLINK_ROLES_LABEL } from "@/lib/payment-permissions";

const money = (v: number, c: string) => fmtFull(v, c as Currency);

const VERDICT_LABEL: Record<string, string> = {
  verified: "Verified",
  installment: "Part-paid",
  partial: "Partly matched",
  unverified: "Unverified",
  "n/a": "Not applicable",
};

export interface UnlinkPair {
  invoice: Invoice;
  transaction: ProofTransaction;
}

export function PaymentUnlinkDialog({
  open,
  onOpenChange,
  invoice,
  transaction,
  items,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Single-payment shorthand. */
  invoice?: Invoice;
  transaction?: ProofTransaction;
  /** Bulk form: any number of invoice/transaction pairs. */
  items?: UnlinkPair[];
}) {
  const transactions = useTransactions();
  const quotes = useQuotes();
  const pos = usePurchaseOrders();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const perm = useUnlinkPermission();

  const pairs = useMemo<UnlinkPair[]>(
    () => (items && items.length > 0 ? items : invoice && transaction ? [{ invoice, transaction }] : []),
    [items, invoice, transaction],
  );

  const removedIds = useMemo(() => new Set(pairs.map((p) => p.transaction.id)), [pairs]);

  /** One group per affected invoice, with the verdict it falls back to. */
  const groups = useMemo(() => {
    const byInvoice = new Map<string, { invoice: Invoice; txs: ProofTransaction[] }>();
    pairs.forEach((p) => {
      const g = byInvoice.get(p.invoice.id) ?? { invoice: p.invoice, txs: [] };
      g.txs.push(p.transaction);
      byInvoice.set(p.invoice.id, g);
    });
    const remaining = (transactions as unknown as ProofTransaction[]).filter((t) => !removedIds.has(t.id));
    return [...byInvoice.values()].map((g) => ({
      ...g,
      after: buildPaymentProof(
        g.invoice as unknown as ProofInvoice,
        remaining as never,
        quotes as never,
        pos as never,
      ),
      before: buildPaymentProof(
        g.invoice as unknown as ProofInvoice,
        transactions as never,
        quotes as never,
        pos as never,
      ),
    }));
  }, [pairs, removedIds, transactions, quotes, pos]);

  const total = pairs.reduce((s, p) => s + p.transaction.amount, 0);
  const many = pairs.length > 1;

  /** Invoices the signed-in user may not touch, grouped for the error notice. */
  const blocked = useMemo(
    () => groups.filter((g) => !perm.can(g.invoice.companyId)),
    [groups, perm],
  );
  const allowed = blocked.length === 0;

  const confirm = async () => {
    if (pairs.length === 0) return;
    setBusy(true);
    const targets: UnlinkTarget[] = pairs.map((p) => ({
      invoiceId: p.invoice.id,
      invoiceNumber: p.invoice.number,
      companyId: p.invoice.companyId,
      transactionId: p.transaction.id,
      transactionDate: p.transaction.date,
      transactionAmount: p.transaction.amount,
      transactionCurrency: p.transaction.currency,
    }));

    // Verdict changes are computed *before* the write so the undo toast can
    // show exactly what will be reverted.
    const preview = groups.map((g) => ({
      number: g.invoice.number,
      from: VERDICT_LABEL[g.before.verification] ?? g.before.verification,
      to: VERDICT_LABEL[g.after.verification] ?? g.after.verification,
    }));

    let res: Awaited<ReturnType<typeof bulkUnlinkPayments>>;
    try {
      res = await bulkUnlinkPayments(targets, reason, "manual", perm.can);
    } catch (e) {
      setBusy(false);
      if (e instanceof UnlinkPermissionError) {
        toast.error(UNLINK_DENIED_MESSAGE(perm.companyName(e.blocked[0]?.companyId)));
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not unlink the payment");
      return;
    }

    const summary = preview.map((p) => `${p.number}: ${p.from} → ${p.to}`).join(", ");

    setBusy(false);
    setReason("");
    onOpenChange(false);
    toast.success(
      many
        ? `Unlinked ${res.count} payments from ${res.invoices} invoice${res.invoices !== 1 ? "s" : ""}`
        : "Payment unlinked",
      {
        duration: 10_000,
        description: `Undo restores ${summary}`,
        action: {
          label: "Undo",
          onClick: async () => {
            await res.undo();
            toast.message(many ? "Payment links restored" : "Payment link restored", {
              description: preview.map((p) => `${p.number}: ${p.to} → ${p.from}`).join(", "),
            });
          },
        },
        cancel: res.entries.length
          ? {
              label: "View audit",
              onClick: () => {
                const first = res.entries[0];
                window.dispatchEvent(
                  new CustomEvent("axel:open-activity", {
                    detail: { docType: "invoice", docId: first.invoiceId, entryId: first.entryId },
                  }),
                );
              },
            }
          : undefined,
      },
    );
  };

  if (pairs.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {many ? `Unlink ${pairs.length} payments?` : "Unlink this payment?"}
          </DialogTitle>
          <DialogDescription>
            The bank transaction{many ? "s stay" : " stays"} in your books — only the evidence
            link{many ? "s are" : " is"} removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {groups.map((g) => (
              <div key={g.invoice.id} className="rounded-lg border border-border bg-[var(--surface-container)] p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">Invoice {g.invoice.number}</span>
                  <span className="font-tnum text-muted-foreground">
                    {money(g.invoice.amount, g.invoice.currency)}
                  </span>
                </div>
                {g.txs.map((t) => (
                  <div key={t.id} className="mt-2 flex items-baseline justify-between gap-3 border-t border-border pt-2">
                    <span className="min-w-0 truncate text-muted-foreground" title={t.description}>
                      {t.date} · {t.description}
                    </span>
                    <span className="shrink-0 font-tnum text-muted-foreground">
                      {money(t.amount, t.currency)}
                    </span>
                  </div>
                ))}
                <p className="mt-2 text-xs text-muted-foreground">
                  {VERDICT_LABEL[g.before.verification] ?? g.before.verification} →{" "}
                  <span className="font-medium text-warning">
                    {VERDICT_LABEL[g.after.verification] ?? g.after.verification}
                  </span>
                  {g.after.outstanding > 0 && (
                    <> · {money(g.after.outstanding, g.invoice.currency)} unevidenced</>
                  )}
                </p>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {many
              ? `${money(total, pairs[0].transaction.currency)} of evidence is withdrawn across ${groups.length} invoice${groups.length !== 1 ? "s" : ""}. `
              : ""}
            Recorded paid amounts are not changed — the badge is what tells you the money is no
            longer evidenced.
          </p>

          {!allowed && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {UNLINK_DENIED_MESSAGE(perm.companyName(blocked[0]?.invoice.companyId))} Only {UNLINK_ROLES_LABEL.toLowerCase()} may break a payment's evidence chain
              {blocked.length !== groups.length
                ? ` — including invoice${blocked.length > 1 ? "s" : ""} ${blocked.map((g) => g.invoice.number).join(", ")}.`
                : "."}
            </p>
          )}

          <div className="space-y-1.5">
            <label htmlFor="unlink-reason" className="text-xs text-muted-foreground">
              Reason (optional)
            </label>
            <Input
              id="unlink-reason"
              disabled={!allowed}
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
          <Button variant="destructive" onClick={confirm} disabled={busy || !allowed}>
            {many ? `Unlink ${pairs.length} payments` : "Unlink payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
