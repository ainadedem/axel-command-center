DROP POLICY IF EXISTS "Users view team_members in their companies" ON public.team_members;

CREATE POLICY "Users view team_members in their companies"
ON public.team_members FOR SELECT
TO authenticated
USING (
  app_private.is_group_admin(auth.uid())
  OR is_global
  OR (company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid() AND uca.company_id = team_members.company_id
  ))
  OR EXISTS (
    SELECT 1 FROM public.salary_register sr
    JOIN public.user_company_access uca ON uca.company_id = sr.company_id
    WHERE sr.team_member_id = team_members.id AND uca.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users view sales_members for visible team" ON public.sales_members;

CREATE POLICY "Users view sales_members for visible team"
ON public.sales_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm WHERE tm.id = sales_members.team_member_id
  )
);