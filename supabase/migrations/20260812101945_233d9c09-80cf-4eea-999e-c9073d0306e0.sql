ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_document_language text NOT NULL DEFAULT 'en';

-- Finance-only read access
DROP POLICY IF EXISTS "View invoices" ON public.invoices;
CREATE POLICY "View invoices" ON public.invoices FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

DROP POLICY IF EXISTS "View transactions" ON public.transactions;
CREATE POLICY "View transactions" ON public.transactions FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

DROP POLICY IF EXISTS "View expenses" ON public.expenses;
CREATE POLICY "View expenses" ON public.expenses FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

DROP POLICY IF EXISTS "View accounts" ON public.accounts;
CREATE POLICY "View accounts" ON public.accounts FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

DROP POLICY IF EXISTS "View budgets" ON public.budgets;
CREATE POLICY "View budgets" ON public.budgets FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

DROP POLICY IF EXISTS "View bank_reconciliations" ON public.bank_reconciliations;
CREATE POLICY "View bank_reconciliations" ON public.bank_reconciliations FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

DROP POLICY IF EXISTS "View recurring_billings" ON public.recurring_billings;
CREATE POLICY "View recurring_billings" ON public.recurring_billings FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

DROP POLICY IF EXISTS "View purchase_orders" ON public.purchase_orders;
CREATE POLICY "View purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

-- Quotes: sales see only their own
DROP POLICY IF EXISTS "View quotes" ON public.quotes;
CREATE POLICY "View quotes" ON public.quotes FOR SELECT TO authenticated
USING (
  app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance','project_manager'])
  OR (app_private.has_company_access(auth.uid(), company_id) AND created_by = auth.uid())
);