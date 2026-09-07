REVOKE EXECUTE ON FUNCTION public.company_directory(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.company_directory(uuid) TO authenticated;