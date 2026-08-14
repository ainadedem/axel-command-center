ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS stamp_url text,
  ADD COLUMN IF NOT EXISTS stamp_position text NOT NULL DEFAULT 'bottom-right',
  ADD COLUMN IF NOT EXISTS stamp_width integer NOT NULL DEFAULT 140,
  ADD COLUMN IF NOT EXISTS stamp_opacity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS show_stamp boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_url text;