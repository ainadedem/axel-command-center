DROP POLICY IF EXISTS "View purchase_orders" ON public.purchase_orders;
CREATE POLICY "View purchase_orders" ON public.purchase_orders
FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance','project_manager','sales']));