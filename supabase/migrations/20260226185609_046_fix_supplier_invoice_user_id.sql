
-- Fix: supplier_invoices has no user_id column
-- Must join through suppliers table to get user_id

-- 1. Fix the auto_journal_supplier_invoice trigger to resolve user_id via suppliers
CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_user_id UUID;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_supplier_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  -- Resolve user_id from suppliers table
  SELECT s.user_id INTO v_user_id
  FROM suppliers s WHERE s.id = NEW.supplier_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = v_user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_ref := 'SINV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
  v_amount_ht := COALESCE(NEW.total_ht, 0);
  v_tva := COALESCE(NEW.vat_amount, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, v_amount_ht + v_tva);

  IF (TG_OP = 'INSERT' AND NEW.payment_status IN ('pending', 'partial'))
     OR (TG_OP = 'UPDATE' AND OLD.payment_status = 'unpaid' AND NEW.payment_status IN ('pending', 'partial')) THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice' AND source_id = NEW.id AND journal = 'AC'
      AND user_id = v_user_id
    ) THEN
      v_expense_code := get_user_account_code(v_user_id, 'expense.general');
      v_vat_code := get_user_account_code(v_user_id, 'vat_input');
      v_supplier_code := get_user_account_code(v_user_id, 'supplier');

      IF v_amount_ht > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Facture fournisseur - ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'TVA deductible - SINV ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      IF v_total_ttc > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_total_ttc, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Dette fournisseur - ' || COALESCE(NEW.invoice_number, ''));
      END IF;
    END IF;
  END IF;

  -- Payment
  IF TG_OP = 'UPDATE'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice_payment' AND source_id = NEW.id AND journal = 'BQ'
      AND user_id = v_user_id
    ) THEN
      v_supplier_code := get_user_account_code(v_user_id, 'supplier');
      v_bank_code := get_user_account_code(v_user_id, 'bank');

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (v_user_id, CURRENT_DATE, v_supplier_code, v_total_ttc, 0, 'supplier_invoice_payment', NEW.id, 'BQ', 'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Reglement fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (v_user_id, CURRENT_DATE, v_bank_code, 0, v_total_ttc, 'supplier_invoice_payment', NEW.id, 'BQ', 'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Paiement fournisseur - ' || COALESCE(NEW.invoice_number, ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Fix reverse function
CREATE OR REPLACE FUNCTION reverse_journal_supplier_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT s.user_id INTO v_user_id FROM suppliers s WHERE s.id = OLD.supplier_id;
    DELETE FROM accounting_entries
    WHERE source_type IN ('supplier_invoice', 'supplier_invoice_payment')
    AND source_id = OLD.id AND user_id = v_user_id AND is_auto = true;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.payment_status = 'cancelled' AND OLD.payment_status != 'cancelled' THEN
    SELECT s.user_id INTO v_user_id FROM suppliers s WHERE s.id = NEW.supplier_id;
    DELETE FROM accounting_entries
    WHERE source_type IN ('supplier_invoice', 'supplier_invoice_payment')
    AND source_id = NEW.id AND user_id = v_user_id AND is_auto = true;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Fix backfill function - join supplier_invoices through suppliers
CREATE OR REPLACE FUNCTION backfill_accounting_entries(p_user_id UUID, p_dry_run BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_invoices_count INT := 0;
  v_expenses_count INT := 0;
  v_payments_count INT := 0;
  v_credit_notes_count INT := 0;
  v_supplier_invoices_count INT := 0;
  v_total_entries INT := 0;
  rec RECORD;
BEGIN
  -- Invoices
  FOR rec IN
    SELECT i.* FROM invoices i
    WHERE i.user_id = p_user_id
      AND i.status NOT IN ('draft', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'invoice' AND ae.source_id = i.id AND ae.journal = 'VE' AND ae.user_id = p_user_id
      )
  LOOP
    v_invoices_count := v_invoices_count + 1;
    IF NOT p_dry_run THEN
      UPDATE invoices SET status = 'draft' WHERE id = rec.id AND user_id = p_user_id;
      UPDATE invoices SET status = rec.status WHERE id = rec.id AND user_id = p_user_id;
    END IF;
  END LOOP;

  -- Expenses
  FOR rec IN
    SELECT e.* FROM expenses e
    WHERE e.user_id = p_user_id
      AND e.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'expense' AND ae.source_id = e.id AND ae.user_id = p_user_id
      )
  LOOP
    v_expenses_count := v_expenses_count + 1;
    IF NOT p_dry_run THEN
      PERFORM auto_journal_expense_backfill(e.*) FROM expenses e WHERE e.id = rec.id;
    END IF;
  END LOOP;

  -- Payments
  FOR rec IN
    SELECT p.* FROM payments p
    WHERE p.user_id = p_user_id
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'payment' AND ae.source_id = p.id AND ae.user_id = p_user_id
      )
  LOOP
    v_payments_count := v_payments_count + 1;
    IF NOT p_dry_run THEN
      PERFORM auto_journal_payment_backfill(p.*) FROM payments p WHERE p.id = rec.id;
    END IF;
  END LOOP;

  -- Credit notes
  FOR rec IN
    SELECT cn.* FROM credit_notes cn
    WHERE cn.user_id = p_user_id
      AND cn.status = 'issued'
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'credit_note' AND ae.source_id = cn.id AND ae.user_id = p_user_id
      )
  LOOP
    v_credit_notes_count := v_credit_notes_count + 1;
    IF NOT p_dry_run THEN
      PERFORM auto_journal_credit_note_backfill(cn.*) FROM credit_notes cn WHERE cn.id = rec.id;
    END IF;
  END LOOP;

  -- Supplier invoices: join through suppliers to get user_id
  FOR rec IN
    SELECT si.* FROM supplier_invoices si
    JOIN suppliers s ON s.id = si.supplier_id
    WHERE s.user_id = p_user_id
      AND si.payment_status NOT IN ('cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'supplier_invoice' AND ae.source_id = si.id AND ae.user_id = p_user_id
      )
  LOOP
    v_supplier_invoices_count := v_supplier_invoices_count + 1;
    -- Trigger will fire on update and handle the journaling
  END LOOP;

  v_total_entries := v_invoices_count + v_expenses_count + v_payments_count + v_credit_notes_count + v_supplier_invoices_count;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'user_id', p_user_id,
    'documents_missing_entries', jsonb_build_object(
      'invoices', v_invoices_count,
      'expenses', v_expenses_count,
      'payments', v_payments_count,
      'credit_notes', v_credit_notes_count,
      'supplier_invoices', v_supplier_invoices_count,
      'total', v_total_entries
    )
  );
END;
$$;
;
