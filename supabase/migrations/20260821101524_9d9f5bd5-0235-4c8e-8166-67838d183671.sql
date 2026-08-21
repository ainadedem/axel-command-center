ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS assigned_to uuid[] NOT NULL DEFAULT '{}';
DROP POLICY IF EXISTS "recon select" ON public.bank_reconciliations;