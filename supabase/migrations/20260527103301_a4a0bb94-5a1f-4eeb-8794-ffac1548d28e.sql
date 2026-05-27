
-- Tighten team_members and sales_members RLS: drop ALL true/true policies,
-- keep authenticated read, restrict writes to group admins.

DROP POLICY IF EXISTS "Authenticated users access team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated users access sales_members" ON public.sales_members;

-- team_members
CREATE POLICY "Authenticated users view team_members"
  ON public.team_members FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Group admins insert team_members"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (app_private.is_group_admin(auth.uid()));
CREATE POLICY "Group admins update team_members"
  ON public.team_members FOR UPDATE TO authenticated
  USING (app_private.is_group_admin(auth.uid()))
  WITH CHECK (app_private.is_group_admin(auth.uid()));
CREATE POLICY "Group admins delete team_members"
  ON public.team_members FOR DELETE TO authenticated
  USING (app_private.is_group_admin(auth.uid()));

-- sales_members
CREATE POLICY "Authenticated users view sales_members"
  ON public.sales_members FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "Group admins insert sales_members"
  ON public.sales_members FOR INSERT TO authenticated
  WITH CHECK (app_private.is_group_admin(auth.uid()));
CREATE POLICY "Group admins update sales_members"
  ON public.sales_members FOR UPDATE TO authenticated
  USING (app_private.is_group_admin(auth.uid()))
  WITH CHECK (app_private.is_group_admin(auth.uid()));
CREATE POLICY "Group admins delete sales_members"
  ON public.sales_members FOR DELETE TO authenticated
  USING (app_private.is_group_admin(auth.uid()));
