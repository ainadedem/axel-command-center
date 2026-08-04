-- Avatars bucket
CREATE POLICY "Authenticated can read avatars" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated can upload avatars" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated can update avatars" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars') WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated can delete avatars" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- Documents bucket (client POs, expense attachments)
CREATE POLICY "Authenticated can read documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Authenticated can upload documents" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Authenticated can update documents" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'documents') WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Authenticated can delete documents" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'documents');