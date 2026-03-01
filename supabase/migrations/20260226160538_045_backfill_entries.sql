CREATE OR REPLACE FUNCTION backfill_accounting_entries(
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  v_invoices_count INT := 0;
  v_expenses_count INT := 0;
  v_payments_count INT := 0;
  v_credit_notes_count INT := 0;
  v_supplier_invoices_count INT := 0;
  v_total_entries INT := 0;
  rec RECORD;
BEGIN
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

  FOR rec IN
    SELECT si.* FROM supplier_invoices si
    WHERE si.user_id = p_user_id
      AND si.status IN ('received', 'processed')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'supplier_invoice' AND ae.source_id = si.id AND ae.user_id = p_user_id
      )
  LOOP
    v_supplier_invoices_count := v_supplier_invoices_count + 1;
    IF NOT p_dry_run THEN
      PERFORM auto_journal_supplier_invoice_backfill(si.*) FROM supplier_invoices si WHERE si.id = rec.id;
    END IF;
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_journal_expense_backfill(p_expense expenses) RETURNS void AS $$
DECLARE
  v_expense_code TEXT; v_vat_code TEXT; v_bank_code TEXT; v_ref TEXT;
  v_amount_ht NUMERIC; v_tva NUMERIC; v_amount_ttc NUMERIC; v_txn_date DATE;
BEGIN
  v_expense_code := get_user_account_code(p_expense.user_id, 'expense.' || COALESCE(p_expense.category, 'general'));
  v_vat_code := get_user_account_code(p_expense.user_id, 'vat_input');
  v_bank_code := get_user_account_code(p_expense.user_id, 'bank');
  v_ref := 'EXP-' || p_expense.id::TEXT;
  v_amount_ht := COALESCE(p_expense.amount_ht, p_expense.amount, 0);
  v_tva := COALESCE(p_expense.tax_amount, 0);
  v_amount_ttc := v_amount_ht + v_tva;
  v_txn_date := COALESCE(p_expense.expense_date, p_expense.created_at::date, CURRENT_DATE);

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_expense.user_id, v_txn_date, v_expense_code, v_amount_ht, 0, 'expense', p_expense.id, 'AC', v_ref, true, 'Backfill - Depense ' || COALESCE(p_expense.category, 'divers'));

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_expense.user_id, v_txn_date, v_vat_code, v_tva, 0, 'expense', p_expense.id, 'AC', v_ref, true, 'Backfill - TVA deductible');
  END IF;

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_expense.user_id, v_txn_date, v_bank_code, 0, v_amount_ttc, 'expense', p_expense.id, 'AC', v_ref, true, 'Backfill - Reglement depense');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_journal_payment_backfill(p_payment payments) RETURNS void AS $$
DECLARE
  v_payment_code TEXT; v_client_code TEXT; v_ref TEXT;
BEGIN
  v_payment_code := get_payment_account_code(p_payment.user_id, COALESCE(p_payment.payment_method, 'bank_transfer'));
  v_client_code := get_user_account_code(p_payment.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(p_payment.receipt_number, p_payment.id::TEXT);

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_payment.user_id, COALESCE(p_payment.payment_date, CURRENT_DATE), v_payment_code, COALESCE(p_payment.amount, 0), 0, 'payment', p_payment.id, 'BQ', v_ref, true, 'Backfill - Paiement (' || COALESCE(p_payment.payment_method, 'bank') || ')');

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_payment.user_id, COALESCE(p_payment.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(p_payment.amount, 0), 'payment', p_payment.id, 'BQ', v_ref, true, 'Backfill - Client');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_journal_credit_note_backfill(p_cn credit_notes) RETURNS void AS $$
DECLARE
  v_revenue_code TEXT; v_vat_code TEXT; v_client_code TEXT; v_ref TEXT;
  v_total_ht NUMERIC; v_tva NUMERIC; v_total_ttc NUMERIC;
BEGIN
  v_total_ht := COALESCE(p_cn.total_ht, 0);
  v_tva := COALESCE(p_cn.tax_amount, 0);
  v_total_ttc := COALESCE(p_cn.total_ttc, v_total_ht + v_tva);
  IF v_total_ttc = 0 AND v_total_ht = 0 AND v_tva = 0 THEN RETURN; END IF;

  v_revenue_code := get_user_account_code(p_cn.user_id, 'revenue');
  v_vat_code := get_user_account_code(p_cn.user_id, 'vat_output');
  v_client_code := get_user_account_code(p_cn.user_id, 'client');
  v_ref := 'CN-' || COALESCE(p_cn.credit_note_number, p_cn.id::TEXT);

  IF v_total_ht > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_cn.user_id, COALESCE(p_cn.date, CURRENT_DATE), v_revenue_code, v_total_ht, 0, 'credit_note', p_cn.id, 'VE', v_ref, true, 'Backfill - Extourne vente');
  END IF;
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_cn.user_id, COALESCE(p_cn.date, CURRENT_DATE), v_vat_code, v_tva, 0, 'credit_note', p_cn.id, 'VE', v_ref, true, 'Backfill - Extourne TVA');
  END IF;
  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_cn.user_id, COALESCE(p_cn.date, CURRENT_DATE), v_client_code, 0, v_total_ttc, 'credit_note', p_cn.id, 'VE', v_ref, true, 'Backfill - Avoir client');
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice_backfill(p_si supplier_invoices) RETURNS void AS $$
DECLARE
  v_expense_code TEXT; v_vat_code TEXT; v_supplier_code TEXT; v_ref TEXT;
  v_amount_ht NUMERIC; v_tva NUMERIC; v_total_ttc NUMERIC;
BEGIN
  v_amount_ht := COALESCE(p_si.amount_ht, 0);
  v_tva := COALESCE(p_si.tax_amount, 0);
  v_total_ttc := COALESCE(p_si.total_ttc, v_amount_ht + v_tva);
  v_expense_code := get_user_account_code(p_si.user_id, 'expense.general');
  v_vat_code := get_user_account_code(p_si.user_id, 'vat_input');
  v_supplier_code := get_user_account_code(p_si.user_id, 'supplier');
  v_ref := 'SINV-' || COALESCE(p_si.invoice_number, p_si.id::TEXT);

  IF v_amount_ht > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_si.user_id, COALESCE(p_si.invoice_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'supplier_invoice', p_si.id, 'AC', v_ref, true, 'Backfill - Facture fournisseur');
  END IF;
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_si.user_id, COALESCE(p_si.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', p_si.id, 'AC', v_ref, true, 'Backfill - TVA deductible SINV');
  END IF;
  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_si.user_id, COALESCE(p_si.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_total_ttc, 'supplier_invoice', p_si.id, 'AC', v_ref, true, 'Backfill - Dette fournisseur');
  END IF;
END;
$$ LANGUAGE plpgsql;;
