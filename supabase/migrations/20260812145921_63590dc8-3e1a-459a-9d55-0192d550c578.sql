ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();