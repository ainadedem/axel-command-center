
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fx_rate numeric,
  ADD COLUMN IF NOT EXISTS fx_base_currency text,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to text;

-- Storage policies for quote-pdfs bucket. Path layout: {company_id}/{quote_number}.pdf
CREATE POLICY "View quote-pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'quote-pdfs'
  AND app_private.has_company_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Write quote-pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quote-pdfs'
  AND app_private.has_company_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['company_admin','manager','project_manager','sales']
  )
);

CREATE POLICY "Update quote-pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'quote-pdfs'
  AND app_private.has_company_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['company_admin','manager','project_manager','sales']
  )
)
WITH CHECK (
  bucket_id = 'quote-pdfs'
  AND app_private.has_company_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['company_admin','manager','project_manager','sales']
  )
);

CREATE POLICY "Delete quote-pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'quote-pdfs'
  AND app_private.has_company_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    ARRAY['company_admin','manager','project_manager','sales']
  )
);
