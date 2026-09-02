CREATE TABLE public.payment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  status text NOT NULL DEFAULT 'open',
  released_by uuid,
  released_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, run_date)
);

CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.payment_runs(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'bill',
  expense_id uuid,
  supplier_id uuid,
  payee text,
  title text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MGA',
  account_id uuid,
  project_id uuid,
  attachment_url text,
  attachment_name text,
  status text NOT NULL DEFAULT 'draft',
  off_cycle boolean NOT NULL DEFAULT false,
  off_cycle_reason text,
  needed_by date,
  requested_by uuid,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_id uuid NOT NULL REFERENCES public.payment_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_requests_company_status ON public.payment_requests (company_id, status);
CREATE INDEX idx_payment_requests_run ON public.payment_requests (run_id);
CREATE INDEX idx_payment_request_events_request ON public.payment_request_events (request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_runs TO authenticated;
GRANT ALL ON public.payment_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
GRANT SELECT, INSERT ON public.payment_request_events TO authenticated;
GRANT ALL ON public.payment_request_events TO service_role;

ALTER TABLE public.payment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View payment runs" ON public.payment_runs FOR SELECT TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Write payment runs" ON public.payment_runs FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance','project_manager']));
CREATE POLICY "Update payment runs" ON public.payment_runs FOR UPDATE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "Delete payment runs" ON public.payment_runs FOR DELETE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','finance']));

CREATE POLICY "View payment requests" ON public.payment_requests FOR SELECT TO authenticated
  USING (
    app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance'])
    OR (app_private.has_company_access(auth.uid(), company_id) AND requested_by = auth.uid())
  );
CREATE POLICY "Create payment requests" ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id) AND requested_by = auth.uid());
CREATE POLICY "Update payment requests" ON public.payment_requests FOR UPDATE TO authenticated
  USING (
    app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance'])
    OR (app_private.has_company_access(auth.uid(), company_id) AND requested_by = auth.uid() AND status IN ('draft','submitted'))
  )
  WITH CHECK (
    app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance'])
    OR (app_private.has_company_access(auth.uid(), company_id) AND requested_by = auth.uid())
  );
CREATE POLICY "Delete payment requests" ON public.payment_requests FOR DELETE TO authenticated
  USING (
    app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','finance'])
    OR (app_private.has_company_access(auth.uid(), company_id) AND requested_by = auth.uid() AND status = 'draft')
  );

CREATE POLICY "View payment request events" ON public.payment_request_events FOR SELECT TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "Write payment request events" ON public.payment_request_events FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_payment_runs_updated BEFORE UPDATE ON public.payment_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_payment_requests_updated BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.decide_payment_request(
  _request_id uuid,
  _decision text,
  _note text DEFAULT NULL
)
RETURNS public.payment_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.payment_requests;
  uid uuid := auth.uid();
  is_finance boolean;
  is_admin boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found';
  END IF;

  is_finance := app_private.has_company_role(uid, req.company_id, ARRAY['company_admin','manager','finance']);
  is_admin := public.has_role(uid, 'super_admin') OR public.has_role(uid, 'group_admin');

  IF req.requested_by = uid AND NOT is_admin THEN
    RAISE EXCEPTION 'You cannot decide on your own payment request';
  END IF;

  IF _decision = 'review' THEN
    IF NOT (is_finance OR is_admin) THEN
      RAISE EXCEPTION 'Only finance can review payment requests';
    END IF;
    IF req.status <> 'submitted' THEN
      RAISE EXCEPTION 'Only submitted requests can be reviewed';
    END IF;
    UPDATE public.payment_requests
      SET status = 'reviewed', reviewed_by = uid, reviewed_at = now()
      WHERE id = _request_id RETURNING * INTO req;
  ELSIF _decision = 'approve' THEN
    IF NOT is_admin THEN
      RAISE EXCEPTION 'Only a group or super administrator can approve payments';
    END IF;
    IF req.status NOT IN ('submitted','reviewed') THEN
      RAISE EXCEPTION 'Only submitted or reviewed requests can be approved';
    END IF;
    UPDATE public.payment_requests
      SET status = 'approved', approved_by = uid, approved_at = now()
      WHERE id = _request_id RETURNING * INTO req;
  ELSIF _decision = 'reject' THEN
    IF NOT (is_finance OR is_admin) THEN
      RAISE EXCEPTION 'You cannot reject this payment request';
    END IF;
    IF req.status IN ('paid','cancelled') THEN
      RAISE EXCEPTION 'This request can no longer be rejected';
    END IF;
    UPDATE public.payment_requests
      SET status = 'rejected', rejected_by = uid, rejected_at = now(), rejection_reason = _note
      WHERE id = _request_id RETURNING * INTO req;
  ELSIF _decision = 'pay' THEN
    IF NOT (is_finance OR is_admin) THEN
      RAISE EXCEPTION 'Only finance can mark a payment as paid';
    END IF;
    IF req.status <> 'approved' THEN
      RAISE EXCEPTION 'Only approved requests can be paid';
    END IF;
    UPDATE public.payment_requests
      SET status = 'paid', paid_at = now()
      WHERE id = _request_id RETURNING * INTO req;
  ELSE
    RAISE EXCEPTION 'Unknown decision %', _decision;
  END IF;

  INSERT INTO public.payment_request_events (company_id, request_id, action, to_status, note, actor_id)
  VALUES (req.company_id, req.id, _decision, req.status, _note, uid);

  RETURN req;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_payment_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_payment_request(uuid, text, text) TO authenticated;