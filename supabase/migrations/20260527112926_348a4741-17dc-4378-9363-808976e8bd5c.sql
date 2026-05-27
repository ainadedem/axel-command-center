
-- Dedupe: keep oldest row per (company_id, number)
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY company_id, number ORDER BY created_at, id) AS rn
  FROM public.quotes
)
DELETE FROM public.quotes WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY company_id, number ORDER BY created_at, id) AS rn
  FROM public.purchase_orders
)
DELETE FROM public.purchase_orders WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY company_id, number ORDER BY created_at, id) AS rn
  FROM public.invoices
)
DELETE FROM public.invoices WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS quotes_company_number_uidx ON public.quotes(company_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS purchase_orders_company_number_uidx ON public.purchase_orders(company_id, number);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_company_number_uidx ON public.invoices(company_id, number);
