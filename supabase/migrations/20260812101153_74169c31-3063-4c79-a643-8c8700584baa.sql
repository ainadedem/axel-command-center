ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_height integer NOT NULL DEFAULT 52,
  ADD COLUMN IF NOT EXISTS logo_max_width integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS logo_crop jsonb;