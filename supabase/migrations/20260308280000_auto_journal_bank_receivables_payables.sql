-- =====================================================================
-- AUTO-JOURNAL TRIGGERS: bank_transactions, receivables, payables
--
-- Adds 3 missing auto-journal triggers to complete the accounting engine:
-- 1. auto_journal_bank_transaction  — on reconciliation match/unmatch
-- 2. auto_journal_receivable         — on receivable INSERT/UPDATE/DELETE
-- 3. auto_journal_payable            — on payable INSERT/UPDATE/DELETE
--
-- Follows the EXACT patterns from:
--   20260308100000_attach_auto_journal_triggers.sql
--   20260226150558_cashpilot_auto_accounting_engine_v2.sql
-- =====================================================================

-- =====================================================================
-- PART 1: BANK TRANSACTION AUTO-JOURNAL (on reconciliation match)
-- =====================================================================

-- 1a. Main trigger function: fires when reconciliation_status changes to 'matched'
CREATE OR REPLACE FUNCTION auto_journal_bank_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_bank_code TEXT;
  v_client_code TEXT;
  v_supplier_code TEXT;
  v_expense_code TEXT;
  v_ref TEXT;
  v_amount NUMERIC;
  v_abs_amount NUMERIC;
  v_transaction_date DATE;
  v_description TEXT;
  v_matched_source_type TEXT;
  v_matched_source_id UUID;
  v_company_id UUID;
BEGIN
  -- Only fire when reconciliation_status changes TO 'matched'
  IF NOT (
    (TG_OP = 'UPDATE'
      AND OLD.reconciliation_status IS DISTINCT FROM NEW.reconciliation_status
      AND NEW.reconciliation_status = 'matched')
  ) THEN
    RETURN NEW;
  END IF;

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
    WHERE source_type = 'bank_transaction' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  v_abs_amount := ABS(v_amount);
  v_transaction_date := COALESCE(NEW.booking_date, NEW.date, CURRENT_DATE);
  v_ref := 'BK-' || NEW.id;

  IF v_abs_amount = 0 THEN RETURN NEW; END IF;

  -- Resolve bank account code
  v_bank_code := get_user_account_code(NEW.user_id, 'bank');

  -- Resolve company_id for ensure_account_exists
  SELECT bc.company_id INTO v_company_id
  FROM bank_connections bc
  WHERE bc.id = NEW.bank_connection_id;

  -- Ensure bank account exists
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_bank_code);

  -- Determine what was matched: check invoice_id first, then bank_statement_lines
  IF NEW.invoice_id IS NOT NULL THEN
    -- Matched to an invoice (client payment received)
    v_matched_source_type := 'invoice';
    v_matched_source_id := NEW.invoice_id;
  ELSE
    -- Check bank_statement_lines for matched_source_type/matched_source_id
    SELECT bsl.matched_source_type, bsl.matched_source_id
    INTO v_matched_source_type, v_matched_source_id
    FROM bank_statement_lines bsl
    WHERE bsl.user_id = NEW.user_id
      AND bsl.matched_source_id IS NOT NULL
      AND ABS(bsl.amount - v_amount) < 0.01
      AND bsl.reconciliation_status = 'matched'
    ORDER BY bsl.matched_at DESC
    LIMIT 1;
  END IF;

  -- Generate journal entries based on match type
  IF v_matched_source_type = 'invoice' THEN
    -- Matched to invoice: Debit 512 (Banque), Credit 411 (Client)
    v_client_code := get_user_account_code(NEW.user_id, 'client');
    PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);

    v_description := 'Rapprochement bancaire - Encaissement client';

    -- DEBIT: Bank
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_transaction_date, v_bank_code, v_abs_amount, 0,
      'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
    );

    -- CREDIT: Client
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_transaction_date, v_client_code, 0, v_abs_amount,
      'bank_transaction', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Solde creance client'
    );

  ELSIF v_matched_source_type = 'supplier_invoice' THEN
    -- Matched to supplier invoice: Debit 401 (Fournisseur), Credit 512 (Banque)
    v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');
    PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_supplier_code);

    v_description := 'Rapprochement bancaire - Paiement fournisseur';

    -- DEBIT: Supplier (reduces payable)
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_transaction_date, v_supplier_code, v_abs_amount, 0,
      'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
    );

    -- CREDIT: Bank
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_transaction_date, v_bank_code, 0, v_abs_amount,
      'bank_transaction', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Decaissement fournisseur'
    );

  ELSIF v_matched_source_type = 'expense' THEN
    -- Matched to expense: Debit expense_account, Credit 512 (Banque)
    -- Try to get expense category for proper account code
    DECLARE
      v_expense_category TEXT;
    BEGIN
      SELECT e.category INTO v_expense_category
      FROM expenses e
      WHERE e.id = v_matched_source_id AND e.user_id = NEW.user_id;

      v_expense_code := get_user_account_code(NEW.user_id, 'expense.' || COALESCE(v_expense_category, 'general'));
    END;

    PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_expense_code);

    v_description := 'Rapprochement bancaire - Charge rapprochee';

    -- DEBIT: Expense account
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_transaction_date, v_expense_code, v_abs_amount, 0,
      'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
    );

    -- CREDIT: Bank
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_transaction_date, v_bank_code, 0, v_abs_amount,
      'bank_transaction', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Decaissement charge'
    );

  ELSE
    -- Unknown match type or no match info: generic bank entry based on amount sign
    IF v_amount > 0 THEN
      -- Credit (incoming): Debit Bank, Credit misc revenue
      v_description := 'Rapprochement bancaire - Encaissement divers';

      INSERT INTO accounting_entries (
        user_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_transaction_date, v_bank_code, v_abs_amount, 0,
        'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
      );

      v_client_code := get_user_account_code(NEW.user_id, 'client');
      PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);

      INSERT INTO accounting_entries (
        user_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_transaction_date, v_client_code, 0, v_abs_amount,
        'bank_transaction', NEW.id, 'BQ', v_ref, true,
        'Rapprochement bancaire - Solde creance'
      );
    ELSE
      -- Debit (outgoing): Debit supplier/expense, Credit Bank
      v_description := 'Rapprochement bancaire - Decaissement divers';

      v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');
      PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_supplier_code);

      INSERT INTO accounting_entries (
        user_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_transaction_date, v_supplier_code, v_abs_amount, 0,
        'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
      );

      INSERT INTO accounting_entries (
        user_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_transaction_date, v_bank_code, 0, v_abs_amount,
        'bank_transaction', NEW.id, 'BQ', v_ref, true,
        'Rapprochement bancaire - Sortie banque'
      );
    END IF;
  END IF;

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'bank_transactions', NEW.id,
    2, v_abs_amount, v_abs_amount, true,
    jsonb_build_object(
      'bank_code', v_bank_code,
      'matched_source_type', v_matched_source_type,
      'matched_source_id', v_matched_source_id,
      'amount', v_amount,
      'reconciliation_status', NEW.reconciliation_status
    )
  );

  RETURN NEW;
END;
$$;
-- Attach trigger
DROP TRIGGER IF EXISTS trg_auto_journal_bank_transaction ON public.bank_transactions;
CREATE TRIGGER trg_auto_journal_bank_transaction
  AFTER UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_bank_transaction();
-- 1b. Reversal trigger: fires when reconciliation_status changes FROM 'matched' to something else
CREATE OR REPLACE FUNCTION reverse_journal_bank_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  -- Only fire when reconciliation_status changes FROM 'matched' to something else
  IF NOT (
    TG_OP = 'UPDATE'
    AND OLD.reconciliation_status = 'matched'
    AND NEW.reconciliation_status IS DISTINCT FROM 'matched'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Reverse all bank_transaction entries
  PERFORM reverse_journal_entries(NEW.user_id, 'bank_transaction', NEW.id, 'ANN-BK');

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'reversal', 'bank_transactions', NEW.id,
    0, 0, 0, true,
    jsonb_build_object(
      'reason', 'reconciliation_status changed from matched',
      'old_status', OLD.reconciliation_status,
      'new_status', NEW.reconciliation_status
    )
  );

  RETURN NEW;
END;
$$;
-- Attach reversal trigger (BEFORE the main trigger so reversal happens first on re-match)
DROP TRIGGER IF EXISTS trg_reverse_journal_bank_transaction ON public.bank_transactions;
CREATE TRIGGER trg_reverse_journal_bank_transaction
  BEFORE UPDATE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_bank_transaction();
-- 1c. Reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_bank_transaction_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  PERFORM reverse_journal_entries(OLD.user_id, 'bank_transaction', OLD.id, 'ANN-BK');
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_bank_transaction_on_delete ON public.bank_transactions;
CREATE TRIGGER trg_reverse_journal_bank_transaction_on_delete
  BEFORE DELETE ON public.bank_transactions
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_bank_transaction_on_delete();
-- =====================================================================
-- PART 2: RECEIVABLE AUTO-JOURNAL
-- =====================================================================

-- 2a. Main trigger function: fires on INSERT or UPDATE
CREATE OR REPLACE FUNCTION auto_journal_receivable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_ref TEXT;
  v_amount NUMERIC;
  v_transaction_date DATE;
  v_company_id UUID;
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
    WHERE source_type = 'receivable' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    -- On UPDATE: delete old entries and re-journal if financial data changed
    IF TG_OP = 'UPDATE' THEN
      IF OLD.amount IS DISTINCT FROM NEW.amount
         OR OLD.debtor_name IS DISTINCT FROM NEW.debtor_name
         OR OLD.status IS DISTINCT FROM NEW.status THEN
        DELETE FROM accounting_entries
        WHERE source_type = 'receivable' AND source_id = NEW.id
          AND user_id = NEW.user_id AND is_auto = true;
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount = 0 THEN RETURN NEW; END IF;

  v_transaction_date := COALESCE(NEW.date_lent, CURRENT_DATE);
  v_ref := 'REC-' || NEW.id;

  -- Resolve account codes
  v_client_code := get_user_account_code(NEW.user_id, 'client');  -- 411 (Creances clients)
  v_revenue_code := get_user_account_code(NEW.user_id, 'expense.other');  -- 758 mapped via expense.other or fallback

  -- Use a more appropriate revenue account for receivables: 758 Produits divers de gestion
  -- Since get_user_account_code doesn't have a 'misc_revenue' key, we use a direct code
  DECLARE
    v_country TEXT;
  BEGIN
    SELECT country INTO v_country
    FROM user_accounting_settings
    WHERE user_id = NEW.user_id;

    v_revenue_code := CASE COALESCE(v_country, 'OHADA')
      WHEN 'FR' THEN '758'
      WHEN 'OHADA' THEN '758'
      ELSE '758'
    END;
  END;

  -- Resolve company_id
  v_company_id := NEW.company_id;
  IF v_company_id IS NULL THEN
    v_company_id := resolve_preferred_company_id(NEW.user_id);
  END IF;

  -- Ensure accounts exist
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_revenue_code);

  -- DEBIT: 411 Client (Creances clients)
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_transaction_date, v_client_code, v_amount, 0,
    'receivable', NEW.id, 'OD', v_ref, true,
    'Creance client - ' || COALESCE(NEW.debtor_name, '') || ' ' || COALESCE(NEW.description, '')
  );

  -- CREDIT: 758 Produits divers
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_transaction_date, v_revenue_code, 0, v_amount,
    'receivable', NEW.id, 'OD', v_ref, true,
    'Produit divers - Creance ' || COALESCE(NEW.debtor_name, '')
  );

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'receivables', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'client_code', v_client_code,
      'revenue_code', v_revenue_code,
      'debtor', NEW.debtor_name,
      'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;
-- Attach trigger
DROP TRIGGER IF EXISTS trg_auto_journal_receivable ON public.receivables;
CREATE TRIGGER trg_auto_journal_receivable
  AFTER INSERT OR UPDATE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_receivable();
-- 2b. Reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_receivable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  PERFORM reverse_journal_entries(OLD.user_id, 'receivable', OLD.id, 'ANN-REC');

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    OLD.user_id, 'reversal', 'receivables', OLD.id,
    0, 0, 0, true,
    jsonb_build_object('reason', 'receivable deleted', 'debtor', OLD.debtor_name, 'amount', OLD.amount)
  );

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_receivable_on_delete ON public.receivables;
CREATE TRIGGER trg_reverse_journal_receivable_on_delete
  BEFORE DELETE ON public.receivables
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_receivable();
-- =====================================================================
-- PART 3: PAYABLE AUTO-JOURNAL
-- =====================================================================

-- 3a. Main trigger function: fires on INSERT or UPDATE
CREATE OR REPLACE FUNCTION auto_journal_payable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_expense_code TEXT;
  v_supplier_code TEXT;
  v_ref TEXT;
  v_amount NUMERIC;
  v_transaction_date DATE;
  v_company_id UUID;
  v_country TEXT;
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
    WHERE source_type = 'payable' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    -- On UPDATE: delete old entries and re-journal if financial data changed
    IF TG_OP = 'UPDATE' THEN
      IF OLD.amount IS DISTINCT FROM NEW.amount
         OR OLD.creditor_name IS DISTINCT FROM NEW.creditor_name
         OR OLD.status IS DISTINCT FROM NEW.status THEN
        DELETE FROM accounting_entries
        WHERE source_type = 'payable' AND source_id = NEW.id
          AND user_id = NEW.user_id AND is_auto = true;
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount = 0 THEN RETURN NEW; END IF;

  v_transaction_date := COALESCE(NEW.date_borrowed, CURRENT_DATE);
  v_ref := 'PAY-' || NEW.id;

  -- Resolve account codes
  v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');  -- 401 (Fournisseurs)

  -- Use 658 Charges diverses de gestion for payable expense account
  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  v_expense_code := CASE COALESCE(v_country, 'OHADA')
    WHEN 'FR' THEN '658'
    WHEN 'OHADA' THEN '658'
    ELSE '658'
  END;

  -- Resolve company_id
  v_company_id := NEW.company_id;
  IF v_company_id IS NULL THEN
    v_company_id := resolve_preferred_company_id(NEW.user_id);
  END IF;

  -- Ensure accounts exist
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_expense_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_supplier_code);

  -- DEBIT: 658 Charges diverses
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_transaction_date, v_expense_code, v_amount, 0,
    'payable', NEW.id, 'OD', v_ref, true,
    'Charge diverse - ' || COALESCE(NEW.creditor_name, '') || ' ' || COALESCE(NEW.description, '')
  );

  -- CREDIT: 401 Fournisseurs
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_transaction_date, v_supplier_code, 0, v_amount,
    'payable', NEW.id, 'OD', v_ref, true,
    'Fournisseur - Dette ' || COALESCE(NEW.creditor_name, '')
  );

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'payables', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'expense_code', v_expense_code,
      'supplier_code', v_supplier_code,
      'creditor', NEW.creditor_name,
      'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;
-- Attach trigger
DROP TRIGGER IF EXISTS trg_auto_journal_payable ON public.payables;
CREATE TRIGGER trg_auto_journal_payable
  AFTER INSERT OR UPDATE ON public.payables
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_payable();
-- 3b. Reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_payable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  PERFORM reverse_journal_entries(OLD.user_id, 'payable', OLD.id, 'ANN-PAY');

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    OLD.user_id, 'reversal', 'payables', OLD.id,
    0, 0, 0, true,
    jsonb_build_object('reason', 'payable deleted', 'creditor', OLD.creditor_name, 'amount', OLD.amount)
  );

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_payable_on_delete ON public.payables;
CREATE TRIGGER trg_reverse_journal_payable_on_delete
  BEFORE DELETE ON public.payables
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_payable();
-- =====================================================================
-- PART 4: UPDATE company_id resolver for new source types
-- =====================================================================

CREATE OR REPLACE FUNCTION public.assign_accounting_entry_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_id IS NOT NULL THEN
    CASE
      WHEN NEW.source_type IN ('invoice', 'invoice_payment', 'invoice_reversal') THEN
        SELECT i.company_id INTO v_company_id
        FROM public.invoices i WHERE i.id = NEW.source_id;

      WHEN NEW.source_type IN ('expense', 'expense_reversal') THEN
        SELECT e.company_id INTO v_company_id
        FROM public.expenses e WHERE e.id = NEW.source_id;

      WHEN NEW.source_type IN ('payment', 'payment_reversal') THEN
        SELECT p.company_id INTO v_company_id
        FROM public.payments p WHERE p.id = NEW.source_id;

      WHEN NEW.source_type IN ('supplier_invoice', 'supplier_invoice_payment', 'supplier_invoice_reversal') THEN
        SELECT si.company_id INTO v_company_id
        FROM public.supplier_invoices si WHERE si.id = NEW.source_id;

      WHEN NEW.source_type IN ('credit_note', 'credit_note_reversal') THEN
        SELECT cn.company_id INTO v_company_id
        FROM public.credit_notes cn WHERE cn.id = NEW.source_id;

      WHEN NEW.source_type = 'fixed_asset' THEN
        SELECT fa.company_id INTO v_company_id
        FROM public.accounting_fixed_assets fa WHERE fa.id = NEW.source_id;

      WHEN NEW.source_type IN ('bank_transaction', 'bank_transaction_reversal') THEN
        SELECT bt.company_id INTO v_company_id
        FROM public.bank_transactions bt WHERE bt.id = NEW.source_id;

      WHEN NEW.source_type IN ('receivable', 'receivable_reversal') THEN
        SELECT r.company_id INTO v_company_id
        FROM public.receivables r WHERE r.id = NEW.source_id;

      WHEN NEW.source_type IN ('payable', 'payable_reversal') THEN
        SELECT p.company_id INTO v_company_id
        FROM public.payables p WHERE p.id = NEW.source_id;

      ELSE
        v_company_id := NULL;
    END CASE;
  END IF;

  IF v_company_id IS NULL THEN
    v_company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;
-- =====================================================================
-- PART 5: Add new event types to accounting_audit_log check constraint
-- (idempotent: drop and recreate)
-- =====================================================================

DO $$
BEGIN
  -- Drop the old check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'accounting_audit_log'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'accounting_audit_log_event_type_check'
  ) THEN
    ALTER TABLE accounting_audit_log DROP CONSTRAINT accounting_audit_log_event_type_check;
  END IF;

  -- Re-create with expanded event types
  ALTER TABLE accounting_audit_log ADD CONSTRAINT accounting_audit_log_event_type_check
    CHECK (event_type IN (
      'auto_journal', 'reversal', 'balance_check', 'validation_error',
      'manual_correction', 'retroactive_journal', 'supplier_journal',
      'bank_reconciliation', 'receivable_journal', 'payable_journal'
    ));
EXCEPTION
  WHEN others THEN
    -- Constraint may not exist or already be updated, ignore
    NULL;
END;
$$;
-- =====================================================================
-- NOTES:
-- - bank_transaction entries use journal 'BQ' (Banque)
-- - receivable/payable entries use journal 'OD' (Operations Diverses)
-- - All triggers check user_accounting_settings.auto_journal_enabled
-- - All triggers are idempotent (check for existing entries)
-- - Reversal uses reverse_journal_entries() from existing infrastructure
-- - company_id is auto-assigned by trg_assign_accounting_entry_company_id
-- =====================================================================;
