CREATE OR REPLACE FUNCTION public.document_numbers(_company_id uuid, _kind text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '{}';
  END IF;
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'group_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid() AND uca.company_id = _company_id
    )
  ) THEN
    RETURN '{}';
  END IF;

  IF _kind = 'invoice' THEN
    SELECT array_agg(number) INTO result FROM public.invoices
      WHERE company_id = _company_id AND number IS NOT NULL AND btrim(number) <> '';
  ELSIF _kind = 'quote' THEN
    SELECT array_agg(number) INTO result FROM public.quotes
      WHERE company_id = _company_id AND number IS NOT NULL AND btrim(number) <> '';
  ELSIF _kind = 'po' THEN
    SELECT array_agg(number) INTO result FROM public.purchase_orders
      WHERE company_id = _company_id AND number IS NOT NULL AND btrim(number) <> '';
  ELSE
    RETURN '{}';
  END IF;

  RETURN COALESCE(result, '{}');
END;
$$;

REVOKE ALL ON FUNCTION public.document_numbers(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.document_numbers(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_numbers(uuid, text) TO service_role;