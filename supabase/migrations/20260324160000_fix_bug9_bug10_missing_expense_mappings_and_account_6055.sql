-- ============================================================================
-- BUG #9: Account 999 receives 645,000 XAF because categories 'security',
--         'professional_fees', 'transport' have no accounting mappings.
-- BUG #10: Account 6055 shows as "Compte 6055" instead of proper OHADA name.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP 1: Update get_user_account_code to add missing expense categories
--         and change ELSE fallback from '999' to '658' (Charges diverses)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_account_code(
  p_user_id UUID,
  p_mapping_key TEXT,
  p_source_category TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_country TEXT;
  v_custom_code TEXT;
  v_source_type TEXT;
  v_category TEXT;
  v_normalized_key TEXT;
BEGIN
  SELECT country INTO v_country FROM user_accounting_settings WHERE user_id = p_user_id;
  IF v_country IS NULL THEN v_country := 'OHADA'; END IF;

  v_source_type := SPLIT_PART(p_mapping_key, '.', 1);
  v_category := COALESCE(p_source_category, SPLIT_PART(p_mapping_key, '.', 2));

  -- Check accounting_mappings table first (user-defined + system overrides)
  IF v_category IS NOT NULL AND v_category != '' THEN
    SELECT debit_account_code INTO v_custom_code
    FROM accounting_mappings
    WHERE user_id = p_user_id
      AND source_type = v_source_type
      AND source_category = v_category
      AND is_active = true
    LIMIT 1;
    IF v_custom_code IS NOT NULL THEN RETURN v_custom_code; END IF;
  END IF;

  -- Normalize French category labels to internal keys
  v_normalized_key := CASE
    WHEN p_mapping_key ILIKE '%salaire%' OR p_mapping_key ILIKE '%salary%' THEN 'expense.salary'
    WHEN p_mapping_key ILIKE '%loyer%' OR p_mapping_key ILIKE '%rent%' THEN 'expense.rent'
    WHEN p_mapping_key ILIKE '%fourniture%' THEN 'expense.office'
    ELSE p_mapping_key
  END;

  -- Default account codes by country (SYSCOHADA / PCG / PCMN)
  RETURN CASE v_normalized_key
    WHEN 'client' THEN CASE WHEN v_country IN ('FR','OHADA') THEN '411' ELSE '400' END
    WHEN 'revenue' THEN CASE WHEN v_country IN ('FR','OHADA') THEN '701' ELSE '700' END
    WHEN 'revenue.service' THEN CASE WHEN v_country IN ('FR','OHADA') THEN '706' ELSE '7061' END
    WHEN 'revenue.product' THEN CASE WHEN v_country = 'FR' THEN '701' WHEN v_country = 'OHADA' THEN '702' ELSE '701' END
    WHEN 'bank' THEN CASE WHEN v_country = 'FR' THEN '512' WHEN v_country = 'OHADA' THEN '521' ELSE '550' END
    WHEN 'cash' THEN CASE WHEN v_country = 'FR' THEN '530' WHEN v_country = 'OHADA' THEN '571' ELSE '570' END
    WHEN 'check' THEN CASE WHEN v_country = 'FR' THEN '5112' WHEN v_country = 'OHADA' THEN '513' ELSE '550' END
    WHEN 'vat_output' THEN CASE WHEN v_country = 'FR' THEN '44571' WHEN v_country = 'OHADA' THEN '4431' ELSE '4510' END
    WHEN 'vat_input' THEN CASE WHEN v_country = 'FR' THEN '44566' WHEN v_country = 'OHADA' THEN '4452' ELSE '4110' END
    WHEN 'supplier' THEN CASE WHEN v_country IN ('FR','OHADA') THEN '401' ELSE '440' END
    -- Salary
    WHEN 'expense.salary' THEN CASE WHEN v_country = 'OHADA' THEN '661' WHEN v_country = 'FR' THEN '641' ELSE '620' END
    -- Existing expense categories
    WHEN 'expense.general' THEN CASE WHEN v_country = 'OHADA' THEN '638' WHEN v_country = 'FR' THEN '618' ELSE '6180' END
    WHEN 'expense.office' THEN CASE WHEN v_country = 'OHADA' THEN '6053' WHEN v_country = 'FR' THEN '6064' ELSE '6064' END
    WHEN 'expense.travel' THEN CASE WHEN v_country = 'OHADA' THEN '6371' WHEN v_country = 'FR' THEN '6251' ELSE '6251' END
    WHEN 'expense.meals' THEN CASE WHEN v_country = 'OHADA' THEN '636' WHEN v_country = 'FR' THEN '6257' ELSE '6257' END
    WHEN 'expense.transport' THEN CASE WHEN v_country = 'OHADA' THEN '6182' WHEN v_country = 'FR' THEN '6241' ELSE '6241' END
    WHEN 'expense.software' THEN CASE WHEN v_country = 'OHADA' THEN '634' WHEN v_country = 'FR' THEN '6116' ELSE '6116' END
    WHEN 'expense.hardware' THEN CASE WHEN v_country = 'OHADA' THEN '6054' WHEN v_country = 'FR' THEN '6063' ELSE '6063' END
    WHEN 'expense.marketing' THEN CASE WHEN v_country = 'OHADA' THEN '627' WHEN v_country = 'FR' THEN '6231' ELSE '6231' END
    WHEN 'expense.legal' THEN CASE WHEN v_country = 'OHADA' THEN '6324' WHEN v_country = 'FR' THEN '6226' ELSE '6226' END
    WHEN 'expense.consulting' THEN CASE WHEN v_country = 'OHADA' THEN '6324' WHEN v_country = 'FR' THEN '6226' ELSE '6226' END
    WHEN 'expense.insurance' THEN CASE WHEN v_country = 'OHADA' THEN '625' WHEN v_country = 'FR' THEN '616' ELSE '616' END
    WHEN 'expense.rent' THEN CASE WHEN v_country = 'OHADA' THEN '6222' WHEN v_country = 'FR' THEN '6132' ELSE '6132' END
    WHEN 'expense.utilities' THEN CASE WHEN v_country = 'OHADA' THEN '6051' WHEN v_country = 'FR' THEN '6061' ELSE '6061' END
    WHEN 'expense.telecom' THEN CASE WHEN v_country = 'OHADA' THEN '628' WHEN v_country = 'FR' THEN '626' ELSE '626' END
    WHEN 'expense.training' THEN CASE WHEN v_country = 'OHADA' THEN '633' WHEN v_country = 'FR' THEN '6333' ELSE '6333' END
    WHEN 'expense.taxes' THEN CASE WHEN v_country = 'OHADA' THEN '646' WHEN v_country = 'FR' THEN '635' ELSE '635' END
    WHEN 'expense.maintenance' THEN CASE WHEN v_country = 'OHADA' THEN '6155' WHEN v_country = 'FR' THEN '615' ELSE '615' END
    WHEN 'expense.bank_fees' THEN CASE WHEN v_country = 'OHADA' THEN '631' WHEN v_country = 'FR' THEN '627' ELSE '627' END
    WHEN 'expense.depreciation' THEN CASE WHEN v_country = 'OHADA' THEN '681' WHEN v_country = 'FR' THEN '681' ELSE '630' END
    WHEN 'expense.other' THEN CASE WHEN v_country = 'OHADA' THEN '658' WHEN v_country = 'FR' THEN '658' ELSE '658' END
    -- BUG #9 FIX: Add missing expense categories
    WHEN 'expense.security' THEN CASE WHEN v_country = 'OHADA' THEN '637' WHEN v_country = 'FR' THEN '6155' ELSE '6155' END
    WHEN 'expense.professional_fees' THEN CASE WHEN v_country = 'OHADA' THEN '6324' WHEN v_country = 'FR' THEN '6226' ELSE '6226' END
    WHEN 'expense.cleaning' THEN CASE WHEN v_country = 'OHADA' THEN '6144' WHEN v_country = 'FR' THEN '6152' ELSE '6152' END
    WHEN 'expense.communication' THEN CASE WHEN v_country = 'OHADA' THEN '628' WHEN v_country = 'FR' THEN '626' ELSE '626' END
    WHEN 'expense.subscriptions' THEN CASE WHEN v_country = 'OHADA' THEN '6135' WHEN v_country = 'FR' THEN '6184' ELSE '6184' END
    WHEN 'expense.fuel' THEN CASE WHEN v_country = 'OHADA' THEN '6044' WHEN v_country = 'FR' THEN '6062' ELSE '6062' END
    -- Fallback: '658' = Charges diverses de gestion courante (OHADA), NOT '999'
    ELSE '658'
  END;
END;
$$;

-- ---------------------------------------------------------------------------
-- STEP 2: Update ensure_account_exists to know proper names for new accounts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ensure_account_exists(
  p_user_id UUID,
  p_company_id UUID,
  p_account_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name TEXT;
  v_type TEXT;
BEGIN
  IF p_account_code IS NULL THEN RETURN; END IF;

  -- Check if account exists for this company (not just user)
  IF EXISTS (
    SELECT 1 FROM accounting_chart_of_accounts
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND account_code = p_account_code
  ) THEN
    RETURN;
  END IF;

  v_type := CASE
    WHEN p_account_code ~ '^1' THEN 'equity'
    WHEN p_account_code ~ '^[23]' THEN 'asset'
    WHEN p_account_code ~ '^4[01]' THEN 'asset'
    WHEN p_account_code ~ '^44[56]' THEN 'asset'
    WHEN p_account_code ~ '^4' THEN 'liability'
    WHEN p_account_code ~ '^5' THEN 'asset'
    WHEN p_account_code ~ '^6' THEN 'expense'
    WHEN p_account_code ~ '^7' THEN 'revenue'
    ELSE 'expense'
  END;

  v_name := CASE p_account_code
    WHEN '400' THEN 'Clients (PCMN)'
    WHEN '401' THEN 'Fournisseurs'
    WHEN '411' THEN 'Clients'
    WHEN '440' THEN 'Fournisseurs (PCMN)'
    WHEN '4110' THEN 'TVA deductible (PCMN)'
    WHEN '4431' THEN 'TVA facturee (SYSCOHADA)'
    WHEN '44566' THEN 'TVA deductible sur ABS'
    WHEN '44571' THEN 'TVA collectee'
    WHEN '4452' THEN 'TVA recuperable (SYSCOHADA)'
    WHEN '451' THEN 'TVA a payer'
    WHEN '4510' THEN 'TVA a payer (PCMN)'
    WHEN '512' THEN 'Banque'
    WHEN '5112' THEN 'Cheques a encaisser'
    WHEN '513' THEN 'Cheques (SYSCOHADA)'
    WHEN '521' THEN 'Banque (SYSCOHADA)'
    WHEN '530' THEN 'Caisse'
    WHEN '550' THEN 'Banque (PCMN)'
    WHEN '570' THEN 'Caisse (PCMN)'
    WHEN '571' THEN 'Caisse (SYSCOHADA)'
    WHEN '601' THEN 'Achats de matieres premieres'
    WHEN '6044' THEN 'Fournitures de carburant (SYSCOHADA)'
    WHEN '6051' THEN 'Fournitures non stockables (SYSCOHADA)'
    WHEN '6053' THEN 'Fournitures de bureau (SYSCOHADA)'
    WHEN '6054' THEN 'Fournitures informatiques (SYSCOHADA)'
    WHEN '6055' THEN 'Fournitures de bureau et petit materiel'
    WHEN '6061' THEN 'Fournitures non stockables'
    WHEN '6062' THEN 'Carburants'
    WHEN '6063' THEN 'Fournitures informatiques'
    WHEN '6064' THEN 'Fournitures de bureau'
    WHEN '6116' THEN 'Sous-traitance logicielle'
    WHEN '6132' THEN 'Locations immobilieres'
    WHEN '6135' THEN 'Redevances de credit-bail (SYSCOHADA)'
    WHEN '6144' THEN 'Entretien et nettoyage (SYSCOHADA)'
    WHEN '6152' THEN 'Entretien et nettoyage'
    WHEN '6155' THEN 'Entretien materiel (SYSCOHADA)'
    WHEN '615' THEN 'Entretien et reparations'
    WHEN '616' THEN 'Assurances'
    WHEN '618' THEN 'Divers services exterieurs'
    WHEN '6180' THEN 'Divers services exterieurs (PCMN)'
    WHEN '6182' THEN 'Transports (SYSCOHADA)'
    WHEN '6184' THEN 'Abonnements et redevances'
    WHEN '620' THEN 'Remunerations (PCMN)'
    WHEN '624' THEN 'Transports de biens et personnel'
    WHEN '625' THEN 'Assurances (SYSCOHADA)'
    WHEN '6222' THEN 'Loyers (SYSCOHADA)'
    WHEN '6226' THEN 'Honoraires'
    WHEN '6231' THEN 'Publicite et marketing'
    WHEN '6241' THEN 'Transports de biens'
    WHEN '6251' THEN 'Voyages et deplacements'
    WHEN '6257' THEN 'Frais de reception'
    WHEN '626' THEN 'Telecommunications'
    WHEN '627' THEN 'Frais bancaires'
    WHEN '628' THEN 'Telecommunications (SYSCOHADA)'
    WHEN '630' THEN 'Amortissements (PCMN)'
    WHEN '631' THEN 'Frais bancaires (SYSCOHADA)'
    WHEN '632' THEN 'Honoraires (SYSCOHADA)'
    WHEN '6324' THEN 'Honoraires (SYSCOHADA)'
    WHEN '633' THEN 'Formation (SYSCOHADA)'
    WHEN '6333' THEN 'Formation du personnel'
    WHEN '634' THEN 'Logiciels et licences (SYSCOHADA)'
    WHEN '635' THEN 'Impots et taxes'
    WHEN '636' THEN 'Frais de restauration (SYSCOHADA)'
    WHEN '637' THEN 'Remuneration personnel exterieur (SYSCOHADA)'
    WHEN '6371' THEN 'Gardiennage et securite (SYSCOHADA)'
    WHEN '638' THEN 'Charges diverses (SYSCOHADA)'
    WHEN '641' THEN 'Remunerations du personnel'
    WHEN '646' THEN 'Impots et taxes (SYSCOHADA)'
    WHEN '658' THEN 'Charges diverses de gestion'
    WHEN '661' THEN 'Remunerations (SYSCOHADA)'
    WHEN '681' THEN 'Dotations aux amortissements'
    WHEN '700' THEN 'Ventes de marchandises'
    WHEN '701' THEN 'Ventes de produits finis'
    WHEN '702' THEN 'Ventes de produits intermediaires'
    WHEN '706' THEN 'Prestations de services'
    WHEN '7061' THEN 'Prestations de services (PCMN)'
    ELSE 'Compte ' || p_account_code
  END;

  INSERT INTO accounting_chart_of_accounts (id, user_id, company_id, account_code, account_name, account_type)
  VALUES (gen_random_uuid(), p_user_id, p_company_id, p_account_code, v_name, v_type);
END;
$fn$;

-- ---------------------------------------------------------------------------
-- STEP 3: BUG #10 FIX — Update account 6055 name wherever it says "Compte 6055"
-- ---------------------------------------------------------------------------
UPDATE accounting_chart_of_accounts
SET account_name = 'Fournitures de bureau et petit materiel'
WHERE account_code = '6055'
  AND (account_name = 'Compte 6055' OR account_name IS NULL OR account_name = '');

-- Also fix account 6371 name if auto-created with generic name
UPDATE accounting_chart_of_accounts
SET account_name = 'Gardiennage et securite (SYSCOHADA)'
WHERE account_code = '6371'
  AND account_name = 'Compte 6371';

-- ---------------------------------------------------------------------------
-- STEP 4: BUG #9 FIX — Insert missing accounting_mappings for ALL users
--         who have expenses with unmapped categories
-- ---------------------------------------------------------------------------

-- security → 637 (Gardiennage, OHADA class 63)
INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT DISTINCT e.user_id, 'expense', 'security', '637', '521', 'Gardiennage et securite', true
FROM expenses e
WHERE e.category = 'security'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_mappings m
    WHERE m.user_id = e.user_id AND m.source_type = 'expense' AND m.source_category = 'security'
  );

-- professional_fees → 6324 (Honoraires, OHADA)
INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT DISTINCT e.user_id, 'expense', 'professional_fees', '6324', '521', 'Honoraires et frais professionnels', true
FROM expenses e
WHERE e.category = 'professional_fees'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_mappings m
    WHERE m.user_id = e.user_id AND m.source_type = 'expense' AND m.source_category = 'professional_fees'
  );

-- transport → 6182 (Transports, OHADA) — override existing hardcoded 618 to proper 6182
INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT DISTINCT e.user_id, 'expense', 'transport', '6182', '521', 'Transports', true
FROM expenses e
WHERE e.category = 'transport'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_mappings m
    WHERE m.user_id = e.user_id AND m.source_type = 'expense' AND m.source_category = 'transport'
  );

-- Also add mappings for the specific company user even if no expenses yet
-- (bbf8a1e2-d93d-4c06-9693-b5e2e22a51d5 is the company_id, resolve user_id)
INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT c.user_id, v.source_type, v.source_category, v.debit_code, v.credit_code, v.mapping_name, true
FROM company c
CROSS JOIN (VALUES
  ('expense', 'security',          '637',  '521', 'Gardiennage et securite'),
  ('expense', 'professional_fees', '6324', '521', 'Honoraires et frais professionnels'),
  ('expense', 'transport',         '6182', '521', 'Transports')
) AS v(source_type, source_category, debit_code, credit_code, mapping_name)
WHERE c.id = 'bbf8a1e2-d93d-4c06-9693-b5e2e22a51d5'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_mappings m
    WHERE m.user_id = c.user_id
      AND m.source_type = v.source_type
      AND m.source_category = v.source_category
  );

-- ---------------------------------------------------------------------------
-- STEP 5: Ensure chart of accounts entries exist for new account codes
--         for the specific company
-- ---------------------------------------------------------------------------
INSERT INTO accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type, company_id)
SELECT gen_random_uuid(), c.user_id, v.code, v.name, 'expense', c.id
FROM company c
CROSS JOIN (VALUES
  ('637',  'Gardiennage et securite (SYSCOHADA)'),
  ('6324', 'Honoraires (SYSCOHADA)'),
  ('6182', 'Transports (SYSCOHADA)'),
  ('6055', 'Fournitures de bureau et petit materiel')
) AS v(code, name)
WHERE c.id = 'bbf8a1e2-d93d-4c06-9693-b5e2e22a51d5'
  AND NOT EXISTS (
    SELECT 1 FROM accounting_chart_of_accounts coa
    WHERE coa.user_id = c.user_id
      AND coa.account_code = v.code
      AND (coa.company_id = c.id OR coa.company_id IS NULL)
  );

-- ---------------------------------------------------------------------------
-- STEP 6: Re-map existing accounting_entries from account 999 to correct codes
--         based on the original expense category
-- ---------------------------------------------------------------------------
UPDATE accounting_entries ae
SET account_code = CASE e.category
  WHEN 'security' THEN '637'
  WHEN 'professional_fees' THEN '6324'
  WHEN 'transport' THEN '6182'
  ELSE '658'  -- any other unmapped category goes to Charges diverses
END
FROM expenses e
WHERE ae.source_type = 'expense'
  AND ae.source_id = e.id
  AND ae.account_code = '999'
  AND ae.company_id = 'bbf8a1e2-d93d-4c06-9693-b5e2e22a51d5';

-- Also fix across all companies (any entries stuck on 999)
UPDATE accounting_entries ae
SET account_code = CASE e.category
  WHEN 'security' THEN '637'
  WHEN 'professional_fees' THEN '6324'
  WHEN 'transport' THEN '6182'
  ELSE '658'
END
FROM expenses e
WHERE ae.source_type = 'expense'
  AND ae.source_id = e.id
  AND ae.account_code = '999'
  AND ae.company_id != 'bbf8a1e2-d93d-4c06-9693-b5e2e22a51d5';

-- Clean up: delete the phantom 999 account from chart of accounts
DELETE FROM accounting_chart_of_accounts
WHERE account_code = '999';
