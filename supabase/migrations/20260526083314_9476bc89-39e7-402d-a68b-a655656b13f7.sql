CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.is_group_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('group_admin', 'super_admin')
    )
$$;

CREATE OR REPLACE FUNCTION app_private.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = 'super_admin'
    )
$$;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION app_private.has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid()
    AND (
      app_private.is_group_admin(_user_id)
      OR EXISTS (
        SELECT 1
        FROM public.user_company_access
        WHERE user_id = _user_id
          AND company_id = _company_id
      )
    )
$$;

GRANT USAGE ON SCHEMA app_private TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_group_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.has_company_access(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Group admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only group admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only group admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only group admins can delete roles" ON public.user_roles;

CREATE POLICY "Users view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR app_private.is_group_admin(auth.uid()));

CREATE POLICY "Group admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (app_private.is_group_admin(auth.uid()))
WITH CHECK (app_private.is_group_admin(auth.uid()));

CREATE POLICY "Only group admins can insert roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (app_private.is_group_admin(auth.uid()));

CREATE POLICY "Only group admins can update roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (app_private.is_group_admin(auth.uid()))
WITH CHECK (app_private.is_group_admin(auth.uid()));

CREATE POLICY "Only group admins can delete roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (app_private.is_group_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view accessible companies" ON public.companies;
DROP POLICY IF EXISTS "Group admins manage companies" ON public.companies;

CREATE POLICY "Users view accessible companies"
ON public.companies
FOR SELECT
TO authenticated
USING (app_private.has_company_access(auth.uid(), id));

CREATE POLICY "Group admins manage companies"
ON public.companies
FOR ALL
TO authenticated
USING (app_private.is_group_admin(auth.uid()))
WITH CHECK (app_private.is_group_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view own access" ON public.user_company_access;
DROP POLICY IF EXISTS "Group admins manage access" ON public.user_company_access;

CREATE POLICY "Users view own access"
ON public.user_company_access
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR app_private.is_group_admin(auth.uid()));

CREATE POLICY "Group admins manage access"
ON public.user_company_access
FOR ALL
TO authenticated
USING (app_private.is_group_admin(auth.uid()))
WITH CHECK (app_private.is_group_admin(auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_group_admin(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_company_access(UUID, UUID) FROM authenticated;