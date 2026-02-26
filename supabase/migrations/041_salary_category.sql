-- 041: Add salary category to account resolver
-- Extends resolve_account_code and get_user_account_code to handle salary-related categories

-- Add salary mapping to accounting_mappings if not exists
INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, description, is_active)
SELECT
  u.user_id, 'expense', 'salary', '6411', '421', 'Salaires et appointements', true
FROM user_accounting_settings u
WHERE u.is_initialized = true
AND NOT EXISTS (
  SELECT 1 FROM accounting_mappings m
  WHERE m.user_id = u.user_id AND m.source_type = 'expense' AND m.source_category = 'salary'
)
ON CONFLICT DO NOTHING;

-- Add social charges mapping
INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, description, is_active)
SELECT
  u.user_id, 'expense', 'social_charges', '645', '43', 'Charges sociales', true
FROM user_accounting_settings u
WHERE u.is_initialized = true
AND NOT EXISTS (
  SELECT 1 FROM accounting_mappings m
  WHERE m.user_id = u.user_id AND m.source_type = 'expense' AND m.source_category = 'social_charges'
)
ON CONFLICT DO NOTHING;
