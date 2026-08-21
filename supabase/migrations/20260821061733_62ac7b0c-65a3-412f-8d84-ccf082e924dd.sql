ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_opportunity_id ON public.quotes(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_invoices_opportunity_id ON public.invoices(opportunity_id);