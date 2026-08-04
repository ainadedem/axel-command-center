ALTER TABLE public.bank_reconciliations
  ADD COLUMN IF NOT EXISTS adjustment_amount numeric,
  ADD COLUMN IF NOT EXISTS adjustment_transaction_id uuid,
  ADD COLUMN IF NOT EXISTS opening_balance numeric;