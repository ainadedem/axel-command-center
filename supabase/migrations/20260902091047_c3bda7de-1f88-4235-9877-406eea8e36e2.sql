CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'todo',
  priority text NOT NULL DEFAULT 'normal',
  due_date date,
  assigned_to uuid[] NOT NULL DEFAULT '{}',
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_request_id uuid REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_company ON public.tasks(company_id);
CREATE INDEX idx_tasks_project ON public.tasks(project_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select" ON public.tasks FOR SELECT TO authenticated
USING (
  app_private.has_company_access(auth.uid(), company_id)
  AND (
    NOT public.has_role(auth.uid(), 'sales')
    OR created_by = auth.uid()
    OR auth.uid() = ANY(assigned_to)
  )
);

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated
WITH CHECK (
  app_private.has_company_access(auth.uid(), company_id)
  AND created_by = auth.uid()
);

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated
USING (
  app_private.has_company_access(auth.uid(), company_id)
  AND (
    NOT public.has_role(auth.uid(), 'sales')
    OR created_by = auth.uid()
    OR auth.uid() = ANY(assigned_to)
  )
)
WITH CHECK (app_private.has_company_access(auth.uid(), company_id));

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE TO authenticated
USING (
  app_private.has_company_access(auth.uid(), company_id)
  AND (
    created_by = auth.uid()
    OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
    OR public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'group_admin')
  )
);

CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_task()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN NEW.assigned_to := '{}'; END IF;
  IF array_length(NEW.assigned_to, 1) > 3 THEN
    RAISE EXCEPTION 'A task can have at most 3 assignees';
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_validate BEFORE INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task();