ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS details text;