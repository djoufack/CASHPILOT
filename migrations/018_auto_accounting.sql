-- ============================================================================
-- Migration 018: Auto-Accounting — Triggers PostgreSQL pour écritures comptables automatiques
-- ============================================================================

-- A. Table user_accounting_settings
CREATE TABLE IF NOT EXISTS user_accounting_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  country TEXT NOT NULL DEFAULT 'BE',
  is_initialized BOOLEAN DEFAULT false,
  auto_journal_enabled BOOLEAN DEFAULT true,
  fiscal_year_start TEXT DEFAULT '01-01',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_accounting_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own accounting settings"
  ON user_accounting_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_accounting_settings_user ON user_accounting_settings(user_id);

-- B. Enrich accounting_entries with entry_ref and is_auto
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_entries' AND column_name = 'entry_ref') THEN
    ALTER TABLE accounting_entries ADD COLUMN entry_ref TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'accounting_entries' AND column_name = 'is_auto') THEN
    ALTER TABLE accounting_entries ADD COLUMN is_auto BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_source ON accounting_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_ref ON accounting_entries(entry_ref);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_auto ON accounting_entries(is_auto);

-- ============================================================================
-- C. Helper: resolve account code based on user country + custom mappings
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
    WHEN 'client' THEN CASE WHEN v_country = 'FR' THEN '411' ELSE '400' END
    -- Revenue accounts
    WHEN 'revenue' THEN CASE WHEN v_country = 'FR' THEN '701' ELSE '700' END
    WHEN 'revenue.service' THEN CASE WHEN v_country = 'FR' THEN '706' ELSE '7061' END
    WHEN 'revenue.product' THEN CASE WHEN v_country = 'FR' THEN '701' ELSE '701' END
    -- Bank accounts
    WHEN 'bank' THEN CASE WHEN v_country = 'FR' THEN '512' ELSE '550' END
    -- VAT accounts
    WHEN 'vat_output' THEN CASE WHEN v_country = 'FR' THEN '44571' ELSE '4510' END
    WHEN 'vat_input' THEN CASE WHEN v_country = 'FR' THEN '44566' ELSE '4110' END
    -- Supplier accounts
    WHEN 'supplier' THEN CASE WHEN v_country = 'FR' THEN '401' ELSE '440' END
    -- Expense accounts by category
    WHEN 'expense.general' THEN CASE WHEN v_country = 'FR' THEN '618' ELSE '6180' END
    WHEN 'expense.office' THEN CASE WHEN v_country = 'FR' THEN '6064' ELSE '6064' END
    WHEN 'expense.travel' THEN CASE WHEN v_country = 'FR' THEN '6251' ELSE '6251' END
    WHEN 'expense.meals' THEN CASE WHEN v_country = 'FR' THEN '6257' ELSE '6257' END
    WHEN 'expense.transport' THEN CASE WHEN v_country = 'FR' THEN '6241' ELSE '6241' END
    WHEN 'expense.software' THEN CASE WHEN v_country = 'FR' THEN '6116' ELSE '6116' END
    WHEN 'expense.hardware' THEN CASE WHEN v_country = 'FR' THEN '6063' ELSE '6063' END
    WHEN 'expense.marketing' THEN CASE WHEN v_country = 'FR' THEN '6231' ELSE '6231' END
    WHEN 'expense.legal' THEN CASE WHEN v_country = 'FR' THEN '6226' ELSE '6226' END
    WHEN 'expense.insurance' THEN CASE WHEN v_country = 'FR' THEN '616' ELSE '616' END
    WHEN 'expense.rent' THEN CASE WHEN v_country = 'FR' THEN '6132' ELSE '6132' END
    WHEN 'expense.utilities' THEN CASE WHEN v_country = 'FR' THEN '6061' ELSE '6061' END
    WHEN 'expense.telecom' THEN CASE WHEN v_country = 'FR' THEN '626' ELSE '626' END
    WHEN 'expense.training' THEN CASE WHEN v_country = 'FR' THEN '6333' ELSE '6333' END
    WHEN 'expense.consulting' THEN CASE WHEN v_country = 'FR' THEN '6226' ELSE '6226' END
    WHEN 'expense.other' THEN CASE WHEN v_country = 'FR' THEN '658' ELSE '658' END
    ELSE '999'
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- D. Auto-journal for INVOICES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_invoice() RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
BEGIN
  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- === SALE ENTRY: When invoice is sent (not draft) ===
  IF (TG_OP = 'INSERT' AND NEW.status IS NOT NULL AND NEW.status != 'draft')
     OR (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status != 'draft') THEN

    -- Check idempotency
    IF EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'invoice' AND source_id = NEW.id AND journal = 'VE'
      AND user_id = NEW.user_id
    ) THEN
      -- Already journalized, skip
      NULL;
    ELSE
      v_client_code := get_user_account_code(NEW.user_id, 'client');
      v_revenue_code := get_user_account_code(NEW.user_id, 'revenue');
      v_vat_code := get_user_account_code(NEW.user_id, 'vat_output');
      v_ref := 'INV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
      v_tva := COALESCE(NEW.total_ttc, 0) - COALESCE(NEW.total_ht, 0);

      -- Debit: Client (TTC)
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, COALESCE(NEW.total_ttc, 0), 0, 'invoice', NEW.id, 'VE', v_ref, true, 'Facture ' || COALESCE(NEW.invoice_number, ''));

      -- Credit: Revenue (HT)
      IF COALESCE(NEW.total_ht, 0) > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_revenue_code, 0, COALESCE(NEW.total_ht, 0), 'invoice', NEW.id, 'VE', v_ref, true, 'Vente HT - ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      -- Credit: VAT output (TVA collectée)
      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, 0, v_tva, 'invoice', NEW.id, 'VE', v_ref, true, 'TVA collectée - ' || COALESCE(NEW.invoice_number, ''));
      END IF;
    END IF;
  END IF;

  -- === PAYMENT ENTRY: When invoice becomes fully paid ===
  IF TG_OP = 'UPDATE'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN

    -- Check idempotency
    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'invoice_payment' AND source_id = NEW.id AND journal = 'BQ'
      AND user_id = NEW.user_id
    ) THEN
      v_bank_code := get_user_account_code(NEW.user_id, 'bank');
      v_client_code := get_user_account_code(NEW.user_id, 'client');
      v_ref := 'PAY-INV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

      -- Debit: Bank (TTC)
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, CURRENT_DATE, v_bank_code, COALESCE(NEW.total_ttc, 0), 0, 'invoice_payment', NEW.id, 'BQ', v_ref, true, 'Encaissement facture ' || COALESCE(NEW.invoice_number, ''));

      -- Credit: Client (TTC)
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, CURRENT_DATE, v_client_code, 0, COALESCE(NEW.total_ttc, 0), 'invoice_payment', NEW.id, 'BQ', v_ref, true, 'Encaissement client - ' || COALESCE(NEW.invoice_number, ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_journal_invoice ON invoices;
CREATE TRIGGER trg_auto_journal_invoice
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_invoice();

-- ============================================================================
-- E. Auto-journal for PAYMENTS
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_payment() RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_bank_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
BEGIN
  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payment' AND source_id = NEW.id
    AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_bank_code := get_user_account_code(NEW.user_id, 'bank');
  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(NEW.receipt_number, NEW.id::TEXT);

  -- Debit: Bank
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_bank_code, COALESCE(NEW.amount, 0), 0, 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement reçu - ' || COALESCE(NEW.payment_method, '') || ' ' || COALESCE(NEW.reference, ''));

  -- Credit: Client
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(NEW.amount, 0), 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement client - ' || COALESCE(NEW.reference, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_journal_payment ON payments;
CREATE TRIGGER trg_auto_journal_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_payment();

-- ============================================================================
-- F. Auto-journal for EXPENSES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_expense() RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
  v_txn_date DATE;
BEGIN
  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'expense' AND source_id = NEW.id
    AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve account codes
  v_expense_code := get_user_account_code(NEW.user_id, 'expense.' || COALESCE(NEW.category, 'general'));
  v_vat_code := get_user_account_code(NEW.user_id, 'vat_input');
  v_bank_code := get_user_account_code(NEW.user_id, 'bank');
  v_ref := 'EXP-' || NEW.id::TEXT;

  -- Calculate amounts
  v_amount_ht := COALESCE(NEW.amount_ht, NEW.amount, 0);
  v_tva := COALESCE(NEW.tax_amount, 0);
  v_amount_ttc := v_amount_ht + v_tva;

  -- Determine transaction date: prefer expense_date, then created_at, then CURRENT_DATE
  v_txn_date := COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE);

  -- Debit: Expense account (HT)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, v_txn_date, v_expense_code, v_amount_ht, 0, 'expense', NEW.id, 'AC', v_ref, true,
    'Dépense - ' || COALESCE(NEW.category, 'divers') || ': ' || COALESCE(NEW.description, ''));

  -- Debit: VAT input (TVA déductible) — only if > 0
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, v_txn_date, v_vat_code, v_tva, 0, 'expense', NEW.id, 'AC', v_ref, true,
      'TVA déductible - ' || COALESCE(NEW.description, ''));
  END IF;

  -- Credit: Bank (TTC)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, v_txn_date, v_bank_code, 0, v_amount_ttc, 'expense', NEW.id, 'AC', v_ref, true,
    'Règlement dépense - ' || COALESCE(NEW.description, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_journal_expense ON expenses;
CREATE TRIGGER trg_auto_journal_expense
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_expense();

-- ============================================================================
-- G. Auto-journal for CREDIT NOTES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_credit_note() RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
BEGIN
  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only journal when status becomes 'issued'
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'issued')
    OR (TG_OP = 'UPDATE' AND OLD.status != 'issued' AND NEW.status = 'issued')
  ) THEN
    RETURN NEW;
  END IF;

  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'credit_note' AND source_id = NEW.id
    AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_revenue_code := get_user_account_code(NEW.user_id, 'revenue');
  v_vat_code := get_user_account_code(NEW.user_id, 'vat_output');
  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'CN-' || COALESCE(NEW.credit_note_number, NEW.id::TEXT);
  v_tva := COALESCE(NEW.tax_amount, 0);

  -- Debit: Revenue (extourne HT)
  IF COALESCE(NEW.total_ht, 0) > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_revenue_code, COALESCE(NEW.total_ht, 0), 0, 'credit_note', NEW.id, 'VE', v_ref, true,
      'Extourne vente - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  -- Debit: VAT output (extourne TVA)
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, v_tva, 0, 'credit_note', NEW.id, 'VE', v_ref, true,
      'Extourne TVA - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  -- Credit: Client (extourne TTC)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, 0, COALESCE(NEW.total_ttc, 0), 'credit_note', NEW.id, 'VE', v_ref, true,
    'Avoir client - NC ' || COALESCE(NEW.credit_note_number, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_journal_credit_note ON credit_notes;
CREATE TRIGGER trg_auto_journal_credit_note
  AFTER INSERT OR UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_credit_note();

-- ============================================================================
-- DONE
-- ============================================================================
