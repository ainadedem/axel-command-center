
-- 1) Restrict profile reads to the owner
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) Add restrictive policies on user_roles to prevent privilege escalation
CREATE POLICY "Only group admins can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.is_group_admin(auth.uid()));

CREATE POLICY "Only group admins can update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (public.is_group_admin(auth.uid()))
WITH CHECK (public.is_group_admin(auth.uid()));

CREATE POLICY "Only group admins can delete roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (public.is_group_admin(auth.uid()));
