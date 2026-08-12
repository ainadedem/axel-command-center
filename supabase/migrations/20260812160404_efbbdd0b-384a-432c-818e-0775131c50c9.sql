-- 1. sales_members read policy scoped to visible team members
DROP POLICY IF EXISTS "Users view sales_members for visible team" ON public.sales_members;
CREATE POLICY "Users view sales_members for visible team"
ON public.sales_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = sales_members.team_member_id
      AND (
        app_private.is_group_admin(auth.uid())
        OR tm.is_global
        OR (tm.company_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_company_access uca
          WHERE uca.user_id = auth.uid() AND uca.company_id = tm.company_id
        ))
      )
  )
);

-- 2. quotes.created_by immutable after insert
CREATE OR REPLACE FUNCTION public.freeze_created_by()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.created_by := OLD.created_by;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.freeze_created_by() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_quotes_freeze_created_by ON public.quotes;
CREATE TRIGGER trg_quotes_freeze_created_by
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.freeze_created_by();

DROP TRIGGER IF EXISTS trg_invoices_freeze_created_by ON public.invoices;
CREATE TRIGGER trg_invoices_freeze_created_by
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.freeze_created_by();

DROP TRIGGER IF EXISTS trg_purchase_orders_freeze_created_by ON public.purchase_orders;
CREATE TRIGGER trg_purchase_orders_freeze_created_by
BEFORE UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.freeze_created_by();

-- 3. has_role: drop the misleading self-only restriction and stop running as definer.
-- Row visibility is already enforced by RLS on user_roles (own rows, or group admins).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4. numbering helper must never be callable anonymously
REVOKE EXECUTE ON FUNCTION public.document_numbers(uuid, text) FROM anon;