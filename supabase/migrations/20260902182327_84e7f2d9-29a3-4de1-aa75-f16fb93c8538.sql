-- 1. Notifications: prevent pushing notifications to arbitrary users
DROP POLICY IF EXISTS "notifications_insert_company" ON public.notifications;
CREATE POLICY "notifications_insert_company" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (company_id IS NULL OR app_private.has_company_access(auth.uid(), company_id))
    AND (
      user_id = auth.uid()
      OR (company_id IS NOT NULL AND app_private.has_company_access(user_id, company_id))
    )
  );

-- 2. Project stages: restrict writes to management roles (same as delete)
DROP POLICY IF EXISTS "Write project stages" ON public.project_stages;
CREATE POLICY "Write project stages" ON public.project_stages
  FOR INSERT TO authenticated
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']));

DROP POLICY IF EXISTS "Update project stages" ON public.project_stages;
CREATE POLICY "Update project stages" ON public.project_stages
  FOR UPDATE TO authenticated
  USING (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']))
  WITH CHECK (app_private.has_company_role(auth.uid(), company_id, ARRAY['company_admin','manager','project_manager']));
