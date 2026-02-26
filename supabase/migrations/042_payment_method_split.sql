-- 042: Add payment_method column to expenses for bank/cash/check split
-- Allows the auto-journal engine to route to the correct treasury account

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'bank_transfer';

-- Helper function: resolve payment method to treasury account
CREATE OR REPLACE FUNCTION get_payment_account_code(p_user_id UUID, p_payment_method TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN CASE p_payment_method
    WHEN 'cash' THEN get_user_account_code(p_user_id, 'cash')
    WHEN 'check' THEN get_user_account_code(p_user_id, 'check')
    ELSE get_user_account_code(p_user_id, 'bank')
  END;
END;
$$;

-- Update auto_journal_expense to use payment_method for account resolution
CREATE OR REPLACE FUNCTION auto_journal_expense()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total NUMERIC;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_ref := 'EXP-' || NEW.id::TEXT;
  v_amount_ht := COALESCE(NEW.amount_ht, NEW.amount, 0);
  v_tva := COALESCE(NEW.tax_amount, 0);
  v_total := COALESCE(NEW.amount, v_amount_ht + v_tva);

  IF NOT EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'expense' AND source_id = NEW.id AND journal = 'AC'
    AND user_id = NEW.user_id
  ) THEN
    v_expense_code := get_user_account_code(NEW.user_id, COALESCE(NEW.category, 'expense.general'));
    v_vat_code := get_user_account_code(NEW.user_id, 'vat_input');
    -- Use payment_method to resolve bank/cash/check account
    v_bank_code := get_payment_account_code(NEW.user_id, COALESCE(NEW.payment_method, 'bank_transfer'));

    IF v_amount_ht > 0 THEN
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, COALESCE(NEW.expense_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'expense', NEW.id, 'AC', v_ref, true,
        'Charge - ' || COALESCE(NEW.description, ''));
    END IF;

    IF v_tva > 0 THEN
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, COALESCE(NEW.expense_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'expense', NEW.id, 'AC', v_ref, true,
        'TVA deductible - ' || COALESCE(NEW.description, ''));
    END IF;

    IF v_total > 0 THEN
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, COALESCE(NEW.expense_date, CURRENT_DATE), v_bank_code, 0, v_total, 'expense', NEW.id, 'AC', v_ref, true,
        'Paiement charge - ' || COALESCE(NEW.description, ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
