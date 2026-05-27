CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$function$;

DROP POLICY IF EXISTS "Group admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only group admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only group admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only group admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;

CREATE POLICY "Super admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (app_private.is_super_admin(auth.uid()))
WITH CHECK (app_private.is_super_admin(auth.uid()));

DELETE FROM public.user_company_access uca
USING public.profiles p, public.companies c
WHERE uca.user_id = p.user_id
  AND uca.company_id = c.id
  AND lower(p.email) = 'accounting@weaxiom.com'
  AND c.code <> 'AXI';

INSERT INTO public.user_company_access (user_id, company_id, role)
SELECT p.user_id, c.id, 'finance'
FROM public.profiles p
JOIN public.companies c ON c.code = 'AXI'
WHERE lower(p.email) = 'accounting@weaxiom.com'
ON CONFLICT (user_id, company_id) DO UPDATE SET role = excluded.role;

DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.user_id
  AND lower(p.email) = 'accounting@weaxiom.com'
  AND ur.role IN ('super_admin', 'group_admin');