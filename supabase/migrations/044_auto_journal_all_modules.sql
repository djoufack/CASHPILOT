-- ============================================================================
-- Migration 044: Auto-Journal All Modules
-- Passerelle automatique modules → écritures comptables
-- ============================================================================
--
-- Contenu :
--   A. Helper function: get_mapping(p_user_id, p_source_type, p_source_category)
--   B. Helper function: get_user_account_code(p_user_id, p_role) — BUG FIX
--   C. Trigger function: auto_journal_invoice() — invoices
--   D. Trigger function: auto_journal_payment() — payments
--   E. Trigger function: auto_journal_expense() — expenses
--   F. Trigger function: auto_journal_supplier_invoice() — supplier_invoices
--   G. Replacement trigger: auto_journal_credit_note() — credit_notes (fixed)
--
-- Safety rules applied to ALL triggers:
--   1. Check auto_journal_enabled from user_accounting_settings first
--   2. Check idempotency (source_type + source_id + user_id)
--   3. COALESCE all amounts, skip if total = 0
--   4. All entries have is_auto = true
--   5. DROP TRIGGER IF EXISTS before CREATE TRIGGER
--   6. COMMENT ON FUNCTION for each function
--
-- This migration is idempotent and can be re-run safely.
-- ============================================================================


-- ============================================================================
-- A. Helper function: get_mapping()
-- Returns the debit/credit account codes for a given mapping configuration
-- ============================================================================

CREATE OR REPLACE FUNCTION get_mapping(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_category TEXT
)
RETURNS TABLE(debit_code TEXT, credit_code TEXT)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.debit_account_code::TEXT,
    am.credit_account_code::TEXT
  FROM accounting_mappings am
  WHERE am.user_id = p_user_id
    AND am.source_type = p_source_type
    AND am.source_category = p_source_category
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_mapping(UUID, TEXT, TEXT) IS
'Returns (debit_code, credit_code) from accounting_mappings for a given user, source_type and source_category. Used by all auto-journal triggers.';


-- ============================================================================
-- B. Helper function: get_user_account_code() — BUG FIX
-- This function was MISSING but called by the existing credit_note trigger.
-- Returns the account code for a special role (client, supplier, bank, etc.)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_account_code(
  p_user_id UUID,
  p_role TEXT
)
RETURNS TEXT
AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- Look up the account code from accounting_mappings based on the role
  SELECT CASE p_role
    WHEN 'client'     THEN am.debit_account_code   -- invoice mapping: debit = client account
    WHEN 'supplier'   THEN am.credit_account_code   -- supplier_invoice mapping: credit = supplier account
    WHEN 'vat_output' THEN (
      SELECT am2.credit_account_code
      FROM accounting_mappings am2
      WHERE am2.user_id = p_user_id
        AND am2.source_type = 'invoice'
        AND am2.source_category = 'vat'
      LIMIT 1
    )
    WHEN 'vat_input'  THEN (
      SELECT am2.debit_account_code
      FROM accounting_mappings am2
      WHERE am2.user_id = p_user_id
        AND am2.source_type = 'supplier_invoice'
        AND am2.source_category = 'vat'
      LIMIT 1
    )
    WHEN 'revenue'    THEN am.credit_account_code   -- invoice mapping: credit = revenue account
    WHEN 'bank'       THEN am.debit_account_code    -- payment mapping: debit = bank account
    WHEN 'cash'       THEN (
      SELECT am2.debit_account_code
      FROM accounting_mappings am2
      WHERE am2.user_id = p_user_id
        AND am2.source_type = 'payment'
        AND am2.source_category = 'cash'
      LIMIT 1
    )
    ELSE NULL
  END INTO v_code
  FROM accounting_mappings am
  WHERE am.user_id = p_user_id
    AND am.source_type = CASE p_role
      WHEN 'client'     THEN 'invoice'
      WHEN 'supplier'   THEN 'supplier_invoice'
      WHEN 'revenue'    THEN 'invoice'
      WHEN 'bank'       THEN 'payment'
      WHEN 'cash'       THEN 'payment'
      WHEN 'vat_output' THEN 'invoice'
      WHEN 'vat_input'  THEN 'supplier_invoice'
      ELSE 'invoice'
    END
  LIMIT 1;

  -- Fall back to hardcoded country-agnostic defaults
  RETURN COALESCE(v_code, CASE p_role
    WHEN 'client'     THEN '411'
    WHEN 'supplier'   THEN '401'
    WHEN 'vat_output' THEN '4457'
    WHEN 'vat_input'  THEN '4456'
    WHEN 'revenue'    THEN '701'
    WHEN 'bank'       THEN '512'
    WHEN 'cash'       THEN '530'
    ELSE '471'  -- compte d'attente
  END);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_account_code(UUID, TEXT) IS
'Returns the account code for a special role (client, supplier, vat_output, vat_input, revenue, bank, cash). Reads from accounting_mappings, falls back to hardcoded defaults. Fixes the missing function bug from migration 034.';


-- ============================================================================
-- C. Trigger function: auto_journal_invoice()
-- AFTER INSERT OR UPDATE ON invoices
-- Fires when status becomes ''sent''
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_total_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_client_code TEXT;
  v_vat_code TEXT;
  v_ref TEXT;
BEGIN
  -- 1. Check auto_journal_enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only fire when status becomes 'sent'
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'sent')
    OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'sent' AND NEW.status = 'sent')
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'invoice'
      AND source_id = NEW.id
      AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Compute amounts with COALESCE
  v_total_ht  := COALESCE(NEW.total_ht, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, 0);
  v_tva       := v_total_ttc - v_total_ht;

  -- Skip if everything is zero
  IF v_total_ttc = 0 AND v_total_ht = 0 THEN
    RETURN NEW;
  END IF;

  -- Get mapping: default is 'invoice' / 'revenue'
  SELECT m.debit_code, m.credit_code
  INTO v_client_code, v_credit_code
  FROM get_mapping(NEW.user_id, 'invoice', 'revenue') m;

  -- Fallback defaults
  v_client_code := COALESCE(v_client_code, '411');
  v_credit_code := COALESCE(v_credit_code, '701');
  v_vat_code    := get_user_account_code(NEW.user_id, 'vat_output');

  v_ref := 'FA-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

  -- Debit: client account for TTC
  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, v_total_ttc, 0,
       'invoice', NEW.id, 'VE', v_ref, true,
       'Facture client TTC - ' || COALESCE(NEW.invoice_number, ''));
  END IF;

  -- Credit: revenue account for HT
  IF v_total_ht > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_credit_code, 0, v_total_ht,
       'invoice', NEW.id, 'VE', v_ref, true,
       'Vente HT - ' || COALESCE(NEW.invoice_number, ''));
  END IF;

  -- Credit: VAT output for TVA (if > 0)
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, 0, v_tva,
       'invoice', NEW.id, 'VE', v_ref, true,
       'TVA collectée - ' || COALESCE(NEW.invoice_number, ''));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_journal_invoice() IS
'Auto-generates accounting entries when an invoice status becomes sent. Debits client for TTC, credits revenue for HT, credits VAT output for TVA.';

DROP TRIGGER IF EXISTS trg_auto_journal_invoice ON invoices;
CREATE TRIGGER trg_auto_journal_invoice
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_invoice();


-- ============================================================================
-- D. Trigger function: auto_journal_payment()
-- AFTER INSERT ON payments
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_amount NUMERIC;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_category TEXT;
  v_ref TEXT;
BEGIN
  -- 1. Check auto_journal_enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- 2. Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payment'
      AND source_id = NEW.id
      AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Compute amount
  v_amount := COALESCE(NEW.amount, 0);

  IF v_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Map payment_method to source_category
  v_category := CASE LOWER(COALESCE(NEW.payment_method, 'bank_transfer'))
    WHEN 'cash'          THEN 'cash'
    WHEN 'bank_transfer' THEN 'bank_transfer'
    WHEN 'card'          THEN 'card'
    WHEN 'check'         THEN 'check'
    ELSE 'bank_transfer'
  END;

  -- Get mapping
  SELECT m.debit_code, m.credit_code
  INTO v_debit_code, v_credit_code
  FROM get_mapping(NEW.user_id, 'payment', v_category) m;

  -- Fallback defaults
  v_debit_code  := COALESCE(v_debit_code, CASE v_category WHEN 'cash' THEN '530' ELSE '512' END);
  v_credit_code := COALESCE(v_credit_code, '411');

  v_ref := 'PA-' || COALESCE(NEW.receipt_number, NEW.id::TEXT);

  -- Debit: bank/cash account
  INSERT INTO accounting_entries
    (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES
    (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_debit_code, v_amount, 0,
     'payment', NEW.id, 'BQ', v_ref, true,
     'Encaissement - ' || COALESCE(NEW.receipt_number, ''));

  -- Credit: client account
  INSERT INTO accounting_entries
    (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES
    (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_credit_code, 0, v_amount,
     'payment', NEW.id, 'BQ', v_ref, true,
     'Règlement client - ' || COALESCE(NEW.receipt_number, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_journal_payment() IS
'Auto-generates accounting entries when a payment is created. Debits bank/cash account, credits client account. Maps payment_method to the correct accounting category.';

DROP TRIGGER IF EXISTS trg_auto_journal_payment ON payments;
CREATE TRIGGER trg_auto_journal_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_payment();


-- ============================================================================
-- E. Trigger function: auto_journal_expense()
-- AFTER INSERT ON expenses
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_amount NUMERIC;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_category TEXT;
  v_ref TEXT;
BEGIN
  -- 1. Check auto_journal_enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- 2. Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'expense'
      AND source_id = NEW.id
      AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Compute amount
  v_amount := COALESCE(NEW.amount, 0);

  IF v_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Map expense category to source_category (lowered)
  v_category := LOWER(COALESCE(NEW.category, 'general'));

  -- Get mapping for specific category
  SELECT m.debit_code, m.credit_code
  INTO v_debit_code, v_credit_code
  FROM get_mapping(NEW.user_id, 'expense', v_category) m;

  -- If no specific mapping found, fall back to 'general'
  IF v_debit_code IS NULL THEN
    SELECT m.debit_code, m.credit_code
    INTO v_debit_code, v_credit_code
    FROM get_mapping(NEW.user_id, 'expense', 'general') m;
  END IF;

  -- Fallback defaults
  v_debit_code  := COALESCE(v_debit_code, '638');
  v_credit_code := COALESCE(v_credit_code, '512');

  v_ref := 'DE-' || LEFT(NEW.id::TEXT, 8);

  -- Debit: charge account
  INSERT INTO accounting_entries
    (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES
    (NEW.user_id, COALESCE(NEW.expense_date, CURRENT_DATE), v_debit_code, v_amount, 0,
     'expense', NEW.id, 'AC', v_ref, true,
     'Dépense - ' || COALESCE(NEW.description, v_category));

  -- Credit: bank account
  INSERT INTO accounting_entries
    (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES
    (NEW.user_id, COALESCE(NEW.expense_date, CURRENT_DATE), v_credit_code, 0, v_amount,
     'expense', NEW.id, 'AC', v_ref, true,
     'Règlement dépense - ' || COALESCE(NEW.description, v_category));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_journal_expense() IS
'Auto-generates accounting entries when an expense is created. Debits charge account based on category mapping, credits bank account.';

DROP TRIGGER IF EXISTS trg_auto_journal_expense ON expenses;
CREATE TRIGGER trg_auto_journal_expense
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_expense();


-- ============================================================================
-- F. Trigger function: auto_journal_supplier_invoice()
-- AFTER INSERT OR UPDATE ON supplier_invoices
-- Fires when payment_status becomes ''validated''
-- Note: supplier_invoices has NO user_id column — we resolve via supplier_id → suppliers.user_id
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_user_id UUID;
  v_total_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_vat_code TEXT;
  v_ref TEXT;
BEGIN
  -- Resolve user_id from suppliers table (supplier_invoices has no user_id)
  SELECT s.user_id INTO v_user_id
  FROM suppliers s
  WHERE s.id = NEW.supplier_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Check auto_journal_enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = v_user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only fire when payment_status becomes 'validated'
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.payment_status = 'validated')
    OR (TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM 'validated' AND NEW.payment_status = 'validated')
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'supplier_invoice'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Compute amounts
  -- supplier_invoices has: total_amount (TTC), total_ht, total_ttc, vat_amount
  v_total_ht  := COALESCE(NEW.total_ht, 0);
  v_tva       := COALESCE(NEW.vat_amount, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, COALESCE(NEW.total_amount, v_total_ht + v_tva));

  -- If HT is zero but TTC is available, derive HT
  IF v_total_ht = 0 AND v_total_ttc > 0 THEN
    v_total_ht := v_total_ttc - v_tva;
  END IF;

  -- Skip if everything is zero
  IF v_total_ttc = 0 AND v_total_ht = 0 THEN
    RETURN NEW;
  END IF;

  -- Get mapping: default is 'supplier_invoice' / 'purchase'
  SELECT m.debit_code, m.credit_code
  INTO v_debit_code, v_credit_code
  FROM get_mapping(v_user_id, 'supplier_invoice', 'purchase') m;

  -- Fallback defaults
  v_debit_code  := COALESCE(v_debit_code, '601');
  v_credit_code := COALESCE(v_credit_code, '401');
  v_vat_code    := get_user_account_code(v_user_id, 'vat_input');

  v_ref := 'FF-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

  -- Debit: purchase/stock account for HT
  IF v_total_ht > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_debit_code, v_total_ht, 0,
       'supplier_invoice', NEW.id, 'AC', v_ref, true,
       'Achat HT - ' || COALESCE(NEW.invoice_number, ''));
  END IF;

  -- Debit: VAT input for TVA (if > 0)
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0,
       'supplier_invoice', NEW.id, 'AC', v_ref, true,
       'TVA déductible - ' || COALESCE(NEW.invoice_number, ''));
  END IF;

  -- Credit: supplier account for TTC
  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_credit_code, 0, v_total_ttc,
       'supplier_invoice', NEW.id, 'AC', v_ref, true,
       'Facture fournisseur TTC - ' || COALESCE(NEW.invoice_number, ''));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_journal_supplier_invoice() IS
'Auto-generates accounting entries when a supplier invoice payment_status becomes validated. Debits purchase account for HT, debits VAT input, credits supplier account for TTC. Resolves user_id via supplier_id → suppliers.user_id.';

DROP TRIGGER IF EXISTS trg_auto_journal_supplier_invoice ON supplier_invoices;
CREATE TRIGGER trg_auto_journal_supplier_invoice
  AFTER INSERT OR UPDATE ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_supplier_invoice();


-- ============================================================================
-- G. Replace the broken credit_note trigger
-- The original trigger in 034 calls get_user_account_code() which did not exist.
-- Now that we have created it above (section B), we replace the trigger function
-- with the same logic but cleaned up for consistency with the other triggers.
-- ============================================================================

-- Drop the old trigger first
DROP TRIGGER IF EXISTS trg_auto_journal_credit_note ON credit_notes;

CREATE OR REPLACE FUNCTION auto_journal_credit_note()
RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
  v_total_ht NUMERIC;
BEGIN
  -- 1. Check auto_journal_enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only journal when status becomes 'issued'
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'issued')
    OR (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM 'issued' AND NEW.status = 'issued')
  ) THEN
    RETURN NEW;
  END IF;

  -- 2. Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'credit_note'
      AND source_id = NEW.id
      AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Compute amounts with COALESCE
  v_total_ht  := COALESCE(NEW.total_ht, 0);
  v_tva       := COALESCE(NEW.tax_amount, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, v_total_ht + v_tva);

  -- Skip if everything is zero
  IF v_total_ttc = 0 AND v_total_ht = 0 AND v_tva = 0 THEN
    RETURN NEW;
  END IF;

  -- Get account codes using the now-existing helper function
  v_revenue_code := get_user_account_code(NEW.user_id, 'revenue');
  v_vat_code     := get_user_account_code(NEW.user_id, 'vat_output');
  v_client_code  := get_user_account_code(NEW.user_id, 'client');

  v_ref := 'CN-' || COALESCE(NEW.credit_note_number, NEW.id::TEXT);

  -- Debit: Revenue (extourne HT) — only if > 0
  IF v_total_ht > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_revenue_code, v_total_ht, 0,
       'credit_note', NEW.id, 'VE', v_ref, true,
       'Extourne vente - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  -- Debit: VAT output (extourne TVA) — only if > 0
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, v_tva, 0,
       'credit_note', NEW.id, 'VE', v_ref, true,
       'Extourne TVA - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  -- Credit: Client (extourne TTC) — only if > 0
  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries
      (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES
      (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, 0, v_total_ttc,
       'credit_note', NEW.id, 'VE', v_ref, true,
       'Avoir client - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION auto_journal_credit_note() IS
'Auto-generates accounting entries when a credit note status becomes issued. Reverses the original invoice entries: debits revenue + VAT, credits client. Now correctly uses get_user_account_code() which exists in this migration.';

-- Recreate trigger (idempotent)
CREATE TRIGGER trg_auto_journal_credit_note
  AFTER INSERT OR UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_credit_note();


-- ============================================================================
-- MIGRATION 044 COMPLETE
-- ============================================================================
