ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_swift text,
  ADD COLUMN IF NOT EXISTS bank_holder text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS branch_code text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS rib_key text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS intl_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_provider text,
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS mobile_name text;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS bank_holder text,
  ADD COLUMN IF NOT EXISTS bank_code text,
  ADD COLUMN IF NOT EXISTS branch_code text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS rib_key text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS intl_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobile_provider text,
  ADD COLUMN IF NOT EXISTS mobile_number text,
  ADD COLUMN IF NOT EXISTS mobile_name text;