-- 1. Client banking details moved to a finance-restricted table
CREATE TABLE IF NOT EXISTS public.client_bank_details (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id uuid NOT NULL,
  bank_name text,
  bank_account text,
  bank_swift text,
  bank_holder text,
  bank_code text,
  branch_code text,
  account_number text,
  rib_key text,
  iban text,
  intl_enabled boolean NOT NULL DEFAULT false,
  mobile_enabled boolean NOT NULL DEFAULT false,
  mobile_provider text,
  mobile_number text,
  mobile_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_bank_details TO authenticated;
GRANT ALL ON public.client_bank_details TO service_role;

ALTER TABLE public.client_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View client bank details" ON public.client_bank_details
  FOR SELECT TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','finance']));

CREATE POLICY "Write client bank details" ON public.client_bank_details
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','finance']));

CREATE POLICY "Update client bank details" ON public.client_bank_details
  FOR UPDATE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','finance']))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','finance']));

CREATE POLICY "Delete client bank details" ON public.client_bank_details
  FOR DELETE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

CREATE TRIGGER client_bank_details_updated_at
  BEFORE UPDATE ON public.client_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.client_bank_details (
  client_id, company_id, bank_name, bank_account, bank_swift, bank_holder, bank_code,
  branch_code, account_number, rib_key, iban, intl_enabled, mobile_enabled,
  mobile_provider, mobile_number, mobile_name
)
SELECT id, company_id, bank_name, bank_account, bank_swift, bank_holder, bank_code,
       branch_code, account_number, rib_key, iban, COALESCE(intl_enabled,false),
       COALESCE(mobile_enabled,false), mobile_provider, mobile_number, mobile_name
FROM public.clients
WHERE COALESCE(bank_name, bank_account, bank_swift, bank_holder, bank_code, branch_code,
               account_number, rib_key, iban, mobile_provider, mobile_number, mobile_name) IS NOT NULL
   OR intl_enabled OR mobile_enabled
ON CONFLICT (client_id) DO NOTHING;

ALTER TABLE public.clients
  DROP COLUMN bank_name,
  DROP COLUMN bank_account,
  DROP COLUMN bank_swift,
  DROP COLUMN bank_holder,
  DROP COLUMN bank_code,
  DROP COLUMN branch_code,
  DROP COLUMN account_number,
  DROP COLUMN rib_key,
  DROP COLUMN iban,
  DROP COLUMN intl_enabled,
  DROP COLUMN mobile_enabled,
  DROP COLUMN mobile_provider,
  DROP COLUMN mobile_number,
  DROP COLUMN mobile_name;

-- 2. team_members: drop the payroll-join visibility clause
DROP POLICY IF EXISTS "Users view team_members in their companies" ON public.team_members;
CREATE POLICY "Users view team_members in their companies" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    app_private.is_group_admin(auth.uid())
    OR is_global
    OR (company_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid() AND uca.company_id = team_members.company_id
    ))
  );