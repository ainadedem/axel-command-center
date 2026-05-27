
-- 1. Per-company role on user_company_access
ALTER TABLE public.user_company_access
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'company_admin';

ALTER TABLE public.user_company_access
  DROP CONSTRAINT IF EXISTS user_company_access_role_check;
ALTER TABLE public.user_company_access
  ADD CONSTRAINT user_company_access_role_check
  CHECK (role IN ('company_admin','manager','project_manager','sales','finance','viewer'));

-- 2. Role-aware access helper (super_admin / group_admin always pass)
CREATE OR REPLACE FUNCTION app_private.has_company_role(
  _user uuid, _company uuid, _roles text[]
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _user = auth.uid() AND (
    public.is_group_admin(_user)
    OR EXISTS (
      SELECT 1 FROM public.user_company_access
      WHERE user_id = _user
        AND company_id = _company
        AND role = ANY(_roles)
    )
  )
$$;

-- 3. Rewrite RLS per table: SELECT for anyone with access, writes per role matrix.
-- Helper macro: financial roles, sales roles, project roles.

-- ---------- INVOICES ----------
DROP POLICY IF EXISTS "Users access invoices in their companies" ON public.invoices;
CREATE POLICY "View invoices" ON public.invoices FOR SELECT TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Write invoices" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Update invoices" ON public.invoices FOR UPDATE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Delete invoices" ON public.invoices FOR DELETE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

-- ---------- INVOICE_LINES (inherit parent) ----------
DROP POLICY IF EXISTS "Users access invoice lines via parent invoice" ON public.invoice_lines;
CREATE POLICY "View invoice_lines" ON public.invoice_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id
    AND app_private.has_company_access(auth.uid(), i.company_id)));
CREATE POLICY "Write invoice_lines" ON public.invoice_lines FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id
    AND app_private.has_company_role(auth.uid(), i.company_id, ARRAY['company_admin','manager','finance'])));
CREATE POLICY "Update invoice_lines" ON public.invoice_lines FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id
    AND app_private.has_company_role(auth.uid(), i.company_id, ARRAY['company_admin','manager','finance'])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id
    AND app_private.has_company_role(auth.uid(), i.company_id, ARRAY['company_admin','manager','finance'])));
CREATE POLICY "Delete invoice_lines" ON public.invoice_lines FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id
    AND app_private.has_company_role(auth.uid(), i.company_id, ARRAY['company_admin','manager','finance'])));

-- ---------- Generic loop for finance-write tables ----------
DO $$
DECLARE
  t text;
  finance_tables text[] := ARRAY[
    'transactions','expenses','recurring_billings','budgets','accounts',
    'salary_register','payroll_runs','suppliers','categories'
  ];
BEGIN
  FOREACH t IN ARRAY finance_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users access %1$s in their companies" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "View %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Write %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Update %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Delete %1$s" ON public.%1$I', t);

    EXECUTE format($f$
      CREATE POLICY "View %1$s" ON public.%1$I FOR SELECT TO authenticated
        USING (app_private.has_company_access(auth.uid(), company_id))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Write %1$s" ON public.%1$I FOR INSERT TO authenticated
        WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Update %1$s" ON public.%1$I FOR UPDATE TO authenticated
        USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
        WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Delete %1$s" ON public.%1$I FOR DELETE TO authenticated
        USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
    $f$, t);
  END LOOP;
END $$;

-- ---------- Sales-write tables ----------
DO $$
DECLARE
  t text;
  sales_tables text[] := ARRAY['quotes','purchase_orders','opportunities','clients'];
BEGIN
  FOREACH t IN ARRAY sales_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users access %1$s in their companies" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "View %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Write %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Update %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Delete %1$s" ON public.%1$I', t);

    EXECUTE format($f$
      CREATE POLICY "View %1$s" ON public.%1$I FOR SELECT TO authenticated
        USING (app_private.has_company_access(auth.uid(), company_id))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Write %1$s" ON public.%1$I FOR INSERT TO authenticated
        WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','sales']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Update %1$s" ON public.%1$I FOR UPDATE TO authenticated
        USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','sales']))
        WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','sales']))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "Delete %1$s" ON public.%1$I FOR DELETE TO authenticated
        USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager','sales']))
    $f$, t);
  END LOOP;
END $$;

-- ---------- PROJECTS ----------
DROP POLICY IF EXISTS "Users access projects in their companies" ON public.projects;
DROP POLICY IF EXISTS "View projects" ON public.projects;
DROP POLICY IF EXISTS "Write projects" ON public.projects;
DROP POLICY IF EXISTS "Update projects" ON public.projects;
DROP POLICY IF EXISTS "Delete projects" ON public.projects;
CREATE POLICY "View projects" ON public.projects FOR SELECT TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Write projects" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']));
CREATE POLICY "Update projects" ON public.projects FOR UPDATE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']));
CREATE POLICY "Delete projects" ON public.projects FOR DELETE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']));
