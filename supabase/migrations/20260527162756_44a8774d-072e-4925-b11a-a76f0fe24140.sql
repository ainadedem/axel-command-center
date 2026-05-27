DROP POLICY IF EXISTS "Authenticated users view team_members" ON public.team_members;
CREATE POLICY "Group admins view team_members" ON public.team_members
FOR SELECT TO authenticated
USING (app_private.is_group_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users view sales_members" ON public.sales_members;
CREATE POLICY "Group admins view sales_members" ON public.sales_members
FOR SELECT TO authenticated
USING (app_private.is_group_admin(auth.uid()));