-- Columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS ingestion_date date,
  ADD COLUMN IF NOT EXISTS handover_proof_url text,
  ADD COLUMN IF NOT EXISTS handover_proof_name text,
  ADD COLUMN IF NOT EXISTS handover_stamped_at timestamptz,
  ADD COLUMN IF NOT EXISTS handover_by text,
  ADD COLUMN IF NOT EXISTS dating_note text;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS buying_entity text;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_cycle text,
  ADD COLUMN IF NOT EXISTS funding_invoice_id uuid,
  ADD COLUMN IF NOT EXISTS medical_claim boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reimbursable_pct numeric;

-- PVR records
CREATE TABLE IF NOT EXISTS public.pvr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid,
  project_id uuid,
  quote_id uuid,
  reference text,
  signed_date date NOT NULL,
  completion_pct numeric NOT NULL DEFAULT 100,
  signed_by text,
  scm_coordinator text,
  document_url text,
  document_name text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pvr_records TO authenticated;
GRANT ALL ON public.pvr_records TO service_role;
ALTER TABLE public.pvr_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pvr_records" ON public.pvr_records FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Write pvr_records" ON public.pvr_records FOR INSERT TO authenticated
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Update pvr_records" ON public.pvr_records FOR UPDATE TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Delete pvr_records" ON public.pvr_records FOR DELETE TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

CREATE TRIGGER trg_pvr_records_updated BEFORE UPDATE ON public.pvr_records
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoice escalations
CREATE TABLE IF NOT EXISTS public.invoice_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL,
  stage integer NOT NULL,
  action text NOT NULL,
  notes text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  performed_by uuid,
  performed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_escalations TO authenticated;
GRANT ALL ON public.invoice_escalations TO service_role;
ALTER TABLE public.invoice_escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View invoice_escalations" ON public.invoice_escalations FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Write invoice_escalations" ON public.invoice_escalations FOR INSERT TO authenticated
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Update invoice_escalations" ON public.invoice_escalations FOR UPDATE TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Delete invoice_escalations" ON public.invoice_escalations FOR DELETE TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

CREATE TRIGGER trg_invoice_escalations_updated BEFORE UPDATE ON public.invoice_escalations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_pvr_records_company ON public.pvr_records(company_id);
CREATE INDEX IF NOT EXISTS idx_pvr_invoice ON public.pvr_records(invoice_id);
CREATE INDEX IF NOT EXISTS idx_escalations_invoice ON public.invoice_escalations(invoice_id);