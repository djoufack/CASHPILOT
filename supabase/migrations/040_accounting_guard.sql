-- ============================================================================
-- Migration 040: Garde-Fou Comptable
-- Validation en temps réel des écritures comptables
-- ============================================================================

-- ============================================================================
-- A. Trigger BEFORE INSERT — Prévention à la source
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_accounting_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Pas de montants négatifs
  IF COALESCE(NEW.debit, 0) < 0 OR COALESCE(NEW.credit, 0) < 0 THEN
    RAISE EXCEPTION 'Montants négatifs interdits (debit: %, credit: %)', NEW.debit, NEW.credit;
  END IF;

  -- 2. Pas les deux > 0 sur la même ligne
  IF COALESCE(NEW.debit, 0) > 0 AND COALESCE(NEW.credit, 0) > 0 THEN
    RAISE EXCEPTION 'Une ligne ne peut pas avoir à la fois un débit (%) et un crédit (%) > 0', NEW.debit, NEW.credit;
  END IF;

  -- 3. Pas de doublon exact (même entry_ref + account_code + date + montants)
  IF NEW.entry_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE user_id = NEW.user_id
      AND entry_ref = NEW.entry_ref
      AND account_code = NEW.account_code
      AND transaction_date = NEW.transaction_date
      AND COALESCE(debit, 0) = COALESCE(NEW.debit, 0)
      AND COALESCE(credit, 0) = COALESCE(NEW.credit, 0)
  ) THEN
    RAISE EXCEPTION 'Écriture doublon détectée (ref: %, compte: %, date: %)', NEW.entry_ref, NEW.account_code, NEW.transaction_date;
  END IF;

  -- 4. Compte doit exister dans le plan comptable (WARNING seulement)
  IF NEW.account_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM accounting_chart_of_accounts
    WHERE user_id = NEW.user_id AND account_code = NEW.account_code
  ) THEN
    RAISE WARNING 'Compte % inexistant dans le plan comptable pour user %', NEW.account_code, NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_accounting_entry ON accounting_entries;
CREATE TRIGGER trg_validate_accounting_entry
  BEFORE INSERT ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION validate_accounting_entry();

-- ============================================================================
-- B. Table accounting_health — État de santé comptable par utilisateur
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting_health (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_check_at TIMESTAMPTZ DEFAULT now(),
  is_balanced BOOLEAN DEFAULT true,
  last_entry_ref TEXT,
  last_warning TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE accounting_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own accounting health"
  ON accounting_health FOR SELECT
  USING (auth.uid() = user_id);

-- Allow the trigger function to insert/update (runs as definer)
CREATE POLICY "System can manage accounting health"
  ON accounting_health FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE accounting_health;

-- ============================================================================
-- C. Trigger AFTER INSERT — Vérification d'équilibre automatique
-- ============================================================================

CREATE OR REPLACE FUNCTION check_entry_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_diff NUMERIC;
  v_warning TEXT;
BEGIN
  -- Skip if no entry_ref (standalone entries)
  IF NEW.entry_ref IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate balance for the entry_ref group
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

  -- Upsert health status
  INSERT INTO accounting_health (user_id, last_check_at, is_balanced, last_entry_ref, last_warning, updated_at)
  VALUES (
    NEW.user_id,
    now(),
    v_diff < 0.01,
    NEW.entry_ref,
    v_warning,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    last_check_at = now(),
    is_balanced = EXCLUDED.is_balanced,
    last_entry_ref = EXCLUDED.last_entry_ref,
    last_warning = EXCLUDED.last_warning,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_entry_balance ON accounting_entries;
CREATE TRIGGER trg_check_entry_balance
  AFTER INSERT ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_entry_balance();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION validate_accounting_entry() IS
'Validates accounting entries before insert: no negative amounts, no dual debit+credit, no duplicates';

COMMENT ON FUNCTION check_entry_balance() IS
'After each entry insert, checks debit/credit balance for the entry_ref group and updates accounting_health';

COMMENT ON TABLE accounting_health IS
'Real-time accounting health status per user, updated by triggers, consumed by frontend via Supabase Realtime';
