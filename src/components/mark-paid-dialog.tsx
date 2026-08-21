import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccounts, transactionsStore, toMGA, FX, type Invoice } from "@/lib/mock-data";
import { newId } from "@/lib/data-store";
import { invoiceBalance, invoicePayable } from "@/lib/invoice-money";
import { planStatusChange, commitStatusChange } from "@/lib/invoice-status";
import { useCompany } from "@/lib/company-context";
import { useReconciledSelection } from "@/hooks/use-reconciled-selection";
import { useSingleFlightSubmit } from "@/components/form-ux";
import { cn } from "@/lib/utils";

/**
 * Records a client payment and flips the invoice to "paid" in one controlled
 * step: the paid amount, payment date and the matching income transaction are
 * always written together, with an audit entry and a 10s undo.
 */
export function MarkPaidDialog({
  open, onOpenChange, invoice, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice | null;
  onDone?: () => void;
}) {
  const { dataLoading } = useCompany();
  const accounts = useAccounts();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState<string>("");
  const [receivedMga, setReceivedMga] = useState<string>("");

  const coAccounts = invoice ? accounts.filter((a) => a.companyId === invoice.companyId) : [];
  const accountsLoading = !!invoice && dataLoading && coAccounts.length === 0;
  const expectedMga = invoice ? Math.round(toMGA(invoiceBalance(invoice), invoice.currency)) : 0;
  const isForeign = !!invoice && invoice.currency !== "MGA";

  useEffect(() => {
    if (open && invoice) {
      setDate(new Date().toISOString().slice(0, 10));
      setReceivedMga(String(expectedMga));
      const mgaAcc = coAccounts.find((a) => a.currency === "MGA") ?? coAccounts[0];
      setAccountId(mgaAcc?.id ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice]);

  useEffect(() => {
    if (!open || !invoice) return;
    const currentStillAvailable = coAccounts.some((account) => account.id === accountId);
    if (currentStillAvailable) return;
    const preferred = coAccounts.find((account) => account.currency === "MGA") ?? coAccounts[0];
    if (preferred) {
      setAccountId(preferred.id);
      return;
    }
    if (!accountsLoading) setAccountId("");
  }, [open, invoice, accountId, coAccounts, accountsLoading]);

  useReconciledSelection({
    open,
    currentValue: accountId,
    options: coAccounts,
    getId: (account) => account.id,
    loading: accountsLoading,
    onChange: setAccountId,
  });

  const account = coAccounts.find((a) => a.id === accountId);
  const remaining = invoice ? invoiceBalance(invoice) : 0;
  const receivedNum = Number(receivedMga) || 0;
  // FX delta in MGA: positive = gain, negative = loss (perte de change)
  const fxDelta = isForeign ? receivedNum - expectedMga : 0;

  const submit = () => {
    if (!invoice || invoice.status === "cancelled") return;
    const createdTransactionIds: string[] = [];

    // Payment transaction (in invoice currency, for ledger consistency)
    if (account && remaining > 0) {
      const txId = newId("tx");
      createdTransactionIds.push(txId);
      transactionsStore.add({
        id: txId,
        companyId: invoice.companyId,
        accountId: account.id,
        date,
        type: "income",
        category: "Encaissements clients",
        description: `Payment · ${invoice.number}`,
        amount: remaining,
        currency: invoice.currency,
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        invoiceId: invoice.id,
        source: "manual",
      });
    }
    // FX gain/loss (in MGA — the difference between what was expected and what landed)
    if (isForeign && Math.abs(fxDelta) >= 1 && account) {
      const isGain = fxDelta > 0;
      const txId = newId("tx");
      createdTransactionIds.push(txId);
      transactionsStore.add({
        id: txId,
        companyId: invoice.companyId,
        accountId: account.id,
        date,
        type: isGain ? "income" : "expense",
        category: isGain ? "Gain de change" : "Perte de change",
        description: `FX ${isGain ? "gain" : "loss"} · ${invoice.number} (${invoice.currency} → MGA)`,
        amount: Math.abs(fxDelta),
        currency: "MGA",
        clientId: invoice.clientId,
        projectId: invoice.projectId,
        invoiceId: invoice.id,
        source: "manual",
      });
    }

    const plan = planStatusChange(invoice, "paid", { paymentDate: date, paymentConfirmed: true });
    const committed = commitStatusChange(invoice, plan, { createdTransactionIds });
    toast.success(`${invoice.number} marked paid`, {
      description: committed.diff,
      duration: 10000,
      action: { label: "Undo", onClick: () => { void committed.revert(); } },
    });
    onOpenChange(false);
    onDone?.();
  };
  const { run: handleSubmit, isSubmitting } = useSingleFlightSubmit(submit);

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark as paid · {invoice.number}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-surface/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice total</span><span className="font-tnum">{invoicePayable(invoice).toLocaleString()} {invoice.currency}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Remaining</span><span className="font-tnum">{remaining.toLocaleString()} {invoice.currency}</span></div>
            {isForeign && (
              <div className="flex justify-between"><span className="text-muted-foreground">Expected in MGA (rate {FX[invoice.currency].toLocaleString()})</span><span className="font-tnum">{expectedMga.toLocaleString()} MGA</span></div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Payment date</Label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" />
            </div>
            <div>
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId} disabled={accountsLoading || coAccounts.length === 0}>
                <SelectTrigger className="h-9"><SelectValue placeholder={accountsLoading ? "Loading accounts..." : coAccounts.length ? "Select account" : "Create account first"} /></SelectTrigger>
                <SelectContent>
                  {coAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.currency})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isForeign && (
            <div>
              <Label>Actual MGA received</Label>
              <input type="number" value={receivedMga} onChange={(e) => setReceivedMga(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm font-tnum" />
              {Math.abs(fxDelta) >= 1 && (
                <div className={cn("mt-1.5 text-[11px] font-tnum", fxDelta > 0 ? "text-success" : "text-destructive")}>
                  {fxDelta > 0 ? "Gain" : "Perte"} de change: {fxDelta > 0 ? "+" : "−"}{Math.abs(fxDelta).toLocaleString()} MGA
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>Mark paid</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
