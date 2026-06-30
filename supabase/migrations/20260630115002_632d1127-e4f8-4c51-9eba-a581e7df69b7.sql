
-- 1) Remove duplicated security helpers from public schema (canonical copies live in app_private)
DROP FUNCTION IF EXISTS public.has_company_access(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_group_admin(uuid);
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);

-- 2) Restrict payroll_runs and salary_register SELECT to roles that legitimately need payroll data
DROP POLICY IF EXISTS "View payroll_runs" ON public.payroll_runs;
CREATE POLICY "View payroll_runs"
  ON public.payroll_runs
  FOR SELECT
  TO authenticated
  USING (
    app_private.has_company_role(
      auth.uid(),
      company_id,
      ARRAY['company_admin','manager','finance']
    )
  );

DROP POLICY IF EXISTS "View salary_register" ON public.salary_register;
CREATE POLICY "View salary_register"
  ON public.salary_register
  FOR SELECT
  TO authenticated
  USING (
    app_private.has_company_role(
      auth.uid(),
      company_id,
      ARRAY['company_admin','manager','finance']
    )
  );
