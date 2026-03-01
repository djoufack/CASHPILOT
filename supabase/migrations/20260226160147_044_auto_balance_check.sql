CREATE OR REPLACE FUNCTION check_accounting_balance() RETURNS TRIGGER AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_balanced BOOLEAN;
BEGIN
  IF NEW.source_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_total_debit, v_total_credit
  FROM accounting_entries
  WHERE source_type = NEW.source_type
    AND source_id = NEW.source_id
    AND user_id = NEW.user_id;

  v_balanced := ABS(v_total_debit - v_total_credit) < 0.01;

  INSERT INTO accounting_balance_checks (user_id, source_type, source_id, total_debit, total_credit, is_balanced, checked_at, details)
  VALUES (
    NEW.user_id, NEW.source_type, NEW.source_id,
    ROUND(v_total_debit, 2), ROUND(v_total_credit, 2),
    v_balanced, now(),
    jsonb_build_object('entry_ref', NEW.entry_ref, 'last_entry_id', NEW.id)
  )
  ON CONFLICT (source_id) DO UPDATE SET
    total_debit = EXCLUDED.total_debit,
    total_credit = EXCLUDED.total_credit,
    is_balanced = EXCLUDED.is_balanced,
    checked_at = EXCLUDED.checked_at,
    details = EXCLUDED.details;

  IF NOT v_balanced THEN
    RAISE WARNING 'Desequilibre comptable: source_type=%, source_id=%, debit=%, credit=%',
      NEW.source_type, NEW.source_id, v_total_debit, v_total_credit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_balance_check_source'
  ) THEN
    ALTER TABLE accounting_balance_checks
      ADD CONSTRAINT uq_balance_check_source UNIQUE (source_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_check_balance ON accounting_entries;
CREATE TRIGGER trg_check_balance
  AFTER INSERT ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_accounting_balance();

COMMENT ON FUNCTION check_accounting_balance() IS 'Verifies debit/credit balance for each source document after entry insertion';;
