CREATE OR REPLACE FUNCTION public.company_directory(_company_id uuid)
RETURNS TABLE (user_id uuid, display_name text, email text, avatar_url text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT auth.uid() IS NOT NULL
      AND (
        app_private.has_company_access(auth.uid(), _company_id)
        OR app_private.is_group_admin(auth.uid())
        OR app_private.is_super_admin(auth.uid())
      ) AS ok
  ), people AS (
    SELECT uca.user_id, uca.role::text AS role, 0 AS priority
    FROM public.user_company_access uca
    WHERE uca.company_id = _company_id
    UNION ALL
    SELECT ur.user_id, ur.role::text AS role, 1 AS priority
    FROM public.user_roles ur
    WHERE ur.role IN ('super_admin', 'group_admin')
  ), deduped AS (
    SELECT DISTINCT ON (p.user_id) p.user_id, p.role
    FROM people p
    ORDER BY p.user_id, p.priority
  )
  SELECT d.user_id, pr.display_name, pr.email, pr.avatar_url, d.role
  FROM deduped d
  LEFT JOIN public.profiles pr ON pr.user_id = d.user_id
  CROSS JOIN allowed a
  WHERE a.ok
$$;

REVOKE EXECUTE ON FUNCTION public.company_directory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_directory(uuid) TO authenticated;