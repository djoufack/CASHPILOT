
-- =====================================================================
-- CASHPILOT AUTO-ACCOUNTING ENGINE V2
-- Complete overhaul: triggers, validations, audit, supplier invoices
-- SYSCOHADA compliant - Real-time journalization
-- =====================================================================

-- 1. ADD MISSING EXPENSE CATEGORY MAPPINGS
-- =====================================================================
INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT u.user_id, 'expense', 'salary', '661', '521', 'Rémunérations du personnel', true
FROM user_accounting_settings u
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_mappings m 
  WHERE m.user_id = u.user_id AND m.source_type = 'expense' AND m.source_category = 'salary'
);

INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT u.user_id, 'expense', 'taxes', '646', '521', 'Droits enregistrement et timbres', true
FROM user_accounting_settings u
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_mappings m 
  WHERE m.user_id = u.user_id AND m.source_type = 'expense' AND m.source_category = 'taxes'
);

INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT u.user_id, 'expense', 'maintenance', '6155', '521', 'Entretien et réparations', true
FROM user_accounting_settings u
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_mappings m 
  WHERE m.user_id = u.user_id AND m.source_type = 'expense' AND m.source_category = 'maintenance'
);

INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT u.user_id, 'expense', 'bank_fees', '631', '521', 'Frais bancaires', true
FROM user_accounting_settings u
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_mappings m 
  WHERE m.user_id = u.user_id AND m.source_type = 'expense' AND m.source_category = 'bank_fees'
);

INSERT INTO accounting_mappings (user_id, source_type, source_category, debit_account_code, credit_account_code, mapping_name, is_active)
SELECT u.user_id, 'expense', 'depreciation', '681', '521', 'Dotations aux amortissements', true
FROM user_accounting_settings u
WHERE NOT EXISTS (
  SELECT 1 FROM accounting_mappings m 
  WHERE m.user_id = u.user_id AND m.source_type = 'expense' AND m.source_category = 'depreciation'
);

-- 2. ACCOUNTING AUDIT LOG TABLE
-- =====================================================================
CREATE TABLE IF NOT EXISTS accounting_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'auto_journal', 'reversal', 'balance_check', 'validation_error', 
    'manual_correction', 'retroactive_journal', 'supplier_journal'
  )),
  source_table TEXT NOT NULL,
  source_id UUID,
  entry_count INT DEFAULT 0,
  total_debit NUMERIC DEFAULT 0,
  total_credit NUMERIC DEFAULT 0,
  balance_ok BOOLEAN DEFAULT true,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accounting_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs" ON accounting_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert audit logs" ON accounting_audit_log
  FOR INSERT WITH CHECK (true);

-- 3. ENHANCED get_user_account_code WITH MAPPING LOOKUP
-- =====================================================================
CREATE OR REPLACE FUNCTION get_user_account_code(
  p_user_id UUID, 
  p_mapping_key TEXT,
  p_source_category TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_country TEXT;
  v_custom_code TEXT;
  v_source_type TEXT;
  v_category TEXT;
BEGIN
  -- Get user country
  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = p_user_id;

  IF v_country IS NULL THEN
    v_country := 'OHADA';
  END IF;

  -- Parse source_type and category from mapping_key
  v_source_type := SPLIT_PART(p_mapping_key, '.', 1);
  v_category := COALESCE(p_source_category, SPLIT_PART(p_mapping_key, '.', 2));

  -- Check accounting_mappings table first (user-defined overrides)
  IF v_category IS NOT NULL AND v_category != '' THEN
    SELECT debit_account_code INTO v_custom_code
    FROM accounting_mappings
    WHERE user_id = p_user_id
      AND source_type = v_source_type
      AND source_category = v_category
      AND is_active = true
    LIMIT 1;
    
    IF v_custom_code IS NOT NULL THEN
      RETURN v_custom_code;
    END IF;
  END IF;

  -- Default account codes by country (SYSCOHADA / French PCG / Belgian MAR)
  RETURN CASE p_mapping_key
    WHEN 'client' THEN CASE
      WHEN v_country IN ('FR', 'OHADA') THEN '411'
      ELSE '400' END
    WHEN 'revenue' THEN CASE
      WHEN v_country IN ('FR', 'OHADA') THEN '701'
      ELSE '700' END
    WHEN 'revenue.service' THEN CASE
      WHEN v_country IN ('FR', 'OHADA') THEN '706'
      ELSE '7061' END
    WHEN 'revenue.product' THEN CASE
      WHEN v_country = 'FR' THEN '701'
      WHEN v_country = 'OHADA' THEN '702'
      ELSE '701' END
    WHEN 'bank' THEN CASE
      WHEN v_country = 'FR' THEN '512'
      WHEN v_country = 'OHADA' THEN '521'
      ELSE '550' END
    WHEN 'cash' THEN CASE
      WHEN v_country = 'FR' THEN '530'
      WHEN v_country = 'OHADA' THEN '571'
      ELSE '570' END
    WHEN 'check' THEN CASE
      WHEN v_country = 'FR' THEN '5112'
      WHEN v_country = 'OHADA' THEN '513'
      ELSE '550' END
    WHEN 'vat_output' THEN CASE
      WHEN v_country = 'FR' THEN '44571'
      WHEN v_country = 'OHADA' THEN '4431'
      ELSE '4510' END
    WHEN 'vat_input' THEN CASE
      WHEN v_country = 'FR' THEN '44566'
      WHEN v_country = 'OHADA' THEN '4452'
      ELSE '4110' END
    WHEN 'supplier' THEN CASE
      WHEN v_country IN ('FR', 'OHADA') THEN '401'
      ELSE '440' END
    -- Expense defaults
    WHEN 'expense.general' THEN CASE WHEN v_country = 'OHADA' THEN '638' WHEN v_country = 'FR' THEN '618' ELSE '6180' END
    WHEN 'expense.salary' THEN CASE WHEN v_country = 'OHADA' THEN '661' WHEN v_country = 'FR' THEN '641' ELSE '620' END
    WHEN 'expense.office' THEN CASE WHEN v_country = 'OHADA' THEN '6053' WHEN v_country = 'FR' THEN '6064' ELSE '6064' END
    WHEN 'expense.travel' THEN CASE WHEN v_country = 'OHADA' THEN '6371' WHEN v_country = 'FR' THEN '6251' ELSE '6251' END
    WHEN 'expense.meals' THEN CASE WHEN v_country = 'OHADA' THEN '636' WHEN v_country = 'FR' THEN '6257' ELSE '6257' END
    WHEN 'expense.transport' THEN CASE WHEN v_country = 'OHADA' THEN '618' WHEN v_country = 'FR' THEN '6241' ELSE '6241' END
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
    ELSE '999'
  END;
END;
$$;

-- 4. ENHANCED EXPENSE TRIGGER (with payment method routing + audit)
-- =====================================================================
CREATE OR REPLACE FUNCTION auto_journal_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
BEGIN
  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Idempotency: skip if already journaled
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'expense' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve account codes via mappings
  v_expense_code := get_user_account_code(NEW.user_id, 'expense.' || COALESCE(NEW.category, 'general'));
  v_vat_code := get_user_account_code(NEW.user_id, 'vat_input');
  v_bank_code := get_user_account_code(NEW.user_id, 'bank');
  v_ref := 'EXP-' || LEFT(NEW.id::TEXT, 8);

  -- Calculate amounts
  v_amount_ht := COALESCE(NEW.amount_ht, NEW.amount, 0);
  v_tva := COALESCE(NEW.tax_amount, 0);
  v_amount_ttc := CASE 
    WHEN v_tva > 0 THEN v_amount_ht + v_tva 
    ELSE COALESCE(NEW.amount, v_amount_ht) 
  END;

  -- Skip zero-amount expenses
  IF v_amount_ttc = 0 AND v_amount_ht = 0 THEN
    RETURN NEW;
  END IF;

  -- DEBIT: Expense account (HT)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'expense', NEW.id, 'AC', v_ref, true,
    'Dépense ' || COALESCE(NEW.category, 'divers') || ': ' || COALESCE(NEW.description, ''));

  -- DEBIT: Input VAT (if applicable)
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE), v_vat_code, v_tva, 0, 'expense', NEW.id, 'AC', v_ref, true,
      'TVA déductible - ' || COALESCE(NEW.description, ''));
  END IF;

  -- CREDIT: Bank account (TTC)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE), v_bank_code, 0, v_amount_ttc, 'expense', NEW.id, 'AC', v_ref, true,
    'Règlement dépense - ' || COALESCE(NEW.description, ''));

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details)
  VALUES (NEW.user_id, 'auto_journal', 'expenses', NEW.id, 
    CASE WHEN v_tva > 0 THEN 3 ELSE 2 END,
    v_amount_ht + v_tva, v_amount_ttc, 
    (v_amount_ht + v_tva) = v_amount_ttc,
    jsonb_build_object('expense_code', v_expense_code, 'category', NEW.category, 'amount_ht', v_amount_ht, 'tva', v_tva, 'ttc', v_amount_ttc));

  RETURN NEW;
END;
$$;

-- 5. ENHANCED PAYMENT TRIGGER (with payment method routing)
-- =====================================================================
CREATE OR REPLACE FUNCTION auto_journal_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_debit_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payment' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN RETURN NEW; END IF;

  -- Route by payment method (SYSCOHADA)
  v_debit_code := CASE COALESCE(NEW.payment_method, 'bank_transfer')
    WHEN 'cash' THEN get_user_account_code(NEW.user_id, 'cash')
    WHEN 'check' THEN get_user_account_code(NEW.user_id, 'check')
    ELSE get_user_account_code(NEW.user_id, 'bank')
  END;
  
  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(NEW.receipt_number, LEFT(NEW.id::TEXT, 8));

  -- DEBIT: Bank/Cash/Check
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_debit_code, COALESCE(NEW.amount, 0), 0, 'payment', NEW.id, 'BQ', v_ref, true,
    'Encaissement ' || COALESCE(NEW.payment_method, 'virement') || ' - ' || COALESCE(NEW.reference, ''));

  -- CREDIT: Client
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(NEW.amount, 0), 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement client - ' || COALESCE(NEW.reference, ''));

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details)
  VALUES (NEW.user_id, 'auto_journal', 'payments', NEW.id, 2, NEW.amount, NEW.amount, true,
    jsonb_build_object('method', NEW.payment_method, 'debit_account', v_debit_code, 'amount', NEW.amount));

  RETURN NEW;
END;
$$;

-- 6. NEW: SUPPLIER INVOICE AUTO-JOURNAL TRIGGER
-- =====================================================================
CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_user_id UUID;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_supplier_code TEXT;
  v_ref TEXT;
  v_total_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  -- Get user_id from supplier
  SELECT s.user_id INTO v_user_id
  FROM suppliers s WHERE s.id = NEW.supplier_id;

  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = v_user_id;

  IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

  -- Idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'supplier_invoice' AND source_id = NEW.id AND user_id = v_user_id
  ) THEN RETURN NEW; END IF;

  -- Calculate amounts
  v_total_ht := COALESCE(NEW.total_ht, NEW.total_amount, 0);
  v_tva := COALESCE(NEW.vat_amount, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, v_total_ht + v_tva);

  IF v_total_ttc = 0 AND v_total_ht = 0 THEN RETURN NEW; END IF;

  -- Resolve accounts
  v_expense_code := get_user_account_code(v_user_id, 'expense.general'); -- Default, can be overridden
  v_vat_code := get_user_account_code(v_user_id, 'vat_input');
  v_supplier_code := get_user_account_code(v_user_id, 'supplier');
  v_ref := 'SINV-' || COALESCE(NEW.invoice_number, LEFT(NEW.id::TEXT, 8));

  -- Check for specific mapping from supplier_invoice source_type
  DECLARE v_mapped_code TEXT;
  BEGIN
    SELECT debit_account_code INTO v_mapped_code
    FROM accounting_mappings
    WHERE user_id = v_user_id 
      AND source_type = 'supplier_invoice'
      AND is_active = true
    LIMIT 1;
    IF v_mapped_code IS NOT NULL THEN
      v_expense_code := v_mapped_code;
    END IF;
  END;

  -- DEBIT: Purchase/Expense account (HT)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_expense_code, v_total_ht, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
    'Facture fournisseur ' || COALESCE(NEW.invoice_number, '') || ' - ' || COALESCE(NEW.supplier_name_extracted, ''));

  -- DEBIT: Input VAT (if applicable)
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
      'TVA déductible - Fact. fourn. ' || COALESCE(NEW.invoice_number, ''));
  END IF;

  -- CREDIT: Supplier account (TTC)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_total_ttc, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
    'Fournisseur - ' || COALESCE(NEW.supplier_name_extracted, '') || ' ' || COALESCE(NEW.invoice_number, ''));

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details)
  VALUES (v_user_id, 'supplier_journal', 'supplier_invoices', NEW.id,
    CASE WHEN v_tva > 0 THEN 3 ELSE 2 END,
    v_total_ht + v_tva, v_total_ttc,
    (v_total_ht + v_tva) = v_total_ttc,
    jsonb_build_object('expense_code', v_expense_code, 'supplier', NEW.supplier_name_extracted, 'ht', v_total_ht, 'tva', v_tva, 'ttc', v_total_ttc));

  RETURN NEW;
END;
$$;

-- Create supplier invoice trigger
DROP TRIGGER IF EXISTS trg_auto_journal_supplier_invoice ON supplier_invoices;
CREATE TRIGGER trg_auto_journal_supplier_invoice
  AFTER INSERT ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_supplier_invoice();

-- 7. BALANCE VERIFICATION FUNCTION (Expert Comptable Check)
-- =====================================================================
CREATE OR REPLACE FUNCTION verify_accounting_balance(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
  total_debit NUMERIC,
  total_credit NUMERIC,
  difference NUMERIC,
  is_balanced BOOLEAN,
  entry_count BIGINT,
  unbalanced_refs TEXT[]
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH balance AS (
    SELECT 
      SUM(COALESCE(ae.debit, 0)) as sum_debit,
      SUM(COALESCE(ae.credit, 0)) as sum_credit,
      COUNT(*) as cnt
    FROM accounting_entries ae
    WHERE ae.user_id = p_user_id
      AND ae.transaction_date <= p_date
  ),
  unbalanced AS (
    SELECT ARRAY_AGG(DISTINCT entry_ref) as refs
    FROM (
      SELECT entry_ref, 
        SUM(COALESCE(debit, 0)) as d, 
        SUM(COALESCE(credit, 0)) as c
      FROM accounting_entries
      WHERE user_id = p_user_id
        AND transaction_date <= p_date
        AND entry_ref IS NOT NULL
      GROUP BY entry_ref
      HAVING ABS(SUM(COALESCE(debit, 0)) - SUM(COALESCE(credit, 0))) > 0.01
    ) sq
  )
  SELECT 
    b.sum_debit,
    b.sum_credit,
    ABS(b.sum_debit - b.sum_credit),
    ABS(b.sum_debit - b.sum_credit) < 0.01,
    b.cnt,
    COALESCE(u.refs, ARRAY[]::TEXT[])
  FROM balance b, unbalanced u;
END;
$$;

-- 8. RETROACTIVE JOURNALIZATION FUNCTION
-- =====================================================================
CREATE OR REPLACE FUNCTION retroactive_journal_all(p_user_id UUID)
RETURNS TABLE(source TEXT, journaled INT, skipped INT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_expense RECORD;
  v_payment RECORD;
  v_supplier RECORD;
  v_count_exp INT := 0;
  v_skip_exp INT := 0;
  v_count_pay INT := 0;
  v_skip_pay INT := 0;
  v_count_sup INT := 0;
  v_skip_sup INT := 0;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_debit_code TEXT;
  v_client_code TEXT;
  v_supplier_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
BEGIN
  -- EXPENSES
  FOR v_expense IN 
    SELECT e.* FROM expenses e 
    WHERE e.user_id = p_user_id AND e.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM accounting_entries ae WHERE ae.source_type = 'expense' AND ae.source_id = e.id AND ae.user_id = p_user_id)
  LOOP
    v_expense_code := get_user_account_code(p_user_id, 'expense.' || COALESCE(v_expense.category, 'general'));
    v_vat_code := get_user_account_code(p_user_id, 'vat_input');
    v_bank_code := get_user_account_code(p_user_id, 'bank');
    v_ref := 'RETRO-EXP-' || LEFT(v_expense.id::TEXT, 8);
    v_amount_ht := COALESCE(v_expense.amount_ht, v_expense.amount, 0);
    v_tva := COALESCE(v_expense.tax_amount, 0);
    v_amount_ttc := CASE WHEN v_tva > 0 THEN v_amount_ht + v_tva ELSE COALESCE(v_expense.amount, v_amount_ht) END;

    IF v_amount_ttc > 0 OR v_amount_ht > 0 THEN
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (p_user_id, COALESCE(v_expense.expense_date, v_expense.created_at::date), v_expense_code, v_amount_ht, 0, 'expense', v_expense.id, 'AC', v_ref, true,
        'RETRO Dépense ' || COALESCE(v_expense.category, '') || ': ' || COALESCE(v_expense.description, ''));

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (p_user_id, COALESCE(v_expense.expense_date, v_expense.created_at::date), v_vat_code, v_tva, 0, 'expense', v_expense.id, 'AC', v_ref, true,
          'RETRO TVA déductible - ' || COALESCE(v_expense.description, ''));
      END IF;

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (p_user_id, COALESCE(v_expense.expense_date, v_expense.created_at::date), v_bank_code, 0, v_amount_ttc, 'expense', v_expense.id, 'AC', v_ref, true,
        'RETRO Règlement - ' || COALESCE(v_expense.description, ''));

      v_count_exp := v_count_exp + 1;
    ELSE
      v_skip_exp := v_skip_exp + 1;
    END IF;
  END LOOP;

  -- PAYMENTS
  FOR v_payment IN
    SELECT p.* FROM payments p
    WHERE p.user_id = p_user_id AND p.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM accounting_entries ae WHERE ae.source_type = 'payment' AND ae.source_id = p.id AND ae.user_id = p_user_id)
  LOOP
    v_debit_code := CASE COALESCE(v_payment.payment_method, 'bank_transfer')
      WHEN 'cash' THEN get_user_account_code(p_user_id, 'cash')
      WHEN 'check' THEN get_user_account_code(p_user_id, 'check')
      ELSE get_user_account_code(p_user_id, 'bank')
    END;
    v_client_code := get_user_account_code(p_user_id, 'client');
    v_ref := 'RETRO-PAY-' || LEFT(v_payment.id::TEXT, 8);

    IF COALESCE(v_payment.amount, 0) > 0 THEN
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (p_user_id, COALESCE(v_payment.payment_date, CURRENT_DATE), v_debit_code, v_payment.amount, 0, 'payment', v_payment.id, 'BQ', v_ref, true,
        'RETRO Encaissement ' || COALESCE(v_payment.payment_method, '') || ' - ' || COALESCE(v_payment.reference, ''));

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (p_user_id, COALESCE(v_payment.payment_date, CURRENT_DATE), v_client_code, 0, v_payment.amount, 'payment', v_payment.id, 'BQ', v_ref, true,
        'RETRO Paiement client - ' || COALESCE(v_payment.reference, ''));

      v_count_pay := v_count_pay + 1;
    ELSE
      v_skip_pay := v_skip_pay + 1;
    END IF;
  END LOOP;

  -- SUPPLIER INVOICES
  FOR v_supplier IN
    SELECT si.*, s.user_id as owner_id FROM supplier_invoices si
    JOIN suppliers s ON s.id = si.supplier_id
    WHERE s.user_id = p_user_id
    AND NOT EXISTS (SELECT 1 FROM accounting_entries ae WHERE ae.source_type = 'supplier_invoice' AND ae.source_id = si.id AND ae.user_id = p_user_id)
  LOOP
    v_supplier_code := get_user_account_code(p_user_id, 'supplier');
    v_vat_code := get_user_account_code(p_user_id, 'vat_input');
    v_ref := 'RETRO-SINV-' || LEFT(v_supplier.id::TEXT, 8);
    v_amount_ht := COALESCE(v_supplier.total_ht, v_supplier.total_amount, 0);
    v_tva := COALESCE(v_supplier.vat_amount, 0);
    v_amount_ttc := COALESCE(v_supplier.total_ttc, v_amount_ht + v_tva);

    -- Get expense code from mapping
    SELECT COALESCE(debit_account_code, '601') INTO v_expense_code
    FROM accounting_mappings
    WHERE user_id = p_user_id AND source_type = 'supplier_invoice' AND is_active = true
    LIMIT 1;
    v_expense_code := COALESCE(v_expense_code, '601');

    IF v_amount_ttc > 0 OR v_amount_ht > 0 THEN
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (p_user_id, COALESCE(v_supplier.invoice_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'supplier_invoice', v_supplier.id, 'AC', v_ref, true,
        'RETRO Fact. fourn. ' || COALESCE(v_supplier.invoice_number, '') || ' - ' || COALESCE(v_supplier.supplier_name_extracted, ''));

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (p_user_id, COALESCE(v_supplier.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', v_supplier.id, 'AC', v_ref, true,
          'RETRO TVA déductible fourn. ' || COALESCE(v_supplier.invoice_number, ''));
      END IF;

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (p_user_id, COALESCE(v_supplier.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_amount_ttc, 'supplier_invoice', v_supplier.id, 'AC', v_ref, true,
        'RETRO Fournisseur - ' || COALESCE(v_supplier.supplier_name_extracted, ''));

      v_count_sup := v_count_sup + 1;
    ELSE
      v_skip_sup := v_skip_sup + 1;
    END IF;
  END LOOP;

  -- Audit
  INSERT INTO accounting_audit_log (user_id, event_type, source_table, source_id, entry_count, balance_ok, details)
  VALUES (p_user_id, 'retroactive_journal', 'all', NULL, v_count_exp + v_count_pay + v_count_sup, true,
    jsonb_build_object('expenses', v_count_exp, 'payments', v_count_pay, 'supplier_invoices', v_count_sup,
      'skipped_expenses', v_skip_exp, 'skipped_payments', v_skip_pay, 'skipped_suppliers', v_skip_sup));

  -- Return results
  RETURN QUERY SELECT 'expenses'::TEXT, v_count_exp, v_skip_exp;
  RETURN QUERY SELECT 'payments'::TEXT, v_count_pay, v_skip_pay;
  RETURN QUERY SELECT 'supplier_invoices'::TEXT, v_count_sup, v_skip_sup;
END;
$$;
;
