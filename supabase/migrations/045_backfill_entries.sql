-- 045: Unified backfill function for stale accounting entries
-- Calls all individual backfill functions and returns total count

CREATE OR REPLACE FUNCTION backfill_accounting_entries(p_user_id UUID)
RETURNS TABLE(source_type TEXT, entries_created INT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_inv_count INT := 0;
  v_pay_count INT := 0;
  v_exp_count INT := 0;
  v_sinv_count INT := 0;
  v_cn_count INT := 0;
BEGIN
  -- Backfill invoices
  SELECT COALESCE(auto_journal_invoice_backfill(p_user_id), 0) INTO v_inv_count;

  -- Backfill payments
  SELECT COALESCE(auto_journal_payment_backfill(p_user_id), 0) INTO v_pay_count;

  -- Backfill expenses
  SELECT COALESCE(auto_journal_expense_backfill(p_user_id), 0) INTO v_exp_count;

  -- Backfill supplier invoices
  SELECT COALESCE(auto_journal_supplier_invoice_backfill(p_user_id), 0) INTO v_sinv_count;

  -- Backfill credit notes
  SELECT COALESCE(auto_journal_credit_note_backfill(p_user_id), 0) INTO v_cn_count;

  -- Log to audit
  INSERT INTO accounting_audit_log (user_id, event_type, source_table, source_id, entry_count, details)
  VALUES (p_user_id, 'backfill', 'all', gen_random_uuid(),
    v_inv_count + v_pay_count + v_exp_count + v_sinv_count + v_cn_count,
    jsonb_build_object(
      'invoices', v_inv_count,
      'payments', v_pay_count,
      'expenses', v_exp_count,
      'supplier_invoices', v_sinv_count,
      'credit_notes', v_cn_count
    ));

  RETURN QUERY VALUES
    ('invoices'::TEXT, v_inv_count),
    ('payments'::TEXT, v_pay_count),
    ('expenses'::TEXT, v_exp_count),
    ('supplier_invoices'::TEXT, v_sinv_count),
    ('credit_notes'::TEXT, v_cn_count);
END;
$$;
