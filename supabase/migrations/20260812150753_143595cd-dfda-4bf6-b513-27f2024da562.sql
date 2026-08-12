ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.invoice_lines ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE TABLE IF NOT EXISTS public.document_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('quote','invoice','po')),
  doc_id uuid NOT NULL,
  doc_number text,
  action text NOT NULL,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.document_activity TO authenticated;
GRANT ALL ON public.document_activity TO service_role;

ALTER TABLE public.document_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read company document activity"
ON public.document_activity FOR SELECT TO authenticated
USING (app_private.has_company_access(auth.uid(), company_id));

CREATE POLICY "Members append company document activity"
ON public.document_activity FOR INSERT TO authenticated
WITH CHECK (app_private.has_company_access(auth.uid(), company_id) AND actor_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_document_activity_doc ON public.document_activity (doc_type, doc_id, created_at DESC);