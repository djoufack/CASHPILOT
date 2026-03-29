-- ============================================================================
-- Migration: Audit Fix — Supplier Invoice Status & ENF-3 Accounting Recovery
-- Date: 2026-03-29
-- Context: Audit revealed that all demo supplier_invoices have status='draft',
--          which prevents the auto_journal_supplier_invoice trigger from firing.
--          The trigger only acts on status IN ('received', 'processed').
--          This migration:
--          1. Updates demo supplier_invoices status to 'received' (their real state)
--          2. Manually backfills accounting_entries for supplier_invoices that
--             were already paid (payment_status='paid') but missing accounting
--          3. Documents that payment_terms.company_id=NULL is intentional
--             (user-scoped, not company-scoped)
-- ============================================================================

-- ============================================================================
-- PART 1: Fix supplier_invoices status for records in 'received' states
-- Records that have payment_status IN ('paid', 'overdue', 'pending') should
-- NOT be in 'draft' status — they are clearly received invoices.
-- ============================================================================
UPDATE supplier_invoices
SET status = 'received', updated_at = NOW()
WHERE status = 'draft'
  AND payment_status IN ('paid', 'overdue', 'pending');

-- ============================================================================
-- PART 2: Backfill accounting_entries for supplier_invoices where:
--   - status is now 'received'
--   - No accounting entry exists yet
-- This is what the trigger does on INSERT/UPDATE to 'received', applied manually.
-- ============================================================================
DO $$
DECLARE
  si RECORD;
  v_enabled BOOLEAN;
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_supplier_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  FOR si IN
    SELECT *
    FROM supplier_invoices inv
    WHERE inv.status = 'received'
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'supplier_invoice'
          AND ae.source_id = inv.id
      )
  LOOP
    -- Check if auto journal is enabled for this user
    SELECT auto_journal_enabled INTO v_enabled
    FROM user_accounting_settings
    WHERE user_id = inv.user_id;

    IF v_enabled IS NOT TRUE THEN
      CONTINUE;
    END IF;

    v_ref := 'SINV-' || COALESCE(inv.invoice_number, inv.id::TEXT);
    v_amount_ht := COALESCE(inv.amount_ht, 0);
    v_tva := COALESCE(inv.tax_amount, 0);
    v_total_ttc := COALESCE(inv.total_ttc, v_amount_ht + v_tva, inv.total_amount, 0);

    -- Get account codes
    v_expense_code := get_user_account_code(inv.user_id, 'expense.general');
    v_vat_code := get_user_account_code(inv.user_id, 'vat_input');
    v_supplier_code := get_user_account_code(inv.user_id, 'supplier');

    -- Insert charge entry (debit)
    IF v_amount_ht > 0 THEN
      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code,
        debit, credit, source_type, source_id, journal,
        entry_ref, is_auto, description
      ) VALUES (
        inv.user_id, inv.company_id,
        COALESCE(inv.invoice_date, CURRENT_DATE), v_expense_code,
        v_amount_ht, 0, 'supplier_invoice', inv.id, 'AC',
        v_ref, true,
        'Facture fournisseur - ' || COALESCE(inv.invoice_number, '')
      );
    END IF;

    -- Insert TVA entry (debit)
    IF v_tva > 0 THEN
      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code,
        debit, credit, source_type, source_id, journal,
        entry_ref, is_auto, description
      ) VALUES (
        inv.user_id, inv.company_id,
        COALESCE(inv.invoice_date, CURRENT_DATE), v_vat_code,
        v_tva, 0, 'supplier_invoice', inv.id, 'AC',
        v_ref, true,
        'TVA deductible - ' || COALESCE(inv.invoice_number, '')
      );
    END IF;

    -- Insert supplier payable entry (credit)
    IF v_total_ttc > 0 THEN
      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code,
        debit, credit, source_type, source_id, journal,
        entry_ref, is_auto, description
      ) VALUES (
        inv.user_id, inv.company_id,
        COALESCE(inv.invoice_date, CURRENT_DATE), v_supplier_code,
        0, v_total_ttc, 'supplier_invoice', inv.id, 'AC',
        v_ref, true,
        'Dette fournisseur - ' || COALESCE(inv.invoice_number, '')
      );
    END IF;

    -- Log in audit
    INSERT INTO accounting_audit_log (
      user_id, company_id, event_type, source_table, source_id,
      total_debit, total_credit, balance_ok, metadata
    ) VALUES (
      inv.user_id, inv.company_id,
      'auto_journal', 'supplier_invoices', inv.id,
      v_amount_ht + v_tva, v_total_ttc,
      (v_amount_ht + v_tva) = v_total_ttc,
      jsonb_build_object('backfill', true, 'migration', '20260329040000', 'invoice_number', inv.invoice_number)
    );

  END LOOP;

  RAISE NOTICE 'Supplier invoice accounting backfill completed.';
END $$;

-- ============================================================================
-- PART 3: Backfill accounting for payment_status='paid' supplier_invoices
-- ============================================================================
DO $$
DECLARE
  inv RECORD;
  v_supplier_code TEXT;
  v_bank_code TEXT;
  v_total_ttc NUMERIC;
BEGIN
  FOR inv IN
    SELECT *
    FROM supplier_invoices
    WHERE payment_status = 'paid'
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'supplier_invoice_payment'
          AND ae.source_id = inv.id
      )
  LOOP
    v_total_ttc := COALESCE(inv.total_ttc, inv.total_amount, 0);
    IF v_total_ttc <= 0 THEN CONTINUE; END IF;

    v_supplier_code := get_user_account_code(inv.user_id, 'supplier');
    v_bank_code := get_user_account_code(inv.user_id, 'bank');

    -- Debit supplier (cancel debt)
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id, journal,
      entry_ref, is_auto, description
    ) VALUES (
      inv.user_id, inv.company_id, CURRENT_DATE, v_supplier_code,
      v_total_ttc, 0, 'supplier_invoice_payment', inv.id, 'BQ',
      'SINV-PAY-' || COALESCE(inv.invoice_number, inv.id::TEXT), true,
      'Reglement fournisseur - ' || COALESCE(inv.invoice_number, '')
    );

    -- Credit bank
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id, journal,
      entry_ref, is_auto, description
    ) VALUES (
      inv.user_id, inv.company_id, CURRENT_DATE, v_bank_code,
      0, v_total_ttc, 'supplier_invoice_payment', inv.id, 'BQ',
      'SINV-PAY-' || COALESCE(inv.invoice_number, inv.id::TEXT), true,
      'Sortie tresorerie fournisseur - ' || COALESCE(inv.invoice_number, '')
    );
  END LOOP;

  RAISE NOTICE 'Supplier invoice payment accounting backfill completed.';
END $$;

-- ============================================================================
-- PART 4: Document payment_terms ENF-2 exception
-- payment_terms.company_id is intentionally NULL for system-wide default terms.
-- These are user-scoped (via user_id) not company-scoped, which is by design
-- since payment terms are typically set at company level but can be shared.
-- TODO: If per-company isolation is required, add company_id to all payment_terms
-- and migrate the data accordingly.
-- ============================================================================
COMMENT ON TABLE payment_terms IS
  'Payment terms for invoices. company_id may be NULL for user-level default terms '
  '(shared across all companies of a user). ENF-2 exception documented: '
  'user_id provides ownership chain (user_id -> user -> auth.users).';
