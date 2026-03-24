-- =====================================================================
-- FIX: Complete auto-journal trigger system for ALL CRUD operations
--
-- PROBLEM: The trigger functions auto_journal_invoice(), auto_journal_expense(),
-- auto_journal_payment() were created but NEVER attached to their tables.
-- Also: NO reversal triggers on DELETE for invoices, expenses, payments.
-- Also: UPDATE on expenses/payments not handled.
-- Also: credit_notes trigger not attached in main migrations.
--
-- company_id is resolved automatically by trg_assign_accounting_entry_company_id
-- (BEFORE INSERT on accounting_entries) via source_type + source_id lookup.
-- =====================================================================

-- =====================================================================
-- PART 1: ATTACH TRIGGERS (CREATE)
-- =====================================================================

-- 1a. INVOICES — INSERT/UPDATE (sale entry on status change, payment on paid)
DROP TRIGGER IF EXISTS trg_auto_journal_invoice ON public.invoices;
CREATE TRIGGER trg_auto_journal_invoice
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_invoice();
-- 1b. EXPENSES — INSERT (auto-journal on creation)
DROP TRIGGER IF EXISTS trg_auto_journal_expense ON public.expenses;
CREATE TRIGGER trg_auto_journal_expense
  AFTER INSERT ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_expense();
-- 1c. PAYMENTS — INSERT (auto-journal on creation)
DROP TRIGGER IF EXISTS trg_auto_journal_payment ON public.payments;
CREATE TRIGGER trg_auto_journal_payment
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_payment();
-- =====================================================================
-- PART 2: REVERSAL FUNCTIONS + TRIGGERS (DELETE & UPDATE-cancel)
-- =====================================================================

-- 2a. Generic reversal: reverse all entries for a given source_type + source_id
CREATE OR REPLACE FUNCTION reverse_journal_entries(
  p_user_id UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_ref_prefix TEXT DEFAULT 'ANN'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code,
    debit, credit,
    source_type, source_id, journal, entry_ref,
    is_auto, description
  )
  SELECT
    p_user_id,
    CURRENT_DATE,
    account_code,
    credit AS debit,   -- swap debit/credit for reversal
    debit AS credit,
    p_source_type || '_reversal',
    p_source_id,
    'OD',
    p_ref_prefix || '-' || entry_ref,
    true,
    'Annulation: ' || COALESCE(description, '')
  FROM accounting_entries
  WHERE source_type = p_source_type
    AND source_id = p_source_id
    AND user_id = p_user_id;
END;
$$;
-- 2b. INVOICE reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_invoice()
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

  -- Reverse sale entries
  PERFORM reverse_journal_entries(OLD.user_id, 'invoice', OLD.id, 'ANN-INV');
  -- Reverse payment entries if any
  PERFORM reverse_journal_entries(OLD.user_id, 'invoice_payment', OLD.id, 'ANN-PAY-INV');

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_invoice_on_delete ON public.invoices;
CREATE TRIGGER trg_reverse_journal_invoice_on_delete
  BEFORE DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_invoice();
-- Invoice reversal on status revert (sent/paid -> draft/cancelled)
CREATE OR REPLACE FUNCTION reverse_journal_invoice_on_cancel()
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
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Reverse when going back to draft or cancelled
  IF OLD.status NOT IN ('draft', 'cancelled') AND NEW.status IN ('draft', 'cancelled') THEN
    PERFORM reverse_journal_entries(NEW.user_id, 'invoice', NEW.id, 'ANN-INV');
  END IF;

  -- Reverse payment entries when payment_status reverts from paid
  IF OLD.payment_status = 'paid' AND NEW.payment_status != 'paid' THEN
    PERFORM reverse_journal_entries(NEW.user_id, 'invoice_payment', NEW.id, 'ANN-PAY-INV');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_invoice_on_cancel ON public.invoices;
CREATE TRIGGER trg_reverse_journal_invoice_on_cancel
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_invoice_on_cancel();
-- 2c. EXPENSE reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_expense()
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

  PERFORM reverse_journal_entries(OLD.user_id, 'expense', OLD.id, 'ANN-EXP');
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_expense_on_delete ON public.expenses;
CREATE TRIGGER trg_reverse_journal_expense_on_delete
  BEFORE DELETE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_expense();
-- 2d. EXPENSE UPDATE: re-journal on amount/category change
CREATE OR REPLACE FUNCTION update_journal_expense()
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
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only re-journal if financial data changed
  IF OLD.amount IS DISTINCT FROM NEW.amount
     OR OLD.amount_ht IS DISTINCT FROM NEW.amount_ht
     OR OLD.tax_amount IS DISTINCT FROM NEW.tax_amount
     OR OLD.category IS DISTINCT FROM NEW.category
     OR OLD.expense_date IS DISTINCT FROM NEW.expense_date THEN

    -- Delete old entries (will be re-created by INSERT trigger logic)
    DELETE FROM accounting_entries
    WHERE source_type = 'expense' AND source_id = NEW.id AND user_id = NEW.user_id AND is_auto = true;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_update_journal_expense ON public.expenses;
CREATE TRIGGER trg_update_journal_expense
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_expense();
-- Re-trigger expense auto-journal AFTER update (when entries were deleted)
DROP TRIGGER IF EXISTS trg_auto_journal_expense_on_update ON public.expenses;
CREATE TRIGGER trg_auto_journal_expense_on_update
  AFTER UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_expense();
-- 2e. PAYMENT reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_payment()
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

  PERFORM reverse_journal_entries(OLD.user_id, 'payment', OLD.id, 'ANN-PAY');
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_payment_on_delete ON public.payments;
CREATE TRIGGER trg_reverse_journal_payment_on_delete
  BEFORE DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_payment();
-- =====================================================================
-- PART 3: CREDIT NOTES auto-journal (if not already attached)
-- =====================================================================

CREATE OR REPLACE FUNCTION auto_journal_credit_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only journal when issued (not draft)
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status IN ('issued', 'sent', 'applied'))
    OR (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status IN ('issued', 'sent', 'applied'))
  ) THEN
    RETURN NEW;
  END IF;

  -- Idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'credit_note' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_revenue_code := get_user_account_code(NEW.user_id, 'revenue');
  v_vat_code := get_user_account_code(NEW.user_id, 'vat_output');
  v_ref := 'CN-' || COALESCE(NEW.credit_note_number, NEW.id::TEXT);
  v_amount_ht := COALESCE(NEW.total_ht, 0);
  v_tva := COALESCE(NEW.total_ttc, 0) - v_amount_ht;
  v_total_ttc := COALESCE(NEW.total_ttc, 0);

  IF v_total_ttc = 0 THEN RETURN NEW; END IF;

  -- DEBIT: Revenue (reverses original sale)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_revenue_code, v_amount_ht, 0, 'credit_note', NEW.id, 'VE', v_ref, true,
    'Avoir client - ' || COALESCE(NEW.credit_note_number, ''));

  -- DEBIT: VAT output (reverses original VAT)
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, v_tva, 0, 'credit_note', NEW.id, 'VE', v_ref, true,
      'TVA sur avoir - ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  -- CREDIT: Client (reduces receivable)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, 0, v_total_ttc, 'credit_note', NEW.id, 'VE', v_ref, true,
    'Reduction creance client - ' || COALESCE(NEW.credit_note_number, ''));

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_journal_credit_note ON public.credit_notes;
CREATE TRIGGER trg_auto_journal_credit_note
  AFTER INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_credit_note();
-- Credit note reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_credit_note()
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

  IF v_enabled IS NOT TRUE THEN RETURN OLD; END IF;

  PERFORM reverse_journal_entries(OLD.user_id, 'credit_note', OLD.id, 'ANN-CN');
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_credit_note_on_delete ON public.credit_notes;
CREATE TRIGGER trg_reverse_journal_credit_note_on_delete
  BEFORE DELETE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_credit_note();
-- =====================================================================
-- PART 4: Add supplier_invoice source types to company_id resolver
-- (supplier_invoice_reversal, credit_note_reversal, etc.)
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
-- PART 5: BACKFILL existing data missing accounting entries
-- =====================================================================

-- 5a. Backfill invoices (non-draft, without existing VE entries)
DO $$
DECLARE
  rec RECORD;
  v_enabled BOOLEAN;
  v_client_code TEXT;
  v_vat_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
  v_has_items BOOLEAN;
  item RECORD;
  v_bank_code TEXT;
BEGIN
  FOR rec IN
    SELECT i.*
    FROM invoices i
    WHERE i.status IS NOT NULL AND i.status NOT IN ('draft', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'invoice' AND ae.source_id = i.id
          AND ae.journal = 'VE' AND ae.user_id = i.user_id
      )
    ORDER BY i.date ASC
  LOOP
    SELECT auto_journal_enabled INTO v_enabled
    FROM user_accounting_settings WHERE user_id = rec.user_id;

    IF v_enabled IS TRUE THEN
      v_client_code := get_user_account_code(rec.user_id, 'client');
      v_vat_code := get_user_account_code(rec.user_id, 'vat_output');
      v_ref := 'INV-' || COALESCE(rec.invoice_number, rec.id::TEXT);
      v_tva := COALESCE(rec.total_ttc, 0) - COALESCE(rec.total_ht, 0);

      -- Debit: Client (TTC)
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), v_client_code, COALESCE(rec.total_ttc, 0), 0, 'invoice', rec.id, 'VE', v_ref, true, 'Facture ' || COALESCE(rec.invoice_number, ''));

      -- Credit: Revenue by item type
      SELECT EXISTS(SELECT 1 FROM invoice_items WHERE invoice_id = rec.id) INTO v_has_items;

      IF v_has_items THEN
        FOR item IN
          SELECT
            CASE
              WHEN item_type = 'product' THEN 'revenue.product'
              WHEN item_type IN ('service', 'timesheet') THEN 'revenue.service'
              ELSE 'revenue'
            END AS revenue_key,
            CASE
              WHEN item_type = 'product' THEN 'Vente produits'
              WHEN item_type IN ('service', 'timesheet') THEN 'Vente services'
              ELSE 'Vente HT'
            END AS desc_prefix,
            SUM(COALESCE(quantity * unit_price, 0)) AS line_total
          FROM invoice_items WHERE invoice_id = rec.id
          GROUP BY 1, 2
        LOOP
          IF item.line_total > 0 THEN
            INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
            VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), get_user_account_code(rec.user_id, item.revenue_key), 0, item.line_total, 'invoice', rec.id, 'VE', v_ref, true, item.desc_prefix || ' - ' || COALESCE(rec.invoice_number, ''));
          END IF;
        END LOOP;
      ELSE
        IF COALESCE(rec.total_ht, 0) > 0 THEN
          INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
          VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), get_user_account_code(rec.user_id, 'revenue'), 0, COALESCE(rec.total_ht, 0), 'invoice', rec.id, 'VE', v_ref, true, 'Vente HT - ' || COALESCE(rec.invoice_number, ''));
        END IF;
      END IF;

      -- Credit: VAT
      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), v_vat_code, 0, v_tva, 'invoice', rec.id, 'VE', v_ref, true, 'TVA collectee - ' || COALESCE(rec.invoice_number, ''));
      END IF;

      -- Payment entry if already paid
      IF rec.payment_status = 'paid' AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'invoice_payment' AND ae.source_id = rec.id
          AND ae.journal = 'BQ' AND ae.user_id = rec.user_id
      ) THEN
        v_bank_code := get_user_account_code(rec.user_id, 'bank');
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), v_bank_code, COALESCE(rec.total_ttc, 0), 0, 'invoice_payment', rec.id, 'BQ', 'PAY-INV-' || COALESCE(rec.invoice_number, rec.id::TEXT), true, 'Encaissement facture ' || COALESCE(rec.invoice_number, ''));

        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), v_client_code, 0, COALESCE(rec.total_ttc, 0), 'invoice_payment', rec.id, 'BQ', 'PAY-INV-' || COALESCE(rec.invoice_number, rec.id::TEXT), true, 'Encaissement client - ' || COALESCE(rec.invoice_number, ''));
      END IF;
    END IF;
  END LOOP;
  RAISE NOTICE 'Invoice backfill complete';
END;
$$;
-- 5b. Backfill expenses
DO $$
DECLARE
  rec RECORD;
  v_enabled BOOLEAN;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
BEGIN
  FOR rec IN
    SELECT e.*
    FROM expenses e
    WHERE NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.source_type = 'expense' AND ae.source_id = e.id AND ae.user_id = e.user_id
    )
    ORDER BY e.expense_date ASC
  LOOP
    SELECT auto_journal_enabled INTO v_enabled
    FROM user_accounting_settings WHERE user_id = rec.user_id;

    IF v_enabled IS TRUE THEN
      v_expense_code := get_user_account_code(rec.user_id, 'expense.' || COALESCE(rec.category, 'general'));
      v_vat_code := get_user_account_code(rec.user_id, 'vat_input');
      v_bank_code := get_user_account_code(rec.user_id, 'bank');
      v_ref := 'EXP-' || LEFT(rec.id::TEXT, 8);
      v_amount_ht := COALESCE(rec.amount_ht, rec.amount, 0);
      v_tva := COALESCE(rec.tax_amount, 0);
      v_amount_ttc := CASE WHEN v_tva > 0 THEN v_amount_ht + v_tva ELSE COALESCE(rec.amount, v_amount_ht) END;

      IF v_amount_ttc = 0 AND v_amount_ht = 0 THEN CONTINUE; END IF;

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (rec.user_id, COALESCE(rec.expense_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'expense', rec.id, 'AC', v_ref, true,
        'Charge ' || COALESCE(rec.category, 'divers') || ': ' || COALESCE(rec.description, ''));

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (rec.user_id, COALESCE(rec.expense_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'expense', rec.id, 'AC', v_ref, true,
          'TVA deductible - ' || COALESCE(rec.description, ''));
      END IF;

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (rec.user_id, COALESCE(rec.expense_date, CURRENT_DATE), v_bank_code, 0, v_amount_ttc, 'expense', rec.id, 'AC', v_ref, true,
        'Reglement charge - ' || COALESCE(rec.description, ''));
    END IF;
  END LOOP;
  RAISE NOTICE 'Expense backfill complete';
END;
$$;
-- 5c. Backfill payments
DO $$
DECLARE
  rec RECORD;
  v_enabled BOOLEAN;
  v_debit_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
BEGIN
  FOR rec IN
    SELECT p.*
    FROM payments p
    WHERE NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.source_type = 'payment' AND ae.source_id = p.id AND ae.user_id = p.user_id
    )
    ORDER BY p.payment_date ASC
  LOOP
    SELECT auto_journal_enabled INTO v_enabled
    FROM user_accounting_settings WHERE user_id = rec.user_id;

    IF v_enabled IS TRUE THEN
      v_debit_code := CASE COALESCE(rec.payment_method, 'bank_transfer')
        WHEN 'cash' THEN get_user_account_code(rec.user_id, 'cash')
        WHEN 'check' THEN get_user_account_code(rec.user_id, 'check')
        ELSE get_user_account_code(rec.user_id, 'bank')
      END;
      v_client_code := get_user_account_code(rec.user_id, 'client');
      v_ref := 'PAY-' || COALESCE(rec.receipt_number, LEFT(rec.id::TEXT, 8));

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (rec.user_id, COALESCE(rec.payment_date, CURRENT_DATE), v_debit_code, COALESCE(rec.amount, 0), 0, 'payment', rec.id, 'BQ', v_ref, true,
        'Encaissement ' || COALESCE(rec.payment_method, 'virement') || ' - ' || COALESCE(rec.reference, ''));

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (rec.user_id, COALESCE(rec.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(rec.amount, 0), 'payment', rec.id, 'BQ', v_ref, true,
        'Paiement client - ' || COALESCE(rec.reference, ''));
    END IF;
  END LOOP;
  RAISE NOTICE 'Payment backfill complete';
END;
$$;
-- 5d. Backfill credit notes
DO $$
DECLARE
  rec RECORD;
  v_enabled BOOLEAN;
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  FOR rec IN
    SELECT cn.*
    FROM credit_notes cn
    WHERE cn.status IN ('issued', 'sent', 'applied')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'credit_note' AND ae.source_id = cn.id AND ae.user_id = cn.user_id
      )
    ORDER BY cn.date ASC
  LOOP
    SELECT auto_journal_enabled INTO v_enabled
    FROM user_accounting_settings WHERE user_id = rec.user_id;

    IF v_enabled IS TRUE THEN
      v_client_code := get_user_account_code(rec.user_id, 'client');
      v_revenue_code := get_user_account_code(rec.user_id, 'revenue');
      v_vat_code := get_user_account_code(rec.user_id, 'vat_output');
      v_ref := 'CN-' || COALESCE(rec.credit_note_number, rec.id::TEXT);
      v_amount_ht := COALESCE(rec.total_ht, 0);
      v_tva := COALESCE(rec.total_ttc, 0) - v_amount_ht;
      v_total_ttc := COALESCE(rec.total_ttc, 0);

      IF v_total_ttc = 0 THEN CONTINUE; END IF;

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), v_revenue_code, v_amount_ht, 0, 'credit_note', rec.id, 'VE', v_ref, true,
        'Avoir client - ' || COALESCE(rec.credit_note_number, ''));

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), v_vat_code, v_tva, 0, 'credit_note', rec.id, 'VE', v_ref, true,
          'TVA sur avoir - ' || COALESCE(rec.credit_note_number, ''));
      END IF;

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (rec.user_id, COALESCE(rec.date, CURRENT_DATE), v_client_code, 0, v_total_ttc, 'credit_note', rec.id, 'VE', v_ref, true,
        'Reduction creance client - ' || COALESCE(rec.credit_note_number, ''));
    END IF;
  END LOOP;
  RAISE NOTICE 'Credit note backfill complete';
END;
$$;
-- =====================================================================
-- NOTES:
-- - quotes and purchase_orders are NOT journalized (they are not
--   accounting events per se — only invoices/payments are)
-- - supplier_orders generate entries via supplier_invoices
-- - company_id is auto-assigned by trg_assign_accounting_entry_company_id
-- =====================================================================;
