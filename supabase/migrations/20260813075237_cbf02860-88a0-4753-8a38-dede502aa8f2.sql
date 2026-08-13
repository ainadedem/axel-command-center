CREATE OR REPLACE FUNCTION app_private.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, app_private
AS $$
  SELECT _company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = _user_id
      AND uca.company_id = _company_id
      AND uca.role = 'company_admin'
  )
$$;

REVOKE ALL ON FUNCTION app_private.is_company_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.is_company_admin(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Group admins insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "Group admins update team_members" ON public.team_members;
DROP POLICY IF EXISTS "Group admins delete team_members" ON public.team_members;

CREATE POLICY "Admins insert team_members"
ON public.team_members FOR INSERT TO authenticated
WITH CHECK (
  app_private.is_group_admin(auth.uid())
  OR (is_global = false AND app_private.is_company_admin(auth.uid(), company_id))
);

CREATE POLICY "Admins update team_members"
ON public.team_members FOR UPDATE TO authenticated
USING (
  app_private.is_group_admin(auth.uid())
  OR (is_global = false AND app_private.is_company_admin(auth.uid(), company_id))
)
WITH CHECK (
  app_private.is_group_admin(auth.uid())
  OR (is_global = false AND app_private.is_company_admin(auth.uid(), company_id))
);

CREATE POLICY "Admins delete team_members"
ON public.team_members FOR DELETE TO authenticated
USING (
  app_private.is_group_admin(auth.uid())
  OR (is_global = false AND app_private.is_company_admin(auth.uid(), company_id))
);

DROP POLICY IF EXISTS "Group admins insert sales_members" ON public.sales_members;
DROP POLICY IF EXISTS "Group admins update sales_members" ON public.sales_members;
DROP POLICY IF EXISTS "Group admins delete sales_members" ON public.sales_members;

CREATE POLICY "Admins insert sales_members"
ON public.sales_members FOR INSERT TO authenticated
WITH CHECK (
  app_private.is_group_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = sales_members.team_member_id
      AND tm.is_global = false
      AND app_private.is_company_admin(auth.uid(), tm.company_id)
  )
);

CREATE POLICY "Admins update sales_members"
ON public.sales_members FOR UPDATE TO authenticated
USING (
  app_private.is_group_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = sales_members.team_member_id
      AND tm.is_global = false
      AND app_private.is_company_admin(auth.uid(), tm.company_id)
  )
)
WITH CHECK (
  app_private.is_group_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = sales_members.team_member_id
      AND tm.is_global = false
      AND app_private.is_company_admin(auth.uid(), tm.company_id)
  )
);

CREATE POLICY "Admins delete sales_members"
ON public.sales_members FOR DELETE TO authenticated
USING (
  app_private.is_group_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = sales_members.team_member_id
      AND tm.is_global = false
      AND app_private.is_company_admin(auth.uid(), tm.company_id)
  )
);