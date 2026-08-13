ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.ar_alert_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  stage integer NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (invoice_id, stage)
);

GRANT SELECT ON public.ar_alert_log TO authenticated;
GRANT ALL ON public.ar_alert_log TO service_role;
ALTER TABLE public.ar_alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members read AR alert log"
ON public.ar_alert_log FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'super_admin')
  OR public.has_role(auth.uid(), 'group_admin')
  OR EXISTS (
    SELECT 1 FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid() AND uca.company_id = ar_alert_log.company_id
  )
);

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ar_alerts_enabled boolean NOT NULL DEFAULT true,
  stages integer[] NOT NULL DEFAULT '{15,30,45,60}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own notification prefs"
ON public.notification_prefs FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_notification_prefs_updated
BEFORE UPDATE ON public.notification_prefs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();