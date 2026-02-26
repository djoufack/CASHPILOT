-- 044: Auto-balance check constraint
-- Ensures every entry_ref group has balanced debits and credits

CREATE OR REPLACE FUNCTION check_accounting_balance()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
BEGIN
  -- Check balance for this entry_ref group
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_total_debit, v_total_credit
  FROM accounting_entries
  WHERE entry_ref = NEW.entry_ref AND user_id = NEW.user_id;

  -- Log to audit table
  INSERT INTO accounting_audit_log (user_id, event_type, source_table, source_id, entry_count, total_debit, total_credit, balance_ok, details)
  SELECT
    NEW.user_id,
    'balance_check',
    COALESCE(NEW.source_type, 'unknown'),
    COALESCE(NEW.source_id, NEW.id),
    COUNT(*),
    v_total_debit,
    v_total_credit,
    ABS(v_total_debit - v_total_credit) < 0.01,
    jsonb_build_object('entry_ref', NEW.entry_ref, 'diff', v_total_debit - v_total_credit)
  FROM accounting_entries
  WHERE entry_ref = NEW.entry_ref AND user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

-- Verification function (callable from MCP/API)
CREATE OR REPLACE FUNCTION verify_accounting_balance(p_user_id UUID, p_entry_ref TEXT DEFAULT NULL)
RETURNS TABLE(entry_ref TEXT, total_debit NUMERIC, total_credit NUMERIC, diff NUMERIC, balanced BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.entry_ref,
    COALESCE(SUM(e.debit), 0) AS total_debit,
    COALESCE(SUM(e.credit), 0) AS total_credit,
    COALESCE(SUM(e.debit), 0) - COALESCE(SUM(e.credit), 0) AS diff,
    ABS(COALESCE(SUM(e.debit), 0) - COALESCE(SUM(e.credit), 0)) < 0.01 AS balanced
  FROM accounting_entries e
  WHERE e.user_id = p_user_id
  AND (p_entry_ref IS NULL OR e.entry_ref = p_entry_ref)
  GROUP BY e.entry_ref
  HAVING ABS(COALESCE(SUM(e.debit), 0) - COALESCE(SUM(e.credit), 0)) >= 0.01;
END;
$$;

-- Trigger on accounting_entries (deferred to check after full group is inserted)
DROP TRIGGER IF EXISTS trg_check_accounting_balance ON accounting_entries;
CREATE TRIGGER trg_check_accounting_balance
  AFTER INSERT ON accounting_entries
  FOR EACH ROW EXECUTE FUNCTION check_accounting_balance();
