ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS po_waived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS po_waiver_reason text;