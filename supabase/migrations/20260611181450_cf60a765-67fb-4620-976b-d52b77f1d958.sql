DROP POLICY IF EXISTS "Authenticated users view team_members" ON public.team_members;

CREATE POLICY "Users view team_members in their companies"
ON public.team_members
FOR SELECT
TO authenticated
USING (
  app_private.is_group_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.salary_register sr
    JOIN public.user_company_access uca
      ON uca.company_id = sr.company_id
    WHERE sr.team_member_id = team_members.id
      AND uca.user_id = auth.uid()
  )
);