-- Fix: accounting trigger functions need SECURITY DEFINER to bypass RLS
-- when inserting into accounting_health and accounting_balance_checks.

-- 1. Make check_entry_balance() SECURITY DEFINER
CREATE OR REPLACE FUNCTION check_entry_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_diff NUMERIC;
  v_warning TEXT;
BEGIN
  IF NEW.entry_ref IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(COALESCE(debit, 0)), 0),
         COALESCE(SUM(COALESCE(credit, 0)), 0)
  INTO v_total_debit, v_total_credit
  FROM accounting_entries
  WHERE user_id = NEW.user_id
    AND entry_ref = NEW.entry_ref;

  v_diff := ABS(v_total_debit - v_total_credit);

  IF v_diff >= 0.01 THEN
    v_warning := 'Déséquilibre de ' || ROUND(v_diff::numeric, 2) || ' sur ' || NEW.entry_ref;
  ELSE
    v_warning := NULL;
  END IF;

  INSERT INTO accounting_health (user_id, last_check_at, is_balanced, last_entry_ref, last_warning, updated_at)
  VALUES (NEW.user_id, now(), v_diff < 0.01, NEW.entry_ref, v_warning, now())
  ON CONFLICT (user_id) DO UPDATE SET
    last_check_at = now(),
    is_balanced = EXCLUDED.is_balanced,
    last_entry_ref = EXCLUDED.last_entry_ref,
    last_warning = EXCLUDED.last_warning,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Make check_accounting_balance() SECURITY DEFINER
CREATE OR REPLACE FUNCTION check_accounting_balance()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
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
