
-- Time & Attendance -----------------------------------------------------

CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  duration_minutes integer NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  activity text,
  method text NOT NULL DEFAULT 'web' CHECK (method IN ('web','kiosk','pin')),
  photo_url text,
  gps_lat numeric,
  gps_lng numeric,
  note text,
  billable boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','approved')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX time_entries_company_day_idx ON public.time_entries (company_id, clock_in DESC);
CREATE INDEX time_entries_employee_idx ON public.time_entries (employee_id, clock_in DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_entries TO authenticated;
GRANT ALL ON public.time_entries TO service_role;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON public.time_entries FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance','project_manager'])
);
CREATE POLICY "time_entries_insert" ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (
  app_private.has_company_access(auth.uid(), company_id)
  AND (
    employee_id = auth.uid()
    OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  )
);
CREATE POLICY "time_entries_update" ON public.time_entries FOR UPDATE TO authenticated
USING (
  status <> 'approved'
  AND (
    employee_id = auth.uid()
    OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  )
)
WITH CHECK (
  employee_id = auth.uid()
  OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
);
CREATE POLICY "time_entries_delete" ON public.time_entries FOR DELETE TO authenticated
USING (
  status <> 'approved'
  AND (
    employee_id = auth.uid()
    OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  )
);

CREATE TRIGGER trg_time_entries_updated BEFORE UPDATE ON public.time_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Timesheets ------------------------------------------------------------

CREATE TABLE public.timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  regular_minutes integer NOT NULL DEFAULT 0,
  overtime_minutes integer NOT NULL DEFAULT 0,
  break_minutes integer NOT NULL DEFAULT 0,
  leave_minutes integer NOT NULL DEFAULT 0,
  unpaid_leave_minutes integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved')),
  approved_by uuid,
  approved_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id, period_start, period_end)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timesheets TO authenticated;
GRANT ALL ON public.timesheets TO service_role;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "timesheets_select" ON public.timesheets FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance','project_manager'])
);
CREATE POLICY "timesheets_insert" ON public.timesheets FOR INSERT TO authenticated
WITH CHECK (
  app_private.has_company_access(auth.uid(), company_id)
  AND (employee_id = auth.uid()
       OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']))
);
CREATE POLICY "timesheets_update" ON public.timesheets FOR UPDATE TO authenticated
USING (
  app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  OR (employee_id = auth.uid() AND status <> 'approved')
)
WITH CHECK (
  app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  OR (employee_id = auth.uid() AND status <> 'approved')
);
CREATE POLICY "timesheets_delete" ON public.timesheets FOR DELETE TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']));

CREATE TRIGGER trg_timesheets_updated BEFORE UPDATE ON public.timesheets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Schedules -------------------------------------------------------------

CREATE TABLE public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid,
  role text,
  name text,
  start_time time NOT NULL DEFAULT '08:00',
  end_time time NOT NULL DEFAULT '17:00',
  working_days integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  break_minutes integer NOT NULL DEFAULT 60,
  grace_minutes integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedules TO authenticated;
GRANT ALL ON public.schedules TO service_role;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedules_select" ON public.schedules FOR SELECT TO authenticated
USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "schedules_write" ON public.schedules FOR ALL TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']))
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']));

CREATE TRIGGER trg_schedules_updated BEFORE UPDATE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Kiosk credentials -----------------------------------------------------

CREATE TABLE public.kiosk_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  pin_hash text NOT NULL,
  qr_token text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kiosk_credentials TO authenticated;
GRANT ALL ON public.kiosk_credentials TO service_role;
ALTER TABLE public.kiosk_credentials ENABLE ROW LEVEL SECURITY;

-- Hashes are never readable by ordinary members: only company admins/managers
-- may manage them, and PIN verification runs with the service role.
CREATE POLICY "kiosk_credentials_admin" ON public.kiosk_credentials FOR ALL TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']))
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']));

CREATE TRIGGER trg_kiosk_credentials_updated BEFORE UPDATE ON public.kiosk_credentials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Holidays --------------------------------------------------------------

CREATE TABLE public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  date date NOT NULL,
  recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, date, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "holidays_select" ON public.holidays FOR SELECT TO authenticated
USING (app_private.has_company_access(auth.uid(), company_id));
CREATE POLICY "holidays_write" ON public.holidays FOR ALL TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']))
WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']));

CREATE TRIGGER trg_holidays_updated BEFORE UPDATE ON public.holidays
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Leave requests --------------------------------------------------------

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'paid' CHECK (kind IN ('paid','unpaid','sick','other')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  half_day boolean NOT NULL DEFAULT false,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_requests_select" ON public.leave_requests FOR SELECT TO authenticated
USING (
  employee_id = auth.uid()
  OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance','project_manager'])
);
CREATE POLICY "leave_requests_insert" ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  app_private.has_company_access(auth.uid(), company_id)
  AND (employee_id = auth.uid()
       OR app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager']))
);
CREATE POLICY "leave_requests_update" ON public.leave_requests FOR UPDATE TO authenticated
USING (
  app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  OR (employee_id = auth.uid() AND status = 'pending')
)
WITH CHECK (
  app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  OR (employee_id = auth.uid() AND status IN ('pending','cancelled'))
);
CREATE POLICY "leave_requests_delete" ON public.leave_requests FOR DELETE TO authenticated
USING (
  app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager'])
  OR (employee_id = auth.uid() AND status = 'pending')
);

CREATE TRIGGER trg_leave_requests_updated BEFORE UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit -----------------------------------------------------------------

CREATE TABLE public.time_entry_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL,
  actor_id uuid,
  actor_name text,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX time_entry_audit_entry_idx ON public.time_entry_audit (entry_id, created_at DESC);

GRANT SELECT, INSERT ON public.time_entry_audit TO authenticated;
GRANT ALL ON public.time_entry_audit TO service_role;
ALTER TABLE public.time_entry_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entry_audit_select" ON public.time_entry_audit FOR SELECT TO authenticated
USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','finance']));
CREATE POLICY "time_entry_audit_insert" ON public.time_entry_audit FOR INSERT TO authenticated
WITH CHECK (app_private.has_company_access(auth.uid(), company_id));

-- Realtime for the live attendance board
ALTER TABLE public.time_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
