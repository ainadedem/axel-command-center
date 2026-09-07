CREATE OR REPLACE FUNCTION public.company_directory(_company_id uuid)
RETURNS TABLE (user_id uuid, display_name text, email text, avatar_url text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uca.user_id, p.display_name, p.email, p.avatar_url, uca.role
  FROM public.user_company_access uca
  LEFT JOIN public.profiles p ON p.user_id = uca.user_id
  WHERE uca.company_id = _company_id
    AND auth.uid() IS NOT NULL
    AND (
      app_private.has_company_access(auth.uid(), _company_id)
      OR app_private.is_group_admin(auth.uid())
      OR app_private.is_super_admin(auth.uid())
    )
$$;

GRANT EXECUTE ON FUNCTION public.company_directory(uuid) TO authenticated;