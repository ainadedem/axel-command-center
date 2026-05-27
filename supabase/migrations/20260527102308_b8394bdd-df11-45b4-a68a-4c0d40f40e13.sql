
-- OPPORTUNITIES
CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  client text NOT NULL,
  client_id uuid,
  closer text,
  stage text NOT NULL DEFAULT 'Lead',
  value numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MGA',
  expected_close date,
  probability numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.opportunities TO authenticated;
GRANT ALL ON public.opportunities TO service_role;
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access opportunities in their companies" ON public.opportunities
  FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- QUOTES
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid,
  project_id uuid,
  number text NOT NULL,
  issue_date date NOT NULL,
  valid_until date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MGA',
  status text NOT NULL DEFAULT 'draft',
  notes text,
  mode text,
  lines jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access quotes in their companies" ON public.quotes
  FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid,
  project_id uuid,
  quote_id uuid,
  number text NOT NULL,
  client_reference text,
  issue_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MGA',
  status text NOT NULL DEFAULT 'draft',
  document_url text,
  document_name text,
  document_type text,
  document_uploaded_at timestamptz,
  document_history jsonb,
  lines jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access purchase_orders in their companies" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER update_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- EXPENSES
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'bill',
  supplier_id uuid,
  payee text,
  number text,
  issue_date date NOT NULL,
  due_date date,
  amount numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MGA',
  status text NOT NULL DEFAULT 'draft',
  account text,
  category text,
  description text,
  project_id uuid,
  attachment_url text,
  attachment_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access expenses in their companies" ON public.expenses
  FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RECURRING BILLINGS
CREATE TABLE public.recurring_billings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  client_id uuid,
  project_id uuid,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MGA',
  frequency text NOT NULL DEFAULT 'monthly',
  start_date date NOT NULL,
  next_run_date date NOT NULL,
  end_date date,
  payment_terms_days integer,
  active boolean NOT NULL DEFAULT true,
  last_generated_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_billings TO authenticated;
GRANT ALL ON public.recurring_billings TO service_role;
ALTER TABLE public.recurring_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access recurring_billings in their companies" ON public.recurring_billings
  FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER update_recurring_billings_updated_at BEFORE UPDATE ON public.recurring_billings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TEAM MEMBERS (global org directory)
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  first_name text,
  last_name text,
  email text,
  phone text,
  job_title text,
  department text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users access team_members" ON public.team_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SALES MEMBERS
CREATE TABLE public.sales_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'closer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_members TO authenticated;
GRANT ALL ON public.sales_members TO service_role;
ALTER TABLE public.sales_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users access sales_members" ON public.sales_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_sales_members_updated_at BEFORE UPDATE ON public.sales_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SALARY REGISTER
CREATE TABLE public.salary_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL,
  company_id uuid NOT NULL,
  gross numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'MGA',
  cnaps_rate numeric NOT NULL DEFAULT 1,
  ostie_rate numeric NOT NULL DEFAULT 1,
  irsa_rate numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_register TO authenticated;
GRANT ALL ON public.salary_register TO service_role;
ALTER TABLE public.salary_register ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access salary_register in their companies" ON public.salary_register
  FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER update_salary_register_updated_at BEFORE UPDATE ON public.salary_register
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAYROLL RUNS
CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  month text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  currency text NOT NULL DEFAULT 'MGA',
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  validated_at timestamptz,
  posted_transaction_ids jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT ALL ON public.payroll_runs TO service_role;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access payroll_runs in their companies" ON public.payroll_runs
  FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
