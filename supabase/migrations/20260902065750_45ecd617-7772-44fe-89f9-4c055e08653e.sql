CREATE TABLE public.project_stages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  key text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  owner text,
  planned_start date,
  due_date date,
  completed_at timestamp with time zone,
  blocked_reason text,
  notes text,
  auto boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE INDEX project_stages_project_idx ON public.project_stages (project_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stages TO authenticated;
GRANT ALL ON public.project_stages TO service_role;

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project stages" ON public.project_stages FOR SELECT TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Write project stages" ON public.project_stages FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Update project stages" ON public.project_stages FOR UPDATE TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Delete project stages" ON public.project_stages FOR DELETE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin'::text, 'manager'::text, 'project_manager'::text]));

CREATE TRIGGER update_project_stages_updated_at BEFORE UPDATE ON public.project_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.project_stage_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  stages jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stage_templates TO authenticated;
GRANT ALL ON public.project_stage_templates TO service_role;

ALTER TABLE public.project_stage_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View stage templates" ON public.project_stage_templates FOR SELECT TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Manage stage templates" ON public.project_stage_templates FOR ALL TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin'::text, 'manager'::text, 'project_manager'::text]))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin'::text, 'manager'::text, 'project_manager'::text]));

CREATE TRIGGER update_project_stage_templates_updated_at BEFORE UPDATE ON public.project_stage_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.project_stage_templates (company_id, name, stages, is_default)
SELECT c.id, 'Default', '[
  {"key":"quote","name":"Quote","auto":true},
  {"key":"po","name":"PO","auto":true},
  {"key":"kickoff","name":"Kickoff","auto":false},
  {"key":"execution","name":"Execution","auto":false},
  {"key":"review","name":"Review","auto":false},
  {"key":"delivery","name":"Delivery","auto":false},
  {"key":"pvr","name":"PVR / acceptance","auto":true},
  {"key":"invoice","name":"Invoice","auto":true},
  {"key":"paid","name":"Paid","auto":true}
]'::jsonb, true
FROM public.companies c;