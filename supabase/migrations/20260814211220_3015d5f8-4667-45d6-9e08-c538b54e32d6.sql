ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS team_members_user_id_key ON public.team_members(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.sales_members ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

DROP POLICY IF EXISTS "Users can view their own linked team profile" ON public.team_members;
CREATE POLICY "Users can view their own linked team profile"
ON public.team_members FOR SELECT TO authenticated
USING (user_id = auth.uid());