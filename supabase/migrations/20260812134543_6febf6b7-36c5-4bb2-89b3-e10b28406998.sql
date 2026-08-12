CREATE TABLE public.user_admin_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id uuid,
  actor_email text,
  action text NOT NULL,
  target_email text,
  target_user_id uuid,
  company_id uuid,
  requested_role text,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_admin_audit TO authenticated;
GRANT ALL ON public.user_admin_audit TO service_role;

ALTER TABLE public.user_admin_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read user admin audit"
ON public.user_admin_audit
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'group_admin')
);

CREATE INDEX idx_user_admin_audit_created_at ON public.user_admin_audit (created_at DESC);