ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS signer_id uuid,
  ADD COLUMN IF NOT EXISTS stamp_x numeric,
  ADD COLUMN IF NOT EXISTS stamp_y numeric,
  ADD COLUMN IF NOT EXISTS stamp_scale numeric,
  ADD COLUMN IF NOT EXISTS stamp_dirty boolean NOT NULL DEFAULT false;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS signer_id uuid,
  ADD COLUMN IF NOT EXISTS stamp_x numeric,
  ADD COLUMN IF NOT EXISTS stamp_y numeric,
  ADD COLUMN IF NOT EXISTS stamp_scale numeric,
  ADD COLUMN IF NOT EXISTS stamp_dirty boolean NOT NULL DEFAULT false;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS signer_id uuid,
  ADD COLUMN IF NOT EXISTS stamp_x numeric,
  ADD COLUMN IF NOT EXISTS stamp_y numeric,
  ADD COLUMN IF NOT EXISTS stamp_scale numeric,
  ADD COLUMN IF NOT EXISTS stamp_dirty boolean NOT NULL DEFAULT false;