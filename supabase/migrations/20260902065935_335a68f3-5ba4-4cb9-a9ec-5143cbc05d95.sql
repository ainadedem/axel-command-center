ALTER TABLE public.document_activity DROP CONSTRAINT document_activity_doc_type_check;
ALTER TABLE public.document_activity ADD CONSTRAINT document_activity_doc_type_check
  CHECK (doc_type = ANY (ARRAY['quote'::text, 'invoice'::text, 'po'::text, 'project'::text]));