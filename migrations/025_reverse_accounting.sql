-- Migration 025: Reverse Accounting Triggers
-- Automatically create reversal entries when transactions are deleted or cancelled
-- This ensures the accounting remains accurate and complete

-- ============================================================================
-- FUNCTION: Reverse Payment Journal Entries
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_journal_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_auto_enabled BOOLEAN;
BEGIN
  -- Check if auto journal is enabled
  SELECT auto_journal_enabled INTO v_auto_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF v_auto_enabled IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  -- Create reversal entries for the payment (reverse debit/credit)
  -- Original: Debit Bank, Credit Client
  -- Reversal: Debit Client, Credit Bank

  INSERT INTO accounting_entries (
    user_id,
    transaction_date,
    account_code,
    debit,
    credit,
    source_type,
    source_id,
    journal,
    entry_ref,
    description,
    is_auto
  )
  SELECT
    OLD.user_id,
    CURRENT_DATE,
    account_code,
    credit AS debit,  -- Reverse: credit becomes debit
    debit AS credit,  -- Reverse: debit becomes credit
    'payment_reversal',
    OLD.id,
    'OD',  -- Opérations Diverses for reversals
    'ANN-' || OLD.id,
    'Annulation paiement #' || OLD.id,
    true
  FROM accounting_entries
  WHERE source_type = 'payment'
    AND source_id = OLD.id
    AND user_id = OLD.user_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Reverse Expense Journal Entries
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_journal_expense()
RETURNS TRIGGER AS $$
DECLARE
  v_auto_enabled BOOLEAN;
BEGIN
  -- Check if auto journal is enabled
  SELECT auto_journal_enabled INTO v_auto_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF v_auto_enabled IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  -- Create reversal entries for the expense
  -- Original: Debit Expense account, Debit VAT, Credit Bank
  -- Reversal: Debit Bank, Credit VAT, Credit Expense

  INSERT INTO accounting_entries (
    user_id,
    transaction_date,
    account_code,
    debit,
    credit,
    source_type,
    source_id,
    journal,
    entry_ref,
    description,
    is_auto
  )
  SELECT
    OLD.user_id,
    CURRENT_DATE,
    account_code,
    credit AS debit,  -- Reverse
    debit AS credit,  -- Reverse
    'expense_reversal',
    OLD.id,
    'OD',
    'ANN-EXP-' || OLD.id,
    'Annulation dépense #' || OLD.id,
    true
  FROM accounting_entries
  WHERE source_type = 'expense'
    AND source_id = OLD.id
    AND user_id = OLD.user_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Reverse Invoice Journal Entries (when status changes back to draft)
-- ============================================================================

CREATE OR REPLACE FUNCTION reverse_journal_invoice_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
  v_auto_enabled BOOLEAN;
BEGIN
  -- Only reverse if invoice status changes from issued/sent to draft/cancelled
  IF (OLD.status IN ('sent', 'issued', 'paid') AND NEW.status IN ('draft', 'cancelled')) THEN

    -- Check if auto journal is enabled
    SELECT auto_journal_enabled INTO v_auto_enabled
    FROM user_accounting_settings
    WHERE user_id = NEW.user_id;

    IF v_auto_enabled IS NOT TRUE THEN
      RETURN NEW;
    END IF;

    -- Create reversal entries for the invoice
    INSERT INTO accounting_entries (
      user_id,
      transaction_date,
      account_code,
      debit,
      credit,
      source_type,
      source_id,
      journal,
      entry_ref,
      description,
      is_auto
    )
    SELECT
      NEW.user_id,
      CURRENT_DATE,
      account_code,
      credit AS debit,  -- Reverse
      debit AS credit,  -- Reverse
      'invoice_reversal',
      NEW.id,
      'OD',
      'ANN-' || NEW.invoice_number,
      'Annulation facture ' || NEW.invoice_number,
      true
    FROM accounting_entries
    WHERE source_type = 'invoice'
      AND source_id = NEW.id
      AND user_id = NEW.user_id
      AND journal = 'VE';  -- Only reverse sales entries, not payment entries

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger for payment deletion
DROP TRIGGER IF EXISTS trg_reverse_payment_on_delete ON payments;
CREATE TRIGGER trg_reverse_payment_on_delete
  BEFORE DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_payment();

-- Trigger for expense deletion
DROP TRIGGER IF EXISTS trg_reverse_expense_on_delete ON expenses;
CREATE TRIGGER trg_reverse_expense_on_delete
  BEFORE DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_expense();

-- Trigger for invoice cancellation (status change to draft/cancelled)
DROP TRIGGER IF EXISTS trg_reverse_invoice_on_cancel ON invoices;
CREATE TRIGGER trg_reverse_invoice_on_cancel
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_invoice_on_cancel();

-- ============================================================================
-- FUNCTION: Soft Delete with Reversal (Alternative approach)
-- ============================================================================

-- Add a 'deleted_at' column to track soft deletes (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'payments' AND column_name = 'deleted_at') THEN
    ALTER TABLE payments ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'expenses' AND column_name = 'deleted_at') THEN
    ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION reverse_journal_payment() IS
'Automatically creates reversal accounting entries when a payment is deleted';

COMMENT ON FUNCTION reverse_journal_expense() IS
'Automatically creates reversal accounting entries when an expense is deleted';

COMMENT ON FUNCTION reverse_journal_invoice_on_cancel() IS
'Automatically creates reversal accounting entries when an invoice is cancelled or reverted to draft';

COMMENT ON TRIGGER trg_reverse_payment_on_delete ON payments IS
'Creates reversal entries before payment deletion to maintain accounting integrity';

COMMENT ON TRIGGER trg_reverse_expense_on_delete ON expenses IS
'Creates reversal entries before expense deletion to maintain accounting integrity';

COMMENT ON TRIGGER trg_reverse_invoice_on_cancel ON invoices IS
'Creates reversal entries when invoice status changes to draft/cancelled';
