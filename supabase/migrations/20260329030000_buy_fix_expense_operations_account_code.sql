-- ============================================================================
-- FIX BUG-P003: Missing account code for expense.operations category
-- ============================================================================
-- PROBLEM:
--   The category 'operations' exists in the Expenses UI (Edit dialog dropdown)
--   but had no mapping in get_user_account_code(). When auto_journal_expense
--   fires for an expense with category='operations', it calls
--   get_user_account_code(user_id, 'expense.operations') which falls through
--   to the ELSE branch returning '658' (expense.other) instead of a proper
--   operations account code.
--
-- CORRECT CODES:
--   PCG France   : 615 (entretien et réparations)
--   PCMN Belgique: 6150
--   SYSCOHADA    : 636 (charges de personnel temporaire / charges diverses exploitation)
--
-- FIX: Add WHEN 'expense.operations' to get_user_account_code()
-- This uses CREATE OR REPLACE — the function signature is unchanged,
-- only the CASE body gains one more WHEN branch.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_account_code(
  p_user_id UUID,
  p_mapping_key TEXT,
  p_source_category TEXT DEFAULT 'general'
)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_country TEXT;
  v_custom_code TEXT;
BEGIN
  -- Resolve country from user_accounting_settings, fallback to company.country, fallback to 'BE'
  SELECT COALESCE(uas.country, c.country, 'BE')
  INTO v_country
  FROM user_accounting_settings uas
  LEFT JOIN company c ON c.user_id = uas.user_id
  WHERE uas.user_id = p_user_id
  LIMIT 1;

  IF v_country IS NULL THEN
    SELECT COALESCE(country, 'BE') INTO v_country
    FROM company
    WHERE user_id = p_user_id
    LIMIT 1;
  END IF;

  IF v_country IS NULL THEN
    v_country := 'BE';
  END IF;

  -- Custom mapping overrides (per-company configuration)
  SELECT debit_account_code INTO v_custom_code
  FROM accounting_mappings
  WHERE user_id = p_user_id
    AND source_type = SPLIT_PART(p_mapping_key, '.', 1)
    AND source_category = CASE
      WHEN POSITION('.' IN p_mapping_key) > 0 THEN SPLIT_PART(p_mapping_key, '.', 2)
      ELSE p_source_category
    END
  LIMIT 1;

  IF v_custom_code IS NOT NULL THEN
    RETURN v_custom_code;
  END IF;

  -- Default account codes by country/chart of accounts
  RETURN CASE p_mapping_key
    -- ── Clients / Créances ─────────────────────────────────────────────
    WHEN 'client' THEN CASE
      WHEN v_country = 'FR' THEN '411'
      WHEN v_country = 'OHADA' THEN '411'
      ELSE '400' END
    -- ── Produits / Revenue ─────────────────────────────────────────────
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
    -- ── Banque / Caisse ────────────────────────────────────────────────
    WHEN 'bank' THEN CASE
      WHEN v_country = 'FR' THEN '512'
      WHEN v_country = 'OHADA' THEN '521'
      ELSE '550' END
    WHEN 'cash' THEN CASE
      WHEN v_country = 'FR' THEN '530'
      WHEN v_country = 'OHADA' THEN '571'
      ELSE '570' END
    -- ── TVA ────────────────────────────────────────────────────────────
    WHEN 'vat_output' THEN CASE
      WHEN v_country = 'FR' THEN '44571'
      WHEN v_country = 'OHADA' THEN '4431'
      ELSE '4510' END
    WHEN 'vat_input' THEN CASE
      WHEN v_country = 'FR' THEN '44566'
      WHEN v_country = 'OHADA' THEN '4452'
      ELSE '4110' END
    -- ── Fournisseurs ───────────────────────────────────────────────────
    WHEN 'supplier' THEN CASE
      WHEN v_country = 'FR' THEN '401'
      WHEN v_country = 'OHADA' THEN '401'
      ELSE '440' END
    -- ── Achats ─────────────────────────────────────────────────────────
    WHEN 'purchase' THEN CASE
      WHEN v_country = 'FR' THEN '607'
      WHEN v_country = 'OHADA' THEN '607'
      ELSE '604' END
    WHEN 'purchase.goods' THEN CASE
      WHEN v_country = 'FR' THEN '607'
      WHEN v_country = 'OHADA' THEN '601'
      ELSE '604' END
    WHEN 'purchase.services' THEN CASE
      WHEN v_country = 'FR' THEN '604'
      WHEN v_country = 'OHADA' THEN '611'
      ELSE '6100' END
    WHEN 'purchase.supplies' THEN CASE
      WHEN v_country = 'FR' THEN '602'
      WHEN v_country = 'OHADA' THEN '602'
      ELSE '602' END
    -- ── Charges générales ─────────────────────────────────────────────
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
    -- BUG-P003 FIX: 'operations' category was in UI but missing from account code lookup.
    -- Operations → entretien/réparations/charges d'exploitation:
    --   PCG France: 615 (entretien et réparations)
    --   PCMN Belgique: 6150
    --   SYSCOHADA: 636 (charges de personnel temporaire / exploitation diverses)
    WHEN 'expense.operations' THEN CASE
      WHEN v_country = 'OHADA' THEN '636'
      WHEN v_country = 'FR' THEN '615'
      ELSE '6150' END
    WHEN 'expense.other' THEN CASE
      WHEN v_country = 'OHADA' THEN '658'
      WHEN v_country = 'FR' THEN '658'
      ELSE '658' END
    ELSE '658'
  END;
END;
$$;

COMMENT ON FUNCTION public.get_user_account_code(UUID, TEXT, TEXT) IS
  'Resolves account codes by user country (PCG France / PCMN Belgique / SYSCOHADA).
   Checks custom accounting_mappings first, then falls back to country defaults.
   BUG-P003 FIX (2026-03-29): Added expense.operations mapping (FR:615, BE:6150, OHADA:636).
   Also added purchase/purchase.goods/purchase.services mappings.';
