-- ============================================================================
-- FIX-11: Complete auto_journal trigger for credit notes (ENF-3 compliance)
-- Date: 2026-03-29
--
-- PROBLEMS IDENTIFIED:
--   1. auto_journal_credit_note() (last updated in 20260308450000) is MISSING
--      the accounting_audit_log INSERT — violating ENF-3 requirement:
--      "Audit: accounting_audit_log traces each automatic journalization".
--      All newer triggers (mobile_money, expense_report, intercompany, payroll)
--      correctly log to accounting_audit_log; credit notes do not.
--
--   2. auto_journal_credit_note() does NOT call ensure_account_exists() before
--      inserting entries, unlike all newer trigger functions. This can silently
--      fail or leave chart-of-accounts gaps.
--
--   3. Missing auto_journal_enabled guard — the function was stripped of the
--      auto_journal_enabled check in 20260308110000. Newer triggers check it
--      consistently. Re-adding for consistency (default TRUE per
--      20260308110000 migration).
--
--   4. accounting_audit_log gained a company_id column in 20260329035000 but
--      the credit note trigger was never updated to populate it.
--
--   5. No cancel-reversal trigger — when a credit note status changes from
--      'issued'/'applied' to 'cancelled', accounting entries are not reversed.
--      The delete reversal exists, but status-based cancellation is not handled.
--
-- FIXES:
--   A. Rewrite auto_journal_credit_note() to:
--      - Check auto_journal_enabled (consistent with other triggers)
--      - Call ensure_account_exists() for all three accounts
--      - Insert into accounting_audit_log WITH company_id
--      - Log entry_count correctly (2 or 3 depending on VAT)
--
--   B. Add cancel-reversal trigger:
--      trg_reverse_journal_credit_note_on_cancel
--      Fires BEFORE UPDATE when status transitions to 'cancelled'
--
--   C. Backfill: insert missing audit log entries for already-journalized
--      credit notes (idempotent — only inserts missing rows)
-- ============================================================================

-- ============================================================================
-- PART A: Rewrite auto_journal_credit_note() with full ENF-3 compliance
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_journal_credit_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled       BOOLEAN;
  v_company_id    UUID;
  v_client_code   TEXT;
  v_revenue_code  TEXT;
  v_vat_code      TEXT;
  v_ref           TEXT;
  v_amount_ht     NUMERIC;
  v_tva           NUMERIC;
  v_total_ttc     NUMERIC;
  v_entry_count   INT;
BEGIN
  -- Only fire on INSERT when status is already issued/applied,
  -- OR on UPDATE when transitioning from 'draft' to an active status.
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status IN ('issued', 'sent', 'applied'))
    OR (TG_OP = 'UPDATE' AND OLD.status = 'draft'
        AND NEW.status IN ('issued', 'sent', 'applied'))
  ) THEN
    RETURN NEW;
  END IF;

  -- Check auto_journal_enabled (default TRUE per system configuration)
  SELECT COALESCE(auto_journal_enabled, true)
  INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF NOT COALESCE(v_enabled, true) THEN
    RETURN NEW;
  END IF;

  -- Idempotency guard: skip if entries already exist for this credit note
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'credit_note'
      AND source_id   = NEW.id
      AND user_id     = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve company_id (ENF-2: all entries must reference company)
  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));
  IF v_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve account codes from user/company configuration (ENF-1: no hardcoded data)
  v_client_code  := get_user_account_code(NEW.user_id, 'client');
  v_revenue_code := get_user_account_code(NEW.user_id, 'revenue');
  v_vat_code     := get_user_account_code(NEW.user_id, 'vat_output');
  v_ref          := 'CN-' || COALESCE(NEW.credit_note_number, NEW.id::TEXT);
  v_amount_ht    := COALESCE(NEW.total_ht, 0);
  v_tva          := ROUND((COALESCE(NEW.total_ttc, 0) - v_amount_ht)::NUMERIC, 2);
  v_total_ttc    := COALESCE(NEW.total_ttc, 0);

  -- Nothing to journal if total is zero
  IF v_total_ttc = 0 THEN
    RETURN NEW;
  END IF;

  -- Ensure accounts exist in chart of accounts (creates them if missing)
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_revenue_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_vat_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);

  -- ── DEBIT: Revenue account (reverses the original sale revenue) ────────
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
    v_revenue_code, v_amount_ht, 0,
    'credit_note', NEW.id, 'VE', v_ref, true,
    'Avoir client - ' || COALESCE(NEW.credit_note_number, '')
  );

  v_entry_count := 1;

  -- ── DEBIT: VAT output (reverses the original VAT collected) ───────────
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id,
      journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
      v_vat_code, v_tva, 0,
      'credit_note', NEW.id, 'VE', v_ref, true,
      'TVA sur avoir - ' || COALESCE(NEW.credit_note_number, '')
    );
    v_entry_count := v_entry_count + 1;
  END IF;

  -- ── CREDIT: Client/Receivable account (reduces accounts receivable) ───
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit, source_type, source_id,
    journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
    v_client_code, 0, v_total_ttc,
    'credit_note', NEW.id, 'VE', v_ref, true,
    'Reduction creance client - ' || COALESCE(NEW.credit_note_number, '')
  );
  v_entry_count := v_entry_count + 1;

  -- ── Audit log (ENF-3 requirement: trace every auto-journalization) ─────
  INSERT INTO accounting_audit_log (
    user_id, company_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id,
    v_company_id,
    'auto_journal',
    'credit_notes',
    NEW.id,
    v_entry_count,
    v_total_ttc,  -- total debit = HT + TVA = TTC
    v_total_ttc,  -- total credit = TTC (balanced)
    true,
    jsonb_build_object(
      'company_id',          v_company_id,
      'ref',                 v_ref,
      'credit_note_number',  NEW.credit_note_number,
      'total_ht',            v_amount_ht,
      'total_tva',           v_tva,
      'total_ttc',           v_total_ttc,
      'revenue_code',        v_revenue_code,
      'vat_code',            v_vat_code,
      'client_code',         v_client_code,
      'status',              NEW.status
    )
  );

  RETURN NEW;
END;
$$;

-- Re-attach the trigger (idempotent via DROP IF EXISTS)
DROP TRIGGER IF EXISTS trg_auto_journal_credit_note ON public.credit_notes;
CREATE TRIGGER trg_auto_journal_credit_note
  AFTER INSERT OR UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_journal_credit_note();


-- ============================================================================
-- PART B: Cancel-reversal trigger
-- Fires BEFORE UPDATE when credit note moves to 'cancelled' status.
-- Reverses all existing accounting entries for the credit note.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_journal_credit_note_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  -- Only fire when transitioning TO 'cancelled' from an active status
  IF OLD.status NOT IN ('issued', 'sent', 'applied') OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(auto_journal_enabled, true)
  INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF NOT COALESCE(v_enabled, true) THEN
    RETURN NEW;
  END IF;

  PERFORM reverse_journal_entries(OLD.user_id, 'credit_note', OLD.id, 'ANN-CN');

  -- Audit log for reversal
  INSERT INTO accounting_audit_log (
    user_id, company_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  )
  SELECT
    OLD.user_id,
    OLD.company_id,
    'reversal',
    'credit_notes',
    OLD.id,
    COUNT(*),
    SUM(debit),
    SUM(credit),
    ABS(SUM(debit) - SUM(credit)) < 0.01,
    jsonb_build_object(
      'reason', 'credit_note_cancelled',
      'credit_note_number', OLD.credit_note_number,
      'old_status', OLD.status,
      'new_status', NEW.status
    )
  FROM accounting_entries
  WHERE source_type = 'credit_note_reversal'
    AND source_id   = OLD.id
    AND user_id     = OLD.user_id
    AND created_at >= NOW() - INTERVAL '5 seconds';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_journal_credit_note_on_cancel ON public.credit_notes;
CREATE TRIGGER trg_reverse_journal_credit_note_on_cancel
  BEFORE UPDATE ON public.credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.reverse_journal_credit_note_on_cancel();


-- ============================================================================
-- PART C: Backfill missing audit log entries
-- For credit notes that were already journalized (accounting_entries exist)
-- but have no corresponding accounting_audit_log entry.
-- This is idempotent — only inserts rows where none exist.
-- ============================================================================

DO $$
DECLARE
  rec         RECORD;
  v_count     INT;
  v_debit     NUMERIC;
  v_credit    NUMERIC;
  v_ref       TEXT;
BEGIN
  FOR rec IN
    SELECT cn.id,
           cn.user_id,
           cn.company_id,
           cn.credit_note_number,
           cn.status,
           cn.total_ht,
           cn.total_ttc,
           cn.date
    FROM credit_notes cn
    WHERE cn.status IN ('issued', 'sent', 'applied')
      AND EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'credit_note'
          AND ae.source_id   = cn.id
          AND ae.user_id     = cn.user_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM accounting_audit_log aal
        WHERE aal.source_table = 'credit_notes'
          AND aal.source_id    = cn.id
          AND aal.user_id      = cn.user_id
          AND aal.event_type   = 'auto_journal'
      )
    ORDER BY COALESCE(cn.date, cn.created_at) ASC
  LOOP
    SELECT COUNT(*), SUM(debit), SUM(credit)
    INTO v_count, v_debit, v_credit
    FROM accounting_entries
    WHERE source_type = 'credit_note'
      AND source_id   = rec.id
      AND user_id     = rec.user_id;

    v_ref := 'CN-' || COALESCE(rec.credit_note_number, rec.id::TEXT);

    INSERT INTO accounting_audit_log (
      user_id, company_id, event_type, source_table, source_id,
      entry_count, total_debit, total_credit, balance_ok, details
    ) VALUES (
      rec.user_id,
      rec.company_id,
      'auto_journal',
      'credit_notes',
      rec.id,
      v_count,
      COALESCE(v_debit, 0),
      COALESCE(v_credit, 0),
      ABS(COALESCE(v_debit, 0) - COALESCE(v_credit, 0)) < 0.01,
      jsonb_build_object(
        'company_id',         rec.company_id,
        'ref',                v_ref,
        'credit_note_number', rec.credit_note_number,
        'total_ht',           rec.total_ht,
        'total_ttc',          rec.total_ttc,
        'status',             rec.status,
        'backfilled',         true
      )
    );
  END LOOP;

  RAISE NOTICE 'Credit note audit log backfill complete';
END;
$$;

-- ============================================================================
-- NOTES:
-- - Trigger covers statuses: 'issued', 'sent', 'applied' (all active statuses
--   used in CreditNotesPage.jsx; 'validated' does not exist in this codebase)
-- - company_id resolved via COALESCE(NEW.company_id, resolve_preferred_company_id())
--   following the pattern established in 20260308450000
-- - Account codes resolved via get_user_account_code() which checks
--   accounting_mappings (custom) then falls back to country defaults
--   (PCG France / PCMN Belgique / SYSCOHADA) — ENF-1 compliant
-- - Idempotency: EXISTS check before inserting prevents duplicate entries
-- - Audit: accounting_audit_log now populated WITH company_id per 20260329035000
-- - Cancel reversal: reverse_journal_entries() from 20260308450000 is reused
-- ============================================================================
