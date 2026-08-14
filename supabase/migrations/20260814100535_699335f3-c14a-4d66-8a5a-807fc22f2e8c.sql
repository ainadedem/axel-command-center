DROP POLICY IF EXISTS "Update clients" ON public.clients;
CREATE POLICY "Update clients" ON public.clients FOR UPDATE TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']))
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']));

DROP POLICY IF EXISTS "Delete clients" ON public.clients;
CREATE POLICY "Delete clients" ON public.clients FOR DELETE TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']));