ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

DROP POLICY IF EXISTS "View profiles of company colleagues" ON public.profiles;
CREATE POLICY "View profiles of company colleagues"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_company_access mine
    JOIN public.user_company_access theirs ON theirs.company_id = mine.company_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = public.profiles.user_id
  )
);