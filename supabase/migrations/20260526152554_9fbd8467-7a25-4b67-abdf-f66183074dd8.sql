ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS short_name   text,
  ADD COLUMN IF NOT EXISTS color        text,
  ADD COLUMN IF NOT EXISTS logo_url     text,
  ADD COLUMN IF NOT EXISTS legal_name   text,
  ADD COLUMN IF NOT EXISTS address      text,
  ADD COLUMN IF NOT EXISTS email        text,
  ADD COLUMN IF NOT EXISTS phone        text,
  ADD COLUMN IF NOT EXISTS website      text,
  ADD COLUMN IF NOT EXISTS nif          text,
  ADD COLUMN IF NOT EXISTS stat         text,
  ADD COLUMN IF NOT EXISTS rcs          text,
  ADD COLUMN IF NOT EXISTS tax_id       text,
  ADD COLUMN IF NOT EXISTS bank_name    text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_swift   text;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();