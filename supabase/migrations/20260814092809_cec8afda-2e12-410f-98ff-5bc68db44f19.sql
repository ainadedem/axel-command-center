ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS assigned_to uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS next_follow_up_at date;

CREATE OR REPLACE FUNCTION public.validate_quote_assignees()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS NULL THEN
    NEW.assigned_to := '{}';
  END IF;
  IF array_length(NEW.assigned_to, 1) > 3 THEN
    RAISE EXCEPTION 'A quotation can have at most 3 assignees';
  END IF;
  IF array_length(NEW.assigned_to, 1) IS DISTINCT FROM array_length(ARRAY(SELECT DISTINCT unnest(NEW.assigned_to)), 1) THEN
    RAISE EXCEPTION 'Duplicate assignees are not allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_validate_assignees ON public.quotes;
CREATE TRIGGER trg_quotes_validate_assignees
BEFORE INSERT OR UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.validate_quote_assignees();

DROP POLICY IF EXISTS "View quotes" ON public.quotes;
CREATE POLICY "View quotes" ON public.quotes
FOR SELECT TO authenticated
USING (
  app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance','project_manager'])
  OR (app_private.has_company_access(auth.uid(), company_id) AND created_by = auth.uid())
  OR (app_private.has_company_access(auth.uid(), company_id) AND auth.uid() = ANY(assigned_to))
);

CREATE TABLE IF NOT EXISTS public.quote_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'note',
  note text NOT NULL DEFAULT '',
  happened_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_followups TO authenticated;
GRANT ALL ON public.quote_followups TO service_role;

ALTER TABLE public.quote_followups ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_touch_quote(_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = _quote_id
      AND (
        app_private.has_company_role(auth.uid(), q.company_id, ARRAY['company_admin','manager','finance','project_manager'])
        OR (app_private.has_company_access(auth.uid(), q.company_id) AND q.created_by = auth.uid())
        OR (app_private.has_company_access(auth.uid(), q.company_id) AND auth.uid() = ANY(q.assigned_to))
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_touch_quote(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_touch_quote(uuid) TO authenticated;

CREATE POLICY "View quote followups" ON public.quote_followups
FOR SELECT TO authenticated
USING (public.can_touch_quote(quote_id));

CREATE POLICY "Add quote followups" ON public.quote_followups
FOR INSERT TO authenticated
WITH CHECK (public.can_touch_quote(quote_id));

CREATE POLICY "Update quote followups" ON public.quote_followups
FOR UPDATE TO authenticated
USING (public.can_touch_quote(quote_id) AND created_by = auth.uid())
WITH CHECK (public.can_touch_quote(quote_id) AND created_by = auth.uid());

CREATE POLICY "Delete quote followups" ON public.quote_followups
FOR DELETE TO authenticated
USING (public.can_touch_quote(quote_id) AND created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.set_followup_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_followups_created_by ON public.quote_followups;
CREATE TRIGGER trg_quote_followups_created_by
BEFORE INSERT OR UPDATE ON public.quote_followups
FOR EACH ROW EXECUTE FUNCTION public.set_followup_created_by();

DROP TRIGGER IF EXISTS trg_quote_followups_updated ON public.quote_followups;
CREATE TRIGGER trg_quote_followups_updated
BEFORE UPDATE ON public.quote_followups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_quote_followups_quote ON public.quote_followups(quote_id);
CREATE INDEX IF NOT EXISTS idx_quotes_assigned_to ON public.quotes USING gin(assigned_to);