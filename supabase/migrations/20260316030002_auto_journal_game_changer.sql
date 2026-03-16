-- Migration: Auto-journal triggers for Game Changer features (ENF-3 compliance)
-- Date: 2026-03-16
-- Creates 3 auto_journal triggers for double-entry bookkeeping:
--   1. mobile_money_transactions (status → 'completed')
--   2. expense_reports           (status → 'approved')
--   3. intercompany_transactions (status → 'synced')
-- Pattern: follows auto_journal_* from 20260308450000 and 20260315023405

-- =============================================
-- PART 1: Mobile Money → accounting entries
-- =============================================
-- Trigger on mobile_money_transactions: AFTER INSERT OR UPDATE when status = 'completed'
-- Default (invoice payment collection):
--   DEBIT  521000 (Mobile Money)
--   CREDIT 411000 (Clients)
-- If metadata->>'transaction_type' = 'payment_sent':
--   DEBIT  401000 (Fournisseurs)
--   CREDIT 521000 (Mobile Money)

CREATE OR REPLACE FUNCTION public.auto_journal_mobile_money()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_enabled BOOLEAN;
  v_ref TEXT;
  v_amount NUMERIC;
  v_txn_type TEXT;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_debit_desc TEXT;
  v_credit_desc TEXT;
BEGIN
  -- Only fire when status is 'completed'
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire when status actually transitions TO 'completed'
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;
  v_company_id := NEW.company_id;

  -- Check if auto-journal is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = v_user_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Resolve company_id if NULL
  v_company_id := COALESCE(v_company_id, resolve_preferred_company_id(v_user_id));
  IF v_company_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotency: skip if already journaled
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'mobile_money'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  v_ref := 'AJ-MOMO-' || LEFT(NEW.id::TEXT, 8);

  -- Determine transaction type from metadata or default to payment_received
  v_txn_type := COALESCE(NEW.metadata->>'transaction_type', 'payment_received');

  IF v_txn_type = 'payment_sent' THEN
    -- Paying a supplier via mobile money
    v_debit_code := '401000';
    v_credit_code := '521000';
    v_debit_desc := 'Paiement fournisseur Mobile Money - ' || COALESCE(NEW.provider, '') || ' ' || COALESCE(NEW.phone_number, '');
    v_credit_desc := 'Sortie Mobile Money - ' || COALESCE(NEW.provider, '') || ' ' || COALESCE(NEW.phone_number, '');
  ELSE
    -- Receiving payment from client via mobile money (default)
    v_debit_code := '521000';
    v_credit_code := '411000';
    v_debit_desc := 'Encaissement Mobile Money - ' || COALESCE(NEW.provider, '') || ' ' || COALESCE(NEW.phone_number, '');
    v_credit_desc := 'Reglement client Mobile Money - ' || COALESCE(NEW.provider, '') || ' ' || COALESCE(NEW.phone_number, '');
  END IF;

  -- Ensure accounts exist
  PERFORM ensure_account_exists(v_user_id, v_company_id, v_debit_code);
  PERFORM ensure_account_exists(v_user_id, v_company_id, v_credit_code);

  -- DEBIT entry
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    v_user_id, v_company_id,
    COALESCE(NEW.completed_at::DATE, CURRENT_DATE),
    v_debit_code, v_amount, 0,
    'mobile_money', NEW.id,
    'OD', v_ref, true, v_debit_desc
  );

  -- CREDIT entry
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    v_user_id, v_company_id,
    COALESCE(NEW.completed_at::DATE, CURRENT_DATE),
    v_credit_code, 0, v_amount,
    'mobile_money', NEW.id,
    'OD', v_ref, true, v_credit_desc
  );

  -- Audit log
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    v_user_id, 'auto_journal', 'mobile_money_transactions', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id,
      'ref', v_ref,
      'amount', v_amount,
      'provider', NEW.provider,
      'transaction_type', v_txn_type,
      'debit_code', v_debit_code,
      'credit_code', v_credit_code
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_mobile_money ON public.mobile_money_transactions;
CREATE TRIGGER trg_auto_journal_mobile_money
  AFTER INSERT OR UPDATE ON public.mobile_money_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_mobile_money();


-- =============================================
-- PART 2: Expense Reports → accounting entries
-- =============================================
-- Trigger on expense_reports: AFTER INSERT OR UPDATE when status = 'approved'
--   DEBIT  625000 (Frais de deplacement / missions)
--   CREDIT 421000 (Personnel - remunerations dues)

CREATE OR REPLACE FUNCTION public.auto_journal_expense_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_enabled BOOLEAN;
  v_ref TEXT;
  v_amount NUMERIC;
  v_employee_name TEXT;
BEGIN
  -- Only fire when status is 'approved'
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire when status actually transitions TO 'approved'
  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;
  v_company_id := NEW.company_id;

  -- Check if auto-journal is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = v_user_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Resolve company_id if NULL
  v_company_id := COALESCE(v_company_id, resolve_preferred_company_id(v_user_id));
  IF v_company_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotency: skip if already journaled
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'expense_report'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.total_amount, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  v_ref := 'AJ-NDF-' || LEFT(NEW.id::TEXT, 8);

  -- Get employee name for description
  SELECT e.full_name INTO v_employee_name
  FROM hr_employees e WHERE e.id = NEW.employee_id;

  -- Ensure accounts exist
  PERFORM ensure_account_exists(v_user_id, v_company_id, '625000');
  PERFORM ensure_account_exists(v_user_id, v_company_id, '421000');

  -- DEBIT 625000 (Frais de deplacement, missions, receptions)
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    v_user_id, v_company_id,
    COALESCE(NEW.approved_at::DATE, CURRENT_DATE),
    '625000', v_amount, 0,
    'expense_report', NEW.id,
    'OD', v_ref, true,
    'Note de frais approuvee - ' || COALESCE(NEW.title, '') || ' - ' || COALESCE(v_employee_name, '')
  );

  -- CREDIT 421000 (Personnel - remunerations dues)
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    v_user_id, v_company_id,
    COALESCE(NEW.approved_at::DATE, CURRENT_DATE),
    '421000', 0, v_amount,
    'expense_report', NEW.id,
    'OD', v_ref, true,
    'Remboursement note de frais - ' || COALESCE(NEW.title, '') || ' - ' || COALESCE(v_employee_name, '')
  );

  -- Audit log
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    v_user_id, 'auto_journal', 'expense_reports', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id,
      'ref', v_ref,
      'amount', v_amount,
      'title', NEW.title,
      'employee', v_employee_name
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_expense_report ON public.expense_reports;
CREATE TRIGGER trg_auto_journal_expense_report
  AFTER INSERT OR UPDATE ON public.expense_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_expense_report();


-- =============================================
-- PART 3: Intercompany Transactions → accounting entries
-- =============================================
-- Trigger on intercompany_transactions: AFTER INSERT OR UPDATE when status = 'synced'
-- If transaction_type = 'sale':
--   DEBIT  451000 (Groupe - compte courant)
--   CREDIT 701000 (Ventes de produits finis)
-- If transaction_type = 'purchase':
--   DEBIT  601000 (Achats de matieres premieres)
--   CREDIT 451000 (Groupe - compte courant)
-- If transaction_type = 'service':
--   DEBIT  451000 (Groupe - compte courant)
--   CREDIT 706000 (Prestations de services)
-- If transaction_type = 'transfer':
--   DEBIT  451000 (Groupe - debit)
--   CREDIT 451000 (Groupe - credit) — intra-group transfer

CREATE OR REPLACE FUNCTION public.auto_journal_intercompany()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_enabled BOOLEAN;
  v_ref TEXT;
  v_amount NUMERIC;
  v_debit_code TEXT;
  v_credit_code TEXT;
  v_debit_desc TEXT;
  v_credit_desc TEXT;
  v_linked_company_name TEXT;
BEGIN
  -- Only fire when status is 'synced'
  IF NEW.status <> 'synced' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only fire when status actually transitions TO 'synced'
  IF TG_OP = 'UPDATE' AND OLD.status = 'synced' THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;
  v_company_id := NEW.company_id;

  -- Check if auto-journal is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = v_user_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Resolve company_id if NULL
  v_company_id := COALESCE(v_company_id, resolve_preferred_company_id(v_user_id));
  IF v_company_id IS NULL THEN RETURN NEW; END IF;

  -- Idempotency: skip if already journaled
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'intercompany'
      AND source_id = NEW.id
      AND user_id = v_user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount <= 0 THEN RETURN NEW; END IF;

  v_ref := 'AJ-IC-' || LEFT(NEW.id::TEXT, 8);

  -- Get linked company name for description
  SELECT c.company_name INTO v_linked_company_name
  FROM company c WHERE c.id = NEW.linked_company_id;

  -- Determine accounts based on transaction_type
  CASE NEW.transaction_type
    WHEN 'sale' THEN
      v_debit_code := '451000';
      v_credit_code := '701000';
      v_debit_desc := 'Compte courant groupe - vente interco a ' || COALESCE(v_linked_company_name, '');
      v_credit_desc := 'Vente intercompagnie a ' || COALESCE(v_linked_company_name, '');
    WHEN 'purchase' THEN
      v_debit_code := '601000';
      v_credit_code := '451000';
      v_debit_desc := 'Achat intercompagnie de ' || COALESCE(v_linked_company_name, '');
      v_credit_desc := 'Compte courant groupe - achat interco de ' || COALESCE(v_linked_company_name, '');
    WHEN 'service' THEN
      v_debit_code := '451000';
      v_credit_code := '706000';
      v_debit_desc := 'Compte courant groupe - prestation interco a ' || COALESCE(v_linked_company_name, '');
      v_credit_desc := 'Prestation de service intercompagnie a ' || COALESCE(v_linked_company_name, '');
    WHEN 'transfer' THEN
      v_debit_code := '451000';
      v_credit_code := '451000';
      v_debit_desc := 'Transfert intragroupe vers ' || COALESCE(v_linked_company_name, '');
      v_credit_desc := 'Transfert intragroupe depuis ' || COALESCE(v_linked_company_name, '');
    ELSE
      -- Fallback: treat as sale
      v_debit_code := '451000';
      v_credit_code := '701000';
      v_debit_desc := 'Operation intercompagnie groupe - ' || COALESCE(v_linked_company_name, '');
      v_credit_desc := 'Operation intercompagnie vente - ' || COALESCE(v_linked_company_name, '');
  END CASE;

  -- Ensure accounts exist
  PERFORM ensure_account_exists(v_user_id, v_company_id, v_debit_code);
  IF v_debit_code <> v_credit_code THEN
    PERFORM ensure_account_exists(v_user_id, v_company_id, v_credit_code);
  END IF;

  -- DEBIT entry
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    v_user_id, v_company_id,
    COALESCE(NEW.created_at::DATE, CURRENT_DATE),
    v_debit_code, v_amount, 0,
    'intercompany', NEW.id,
    'OD', v_ref, true, v_debit_desc
  );

  -- CREDIT entry
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    v_user_id, v_company_id,
    COALESCE(NEW.created_at::DATE, CURRENT_DATE),
    v_credit_code, 0, v_amount,
    'intercompany', NEW.id,
    'OD', v_ref, true, v_credit_desc
  );

  -- Audit log
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    v_user_id, 'auto_journal', 'intercompany_transactions', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id,
      'ref', v_ref,
      'amount', v_amount,
      'transaction_type', NEW.transaction_type,
      'linked_company_id', NEW.linked_company_id,
      'linked_company_name', v_linked_company_name,
      'debit_code', v_debit_code,
      'credit_code', v_credit_code
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_journal_intercompany ON public.intercompany_transactions;
CREATE TRIGGER trg_auto_journal_intercompany
  AFTER INSERT OR UPDATE ON public.intercompany_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_intercompany();
