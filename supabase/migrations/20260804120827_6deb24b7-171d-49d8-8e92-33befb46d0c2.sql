ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS opening_balance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_balance_date date;

UPDATE public.accounts SET opening_balance = balance WHERE opening_balance = 0;

CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period_start date,
  period_end date,
  statement_closing_balance numeric NOT NULL DEFAULT 0,
  computed_closing_balance numeric NOT NULL DEFAULT 0,
  difference numeric NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  statement_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_reconciliations TO authenticated;
GRANT ALL ON public.bank_reconciliations TO service_role;

ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recon select" ON public.bank_reconciliations
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_company_access uca WHERE uca.user_id = auth.uid() AND uca.company_id = bank_reconciliations.company_id));

CREATE POLICY "recon insert" ON public.bank_reconciliations
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_company_access uca WHERE uca.user_id = auth.uid() AND uca.company_id = bank_reconciliations.company_id));

CREATE POLICY "recon update" ON public.bank_reconciliations
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_company_access uca WHERE uca.user_id = auth.uid() AND uca.company_id = bank_reconciliations.company_id));

CREATE POLICY "recon delete" ON public.bank_reconciliations
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_company_access uca WHERE uca.user_id = auth.uid() AND uca.company_id = bank_reconciliations.company_id));

CREATE TRIGGER trg_bank_recon_updated BEFORE UPDATE ON public.bank_reconciliations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_bank_recon_account ON public.bank_reconciliations(account_id);