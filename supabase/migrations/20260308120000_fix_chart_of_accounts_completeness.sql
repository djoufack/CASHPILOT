-- =====================================================================
-- FIX: Ensure chart of accounts is COMPLETE for all users
-- Auto-generated entries reference account codes that may not exist
-- in the user's chart of accounts, causing 0€ in reports.
-- This migration auto-creates missing accounts from entries.
-- =====================================================================

-- For EVERY user: find account_codes used in accounting_entries
-- that don't exist in their chart_of_accounts, and create them.
DO $$
DECLARE
  rec RECORD;
  v_type TEXT;
  v_name TEXT;
BEGIN
  FOR rec IN
    SELECT DISTINCT ae.user_id, ae.account_code
    FROM accounting_entries ae
    WHERE ae.account_code IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_chart_of_accounts coa
        WHERE coa.user_id = ae.user_id AND coa.account_code = ae.account_code
      )
    ORDER BY ae.user_id, ae.account_code
  LOOP
    -- Determine account type and name from code prefix (PCMN / SYSCOHADA compatible)
    v_type := CASE
      WHEN rec.account_code ~ '^1' THEN 'equity'
      WHEN rec.account_code ~ '^2' THEN 'asset'
      WHEN rec.account_code ~ '^3' THEN 'asset'      -- stocks
      WHEN rec.account_code ~ '^40' THEN 'asset'     -- clients/receivables
      WHEN rec.account_code ~ '^41' THEN 'asset'     -- TVA récupérable
      WHEN rec.account_code ~ '^42' THEN 'liability' -- personnel
      WHEN rec.account_code ~ '^43' THEN 'liability' -- organismes sociaux
      WHEN rec.account_code ~ '^44' THEN 'liability' -- fournisseurs
      WHEN rec.account_code ~ '^45' THEN 'liability' -- TVA due
      WHEN rec.account_code ~ '^46' THEN 'asset'     -- débiteurs divers
      WHEN rec.account_code ~ '^47' THEN 'liability' -- comptes transitoires
      WHEN rec.account_code ~ '^48' THEN 'liability' -- comptes régularisation
      WHEN rec.account_code ~ '^49' THEN 'asset'     -- provisions
      WHEN rec.account_code ~ '^5' THEN 'asset'      -- trésorerie
      WHEN rec.account_code ~ '^6' THEN 'expense'
      WHEN rec.account_code ~ '^7' THEN 'revenue'
      WHEN rec.account_code ~ '^8' THEN 'expense'    -- exceptional
      WHEN rec.account_code ~ '^9' THEN 'expense'    -- analytique/divers
      ELSE 'asset'
    END;

    v_name := CASE rec.account_code
      -- Revenue accounts (class 7)
      WHEN '700' THEN 'Ventes et prestations de services'
      WHEN '701' THEN 'Ventes de marchandises'
      WHEN '7061' THEN 'Prestations de services'
      WHEN '706' THEN 'Prestations de services'
      WHEN '707' THEN 'Ventes de marchandises'
      WHEN '7071' THEN 'Ventes de produits finis'
      WHEN '7072' THEN 'Ventes de services'
      -- TVA accounts
      WHEN '4110' THEN 'TVA déductible'
      WHEN '411' THEN 'TVA à récupérer'
      WHEN '4510' THEN 'TVA à payer (collectée)'
      WHEN '451' THEN 'TVA à payer'
      WHEN '4457' THEN 'TVA collectée'
      WHEN '44566' THEN 'TVA déductible sur biens et services'
      WHEN '44571' THEN 'TVA collectée'
      -- Client/Supplier
      WHEN '400' THEN 'Créances commerciales - Clients'
      WHEN '401' THEN 'Clients - Effets à recevoir'
      WHEN '410' THEN 'Clients douteux'
      WHEN '440' THEN 'Dettes commerciales - Fournisseurs'
      WHEN '441' THEN 'Fournisseurs - Effets à payer'
      -- Cash/Bank
      WHEN '550' THEN 'Banque'
      WHEN '570' THEN 'Caisse'
      WHEN '580' THEN 'Virements internes'
      WHEN '512' THEN 'Banque'
      WHEN '530' THEN 'Caisse'
      WHEN '531' THEN 'Caisse'
      WHEN '521' THEN 'Banque'
      -- Expense accounts (class 6)
      WHEN '600' THEN 'Achats de marchandises'
      WHEN '601' THEN 'Achats de matières premières'
      WHEN '610' THEN 'Services et biens divers'
      WHEN '6132' THEN 'Loyers'
      WHEN '6155' THEN 'Entretien et réparations'
      WHEN '620' THEN 'Rémunérations'
      WHEN '621' THEN 'Charges sociales'
      WHEN '630' THEN 'Amortissements'
      WHEN '6302' THEN 'Dotations aux amortissements'
      WHEN '631' THEN 'Frais bancaires'
      WHEN '640' THEN 'Impôts et taxes'
      WHEN '646' THEN 'Droits d enregistrement et timbres'
      WHEN '650' THEN 'Charges d intérêts'
      WHEN '661' THEN 'Rémunérations du personnel'
      WHEN '681' THEN 'Dotations aux amortissements'
      WHEN '999' THEN 'Compte transitoire - Charges non classées'
      -- Default
      ELSE 'Compte ' || rec.account_code || ' (auto-créé)'
    END;

    INSERT INTO accounting_chart_of_accounts (user_id, account_code, account_name, account_type, is_active)
    VALUES (rec.user_id, rec.account_code, v_name, v_type, true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created missing account % (%) for user %', rec.account_code, v_name, rec.user_id;
  END LOOP;
END;
$$;
-- Also ensure the init_accounting function creates ALL required accounts
-- for BE (PCMN) users who are missing them
DO $$
DECLARE
  rec RECORD;
  v_accounts TEXT[][] := ARRAY[
    ARRAY['701', 'Ventes de marchandises', 'revenue'],
    ARRAY['4110', 'TVA déductible', 'asset'],
    ARRAY['4510', 'TVA à payer (collectée)', 'liability'],
    ARRAY['570', 'Caisse', 'asset'],
    ARRAY['580', 'Virements internes', 'asset']
  ];
  v_acc TEXT[];
BEGIN
  FOR rec IN
    SELECT DISTINCT user_id FROM user_accounting_settings
    WHERE country IN ('BE', 'OHADA', 'FR')
  LOOP
    FOREACH v_acc SLICE 1 IN ARRAY v_accounts LOOP
      INSERT INTO accounting_chart_of_accounts (user_id, account_code, account_name, account_type, is_active)
      VALUES (rec.user_id, v_acc[1], v_acc[2], v_acc[3], true)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
