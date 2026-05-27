
-- Dedupe by keeping the oldest row per (company_id, name)
WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY created_at, id) rn
  FROM public.clients
) DELETE FROM public.clients WHERE id IN (SELECT id FROM dups WHERE rn > 1);

WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY created_at, id) rn
  FROM public.suppliers
) DELETE FROM public.suppliers WHERE id IN (SELECT id FROM dups WHERE rn > 1);

WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY created_at, id) rn
  FROM public.categories
) DELETE FROM public.categories WHERE id IN (SELECT id FROM dups WHERE rn > 1);

WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY created_at, id) rn
  FROM public.opportunities
) DELETE FROM public.opportunities WHERE id IN (SELECT id FROM dups WHERE rn > 1);

WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY created_at, id) rn
  FROM public.projects
) DELETE FROM public.projects WHERE id IN (SELECT id FROM dups WHERE rn > 1);

WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, name ORDER BY created_at, id) rn
  FROM public.accounts
) DELETE FROM public.accounts WHERE id IN (SELECT id FROM dups WHERE rn > 1);

-- Unique indexes to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS clients_company_name_key       ON public.clients       (company_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_company_name_key     ON public.suppliers     (company_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS categories_company_name_key    ON public.categories    (company_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_company_name_key ON public.opportunities (company_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS projects_company_name_key      ON public.projects      (company_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_company_name_key      ON public.accounts      (company_id, name);
