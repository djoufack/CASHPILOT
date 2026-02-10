-- ============================================================================
-- Migration 029: Add expense_date column to expenses table
-- ============================================================================
-- Adds a proper DATE column (expense_date) separate from the existing
-- TIMESTAMPTZ 'date' column. Updates the auto_journal_expense trigger to
-- prefer expense_date for accounting entry transaction_date.
-- ============================================================================

-- 1. Add the expense_date column (DATE type, no timestamp)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE;

-- 2. Backfill existing rows: use created_at::date as fallback
UPDATE expenses SET expense_date = created_at::date WHERE expense_date IS NULL;

-- 3. Update the auto_journal_expense trigger to use expense_date
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

  -- Determine transaction date: prefer expense_date, then date, then CURRENT_DATE
  v_txn_date := COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE);

  -- Debit: Expense account (HT)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, v_txn_date, v_expense_code, v_amount_ht, 0, 'expense', NEW.id, 'AC', v_ref, true,
    'Depense - ' || COALESCE(NEW.category, 'divers') || ': ' || COALESCE(NEW.description, ''));

  -- Debit: VAT input (TVA deductible) — only if > 0
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, v_txn_date, v_vat_code, v_tva, 0, 'expense', NEW.id, 'AC', v_ref, true,
      'TVA deductible - ' || COALESCE(NEW.description, ''));
  END IF;

  -- Credit: Bank (TTC)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, v_txn_date, v_bank_code, 0, v_amount_ttc, 'expense', NEW.id, 'AC', v_ref, true,
    'Reglement depense - ' || COALESCE(NEW.description, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger (idempotent)
DROP TRIGGER IF EXISTS trg_auto_journal_expense ON expenses;
CREATE TRIGGER trg_auto_journal_expense
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_expense();
