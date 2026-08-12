DROP POLICY IF EXISTS "Read avatars" ON storage.objects;
CREATE POLICY "Read avatars" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR app_private.is_group_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_company_access mine
      JOIN public.user_company_access theirs ON theirs.company_id = mine.company_id
      WHERE mine.user_id = auth.uid()
        AND theirs.user_id::text = (storage.foldername(name))[1]
    )
  )
);

DROP POLICY IF EXISTS "View profiles of company colleagues" ON public.profiles;
CREATE POLICY "View profiles of company colleagues" ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.user_company_access mine
    JOIN public.user_company_access theirs ON theirs.company_id = mine.company_id
    WHERE mine.user_id = auth.uid()
      AND theirs.user_id = profiles.user_id
      AND mine.role IN ('company_admin', 'group_admin', 'super_admin')
  )
);