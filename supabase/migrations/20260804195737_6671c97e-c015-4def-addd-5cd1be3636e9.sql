ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_accounts jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS bank_account_id text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS bank_account_id text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS bank_account_id text;

UPDATE public.companies
SET bank_accounts = jsonb_build_array(
  jsonb_strip_nulls(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'label', COALESCE(NULLIF(bank_name, ''), 'Primary account'),
    'bankName', bank_name,
    'bankAccount', bank_account,
    'bankSwift', bank_swift,
    'bankHolder', bank_holder,
    'bankCode', bank_code,
    'branchCode', branch_code,
    'accountNumber', account_number,
    'ribKey', rib_key,
    'iban', iban,
    'intlEnabled', intl_enabled,
    'mobileEnabled', mobile_enabled,
    'mobileProvider', mobile_provider,
    'mobileNumber', mobile_number,
    'mobileName', mobile_name,
    'isDefault', true
  ))
)
WHERE bank_accounts = '[]'::jsonb
  AND (COALESCE(bank_name,'') <> '' OR COALESCE(account_number,'') <> '' OR COALESCE(iban,'') <> '' OR COALESCE(mobile_number,'') <> '');