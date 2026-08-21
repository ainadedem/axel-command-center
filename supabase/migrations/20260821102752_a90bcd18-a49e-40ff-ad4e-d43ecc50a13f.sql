ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS color text;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  kind text NOT NULL,
  doc_type text,
  doc_id uuid,
  doc_number text,
  title text NOT NULL,
  body text,
  href text,
  actor_id uuid,
  actor_name text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_company" ON public.notifications;
CREATE POLICY "notifications_insert_company" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (
    actor_id = auth.uid()
    AND (
      company_id IS NULL
      OR app_private.has_company_access(auth.uid(), company_id)
    )
  );

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS events jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS watch_company_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS watch_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

GRANT SELECT ON public.notification_prefs TO authenticated;