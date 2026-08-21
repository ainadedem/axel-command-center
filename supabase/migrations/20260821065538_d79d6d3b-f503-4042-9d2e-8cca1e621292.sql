CREATE TABLE public.journal_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  journal text NOT NULL,
  date date NOT NULL,
  piece text NOT NULL,
  description text NOT NULL DEFAULT '',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View journal entries" ON public.journal_entries FOR SELECT TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Write journal entries" ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Update journal entries" ON public.journal_entries FOR UPDATE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Delete journal entries" ON public.journal_entries FOR DELETE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));

CREATE UNIQUE INDEX journal_entries_company_key ON public.journal_entries (company_id, journal, date, piece);
CREATE INDEX journal_entries_company_date ON public.journal_entries (company_id, date);

CREATE TRIGGER trg_journal_entries_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();