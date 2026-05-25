REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_group_admin(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.has_company_access(uuid, uuid) FROM authenticated, anon, public;