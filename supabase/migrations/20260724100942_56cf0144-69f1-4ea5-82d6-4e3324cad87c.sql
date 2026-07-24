CREATE OR REPLACE FUNCTION app_private.has_company_role(_user uuid, _company uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _user = auth.uid() AND (
    app_private.is_group_admin(_user)
    OR EXISTS (
      SELECT 1 FROM public.user_company_access
      WHERE user_id = _user
        AND company_id = _company
        AND role = ANY(_roles)
    )
  )
$function$;