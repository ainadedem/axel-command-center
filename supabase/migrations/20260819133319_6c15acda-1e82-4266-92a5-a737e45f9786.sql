-- Align invoice money with quotations: amount = pre-tax subtotal, total_amount = payable.
UPDATE public.invoices
SET amount = ROUND(amount / (1 + tax_rate / 100.0)),
    tax_amount = amount - ROUND(amount / (1 + tax_rate / 100.0)),
    total_amount = amount
WHERE tax_rate > 0 AND (total_amount IS NULL OR total_amount = amount);

UPDATE public.invoices
SET total_amount = amount + COALESCE(tax_amount, 0)
WHERE total_amount IS NULL;