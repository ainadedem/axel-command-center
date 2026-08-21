ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS digest_modes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS time_zone text;

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, read_at, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notification_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  href text,
  doc_number text,
  actor_name text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, DELETE ON public.notification_email_queue TO authenticated;
GRANT ALL ON public.notification_email_queue TO service_role;

ALTER TABLE public.notification_email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own queued emails readable" ON public.notification_email_queue;
CREATE POLICY "own queued emails readable" ON public.notification_email_queue
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own queued emails deletable" ON public.notification_email_queue;
CREATE POLICY "own queued emails deletable" ON public.notification_email_queue
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notification_email_queue_due_idx
  ON public.notification_email_queue (scheduled_for) WHERE sent_at IS NULL;