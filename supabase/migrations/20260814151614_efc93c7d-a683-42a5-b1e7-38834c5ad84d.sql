ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount_pct numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_pct numeric;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS discount_pct numeric;