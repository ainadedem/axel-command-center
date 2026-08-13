CREATE OR REPLACE FUNCTION app_private.is_company_admin(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, app_private
AS $$
  SELECT _company_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = _user_id
      AND uca.company_id = _company_id
      AND uca.role = 'company_admin'
  )
$$;