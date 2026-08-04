DROP POLICY IF EXISTS "Authenticated can read documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete documents" ON storage.objects;

CREATE POLICY "View documents" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND app_private.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid));

CREATE POLICY "Write documents" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND app_private.has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['company_admin','manager','project_manager','sales']));

CREATE POLICY "Update documents" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND app_private.has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['company_admin','manager','project_manager','sales']))
WITH CHECK (bucket_id = 'documents' AND app_private.has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['company_admin','manager','project_manager','sales']));

CREATE POLICY "Delete documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND app_private.has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, ARRAY['company_admin','manager','project_manager','sales']));