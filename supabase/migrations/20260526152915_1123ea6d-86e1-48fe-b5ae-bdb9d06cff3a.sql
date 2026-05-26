
-- ============== CLIENTS =================================================
CREATE TABLE public.clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  country      text,
  status       text CHECK (status IN ('lead','client')),
  acquisition  text,
  referral     text,
  acquired_at  date,
  acquisition_year int,
  avatar_url   text,
  website      text,
  email        text,
  phone        text,
  address      text,
  industry     text,
  contacts     text,
  tax_id       text,
  nif          text,
  stat         text,
  rcs          text,
  categories   text[],
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access clients in their companies"
  ON public.clients FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_clients_company ON public.clients(company_id);

-- ============== SUPPLIERS ===============================================
CREATE TABLE public.suppliers (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name           text NOT NULL,
  account        text NOT NULL,
  kind           text NOT NULL DEFAULT 'external' CHECK (kind IN ('external','internal')),
  avatar_url     text,
  contact_person text,
  email          text,
  phone          text,
  website        text,
  address        text,
  country        text,
  payment_terms  int,
  tax_id         text,
  nif            text,
  stat           text,
  rcs            text,
  bank_name      text,
  bank_account   text,
  bank_swift     text,
  notes          text,
  categories     text[],
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access suppliers in their companies"
  ON public.suppliers FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_suppliers_company ON public.suppliers(company_id);

-- ============== PROJECTS ================================================
CREATE TABLE public.projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id   uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name        text NOT NULL,
  revenue     numeric(18,2) NOT NULL DEFAULT 0,
  cost        numeric(18,2) NOT NULL DEFAULT 0,
  currency    text NOT NULL DEFAULT 'MGA',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access projects in their companies"
  ON public.projects FOR ALL TO authenticated
  USING (app_private.has_company_access(auth.uid(), company_id))
  WITH CHECK (app_private.has_company_access(auth.uid(), company_id));
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_projects_company ON public.projects(company_id);
CREATE INDEX idx_projects_client  ON public.projects(client_id);
