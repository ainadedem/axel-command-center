DROP POLICY IF EXISTS "recon insert" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "recon update" ON public.bank_reconciliations;
DROP POLICY IF EXISTS "recon delete" ON public.bank_reconciliations;

CREATE POLICY "recon insert" ON public.bank_reconciliations
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

CREATE POLICY "recon update" ON public.bank_reconciliations
  FOR UPDATE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

CREATE POLICY "recon delete" ON public.bank_reconciliations
  FOR DELETE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));