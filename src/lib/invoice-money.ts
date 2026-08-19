/**
 * Invoice money helpers.
 *
 * Invoices follow the same convention as quotations: `amount` is the pre-tax
 * subtotal (after line and global discounts), `taxAmount` is the VAT on it and
 * `totalAmount` is the payable, tax-inclusive figure.
 *
 * Everything that tracks what a client owes (receivables, aging, the AR ladder,
 * alerts, reconciliation) must use the payable total, never the raw amount.
 */

export interface InvoiceMoney {
  amount: number;
  paid: number;
  taxAmount?: number;
  totalAmount?: number;
}

/** Payable, tax-inclusive total of an invoice. */
export function invoicePayable(inv: InvoiceMoney): number {
  const total = Number(inv.totalAmount);
  if (Number.isFinite(total) && total > 0) return total;
  return (Number(inv.amount) || 0) + (Number(inv.taxAmount) || 0);
}

/** Outstanding balance: payable total minus what has been paid. */
export function invoiceBalance(inv: InvoiceMoney): number {
  return invoicePayable(inv) - (Number(inv.paid) || 0);
}
