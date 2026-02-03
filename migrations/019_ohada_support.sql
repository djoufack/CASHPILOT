-- ============================================================================
-- Migration 019: Support OHADA (SYSCOHADA révisé) dans get_user_account_code
-- ============================================================================
-- Ajoute les codes comptables OHADA dans la fonction helper
-- Comptes clés OHADA : 411 (Clients), 521 (Banque), 401 (Fournisseurs),
--   4431 (TVA facturée), 4452 (TVA récupérable), 701 (Ventes marchandises),
--   706 (Services vendus), 571 (Caisse)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_account_code(
  p_user_id UUID,
  p_mapping_key TEXT,
  p_source_category TEXT DEFAULT 'general'
) RETURNS TEXT AS $$
DECLARE
  v_country TEXT;
  v_custom_code TEXT;
BEGIN
  -- Get user country
  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = p_user_id;

  IF v_country IS NULL THEN
    v_country := 'BE';
  END IF;

  -- Check custom mapping first
  SELECT
    CASE
      WHEN p_mapping_key LIKE '%debit%' THEN debit_account_code
      ELSE credit_account_code
    END INTO v_custom_code
  FROM accounting_mappings
  WHERE user_id = p_user_id
    AND source_type = SPLIT_PART(p_mapping_key, '.', 1)
    AND source_category = p_source_category
  LIMIT 1;

  IF v_custom_code IS NOT NULL THEN
    RETURN v_custom_code;
  END IF;

  -- Default account codes by country
  RETURN CASE p_mapping_key
    -- Client accounts
    WHEN 'client' THEN CASE
      WHEN v_country = 'FR' THEN '411'
      WHEN v_country = 'OHADA' THEN '411'
      ELSE '400' END
    -- Revenue accounts
    WHEN 'revenue' THEN CASE
      WHEN v_country = 'FR' THEN '701'
      WHEN v_country = 'OHADA' THEN '701'
      ELSE '700' END
    WHEN 'revenue.service' THEN CASE
      WHEN v_country = 'FR' THEN '706'
      WHEN v_country = 'OHADA' THEN '706'
      ELSE '7061' END
    WHEN 'revenue.product' THEN CASE
      WHEN v_country = 'FR' THEN '701'
      WHEN v_country = 'OHADA' THEN '702'
      ELSE '701' END
    -- Bank accounts
    WHEN 'bank' THEN CASE
      WHEN v_country = 'FR' THEN '512'
      WHEN v_country = 'OHADA' THEN '521'
      ELSE '550' END
    -- Cash accounts
    WHEN 'cash' THEN CASE
      WHEN v_country = 'FR' THEN '530'
      WHEN v_country = 'OHADA' THEN '571'
      ELSE '570' END
    -- VAT accounts
    WHEN 'vat_output' THEN CASE
      WHEN v_country = 'FR' THEN '44571'
      WHEN v_country = 'OHADA' THEN '4431'
      ELSE '4510' END
    WHEN 'vat_input' THEN CASE
      WHEN v_country = 'FR' THEN '44566'
      WHEN v_country = 'OHADA' THEN '4452'
      ELSE '4110' END
    -- Supplier accounts
    WHEN 'supplier' THEN CASE
      WHEN v_country = 'FR' THEN '401'
      WHEN v_country = 'OHADA' THEN '401'
      ELSE '440' END
    -- Expense accounts by category
    WHEN 'expense.general' THEN CASE
      WHEN v_country = 'OHADA' THEN '638'
      WHEN v_country = 'FR' THEN '618'
      ELSE '6180' END
    WHEN 'expense.office' THEN CASE
      WHEN v_country = 'OHADA' THEN '6053'
      WHEN v_country = 'FR' THEN '6064'
      ELSE '6064' END
    WHEN 'expense.travel' THEN CASE
      WHEN v_country = 'OHADA' THEN '6371'
      WHEN v_country = 'FR' THEN '6251'
      ELSE '6251' END
    WHEN 'expense.meals' THEN CASE
      WHEN v_country = 'OHADA' THEN '636'
      WHEN v_country = 'FR' THEN '6257'
      ELSE '6257' END
    WHEN 'expense.transport' THEN CASE
      WHEN v_country = 'OHADA' THEN '618'
      WHEN v_country = 'FR' THEN '6241'
      ELSE '6241' END
    WHEN 'expense.software' THEN CASE
      WHEN v_country = 'OHADA' THEN '634'
      WHEN v_country = 'FR' THEN '6116'
      ELSE '6116' END
    WHEN 'expense.hardware' THEN CASE
      WHEN v_country = 'OHADA' THEN '6054'
      WHEN v_country = 'FR' THEN '6063'
      ELSE '6063' END
    WHEN 'expense.marketing' THEN CASE
      WHEN v_country = 'OHADA' THEN '627'
      WHEN v_country = 'FR' THEN '6231'
      ELSE '6231' END
    WHEN 'expense.legal' THEN CASE
      WHEN v_country = 'OHADA' THEN '6324'
      WHEN v_country = 'FR' THEN '6226'
      ELSE '6226' END
    WHEN 'expense.insurance' THEN CASE
      WHEN v_country = 'OHADA' THEN '625'
      WHEN v_country = 'FR' THEN '616'
      ELSE '616' END
    WHEN 'expense.rent' THEN CASE
      WHEN v_country = 'OHADA' THEN '6222'
      WHEN v_country = 'FR' THEN '6132'
      ELSE '6132' END
    WHEN 'expense.utilities' THEN CASE
      WHEN v_country = 'OHADA' THEN '6051'
      WHEN v_country = 'FR' THEN '6061'
      ELSE '6061' END
    WHEN 'expense.telecom' THEN CASE
      WHEN v_country = 'OHADA' THEN '628'
      WHEN v_country = 'FR' THEN '626'
      ELSE '626' END
    WHEN 'expense.training' THEN CASE
      WHEN v_country = 'OHADA' THEN '633'
      WHEN v_country = 'FR' THEN '6333'
      ELSE '6333' END
    WHEN 'expense.consulting' THEN CASE
      WHEN v_country = 'OHADA' THEN '6324'
      WHEN v_country = 'FR' THEN '6226'
      ELSE '6226' END
    WHEN 'expense.other' THEN CASE
      WHEN v_country = 'OHADA' THEN '658'
      WHEN v_country = 'FR' THEN '658'
      ELSE '658' END
    ELSE '999'
  END;
END;
$$ LANGUAGE plpgsql STABLE;
