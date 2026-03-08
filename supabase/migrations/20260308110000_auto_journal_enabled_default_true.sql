-- =====================================================================
-- FIX: auto_journal_enabled MUST be TRUE by default for ALL users
-- This is a non-negotiable requirement: every CRUD operation must
-- generate accounting entries in real-time.
-- =====================================================================

-- 1. Set default to TRUE for new rows
ALTER TABLE user_accounting_settings
  ALTER COLUMN auto_journal_enabled SET DEFAULT true;

-- 2. Enable for ALL existing users who have it NULL or FALSE
UPDATE user_accounting_settings
SET auto_journal_enabled = true
WHERE auto_journal_enabled IS NOT TRUE;

-- 3. Ensure every authenticated user has accounting settings
-- (insert for users who don't have settings yet)
INSERT INTO user_accounting_settings (user_id, auto_journal_enabled)
SELECT u.id, true
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM user_accounting_settings uas WHERE uas.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- 4. RE-RUN BACKFILL now that auto_journal_enabled is TRUE for everyone
-- This ensures all existing data gets journalized.

-- 4a. Backfill invoices
DO $$
DECLARE
  rec RECORD;
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
  END LOOP;
  RAISE NOTICE 'Invoice backfill complete (forced)';
END;
$$;

-- 4b. Backfill expenses
DO $$
DECLARE
  rec RECORD;
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
  END LOOP;
  RAISE NOTICE 'Expense backfill complete (forced)';
END;
$$;

-- 4c. Backfill payments
DO $$
DECLARE
  rec RECORD;
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
  END LOOP;
  RAISE NOTICE 'Payment backfill complete (forced)';
END;
$$;

-- 4d. Backfill credit notes
DO $$
DECLARE
  rec RECORD;
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
  END LOOP;
  RAISE NOTICE 'Credit note backfill complete (forced)';
END;
$$;

-- 5. Also update the trigger functions to NEVER check auto_journal_enabled
-- The requirement is NON-NEGOTIABLE: all CRUD = accounting entries always.

-- 5a. Invoice trigger: remove auto_journal_enabled check
CREATE OR REPLACE FUNCTION auto_journal_invoice() RETURNS TRIGGER AS $$
DECLARE
  v_client_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
  v_has_items BOOLEAN;
  rec RECORD;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status IS NOT NULL AND NEW.status != 'draft')
     OR (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status != 'draft') THEN

    IF EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'invoice' AND source_id = NEW.id AND journal = 'VE'
      AND user_id = NEW.user_id
    ) THEN
      NULL;
    ELSE
      v_client_code := get_user_account_code(NEW.user_id, 'client');
      v_vat_code := get_user_account_code(NEW.user_id, 'vat_output');
      v_ref := 'INV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
      v_tva := COALESCE(NEW.total_ttc, 0) - COALESCE(NEW.total_ht, 0);

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, COALESCE(NEW.total_ttc, 0), 0, 'invoice', NEW.id, 'VE', v_ref, true, 'Facture ' || COALESCE(NEW.invoice_number, ''));

      SELECT EXISTS(SELECT 1 FROM invoice_items WHERE invoice_id = NEW.id) INTO v_has_items;

      IF v_has_items THEN
        FOR rec IN
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
          FROM invoice_items WHERE invoice_id = NEW.id
          GROUP BY 1, 2
        LOOP
          IF rec.line_total > 0 THEN
            INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
            VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), get_user_account_code(NEW.user_id, rec.revenue_key), 0, rec.line_total, 'invoice', NEW.id, 'VE', v_ref, true, rec.desc_prefix || ' - ' || COALESCE(NEW.invoice_number, ''));
          END IF;
        END LOOP;
      ELSE
        IF COALESCE(NEW.total_ht, 0) > 0 THEN
          INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
          VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), get_user_account_code(NEW.user_id, 'revenue'), 0, COALESCE(NEW.total_ht, 0), 'invoice', NEW.id, 'VE', v_ref, true, 'Vente HT - ' || COALESCE(NEW.invoice_number, ''));
        END IF;
      END IF;

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, 0, v_tva, 'invoice', NEW.id, 'VE', v_ref, true, 'TVA collectee - ' || COALESCE(NEW.invoice_number, ''));
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'invoice_payment' AND source_id = NEW.id AND journal = 'BQ'
      AND user_id = NEW.user_id
    ) THEN
      SELECT COALESCE(p.payment_method, 'bank_transfer') INTO v_bank_code
      FROM payments p WHERE p.invoice_id = NEW.id
      ORDER BY p.created_at DESC LIMIT 1;

      v_bank_code := get_payment_account_code(NEW.user_id, COALESCE(v_bank_code, 'bank_transfer'));
      v_client_code := get_user_account_code(NEW.user_id, 'client');
      v_ref := 'PAY-INV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, CURRENT_DATE, v_bank_code, COALESCE(NEW.total_ttc, 0), 0, 'invoice_payment', NEW.id, 'BQ', v_ref, true, 'Encaissement facture ' || COALESCE(NEW.invoice_number, ''));

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, CURRENT_DATE, v_client_code, 0, COALESCE(NEW.total_ttc, 0), 'invoice_payment', NEW.id, 'BQ', v_ref, true, 'Encaissement client - ' || COALESCE(NEW.invoice_number, ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5b. Expense trigger: remove auto_journal_enabled check
CREATE OR REPLACE FUNCTION auto_journal_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
BEGIN
  -- Idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'expense' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_expense_code := get_user_account_code(NEW.user_id, 'expense.' || COALESCE(NEW.category, 'general'));
  v_vat_code := get_user_account_code(NEW.user_id, 'vat_input');
  v_bank_code := get_user_account_code(NEW.user_id, 'bank');
  v_ref := 'EXP-' || LEFT(NEW.id::TEXT, 8);

  v_amount_ht := COALESCE(NEW.amount_ht, NEW.amount, 0);
  v_tva := COALESCE(NEW.tax_amount, 0);
  v_amount_ttc := CASE WHEN v_tva > 0 THEN v_amount_ht + v_tva ELSE COALESCE(NEW.amount, v_amount_ht) END;

  IF v_amount_ttc = 0 AND v_amount_ht = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'expense', NEW.id, 'AC', v_ref, true,
    'Depense ' || COALESCE(NEW.category, 'divers') || ': ' || COALESCE(NEW.description, ''));

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE), v_vat_code, v_tva, 0, 'expense', NEW.id, 'AC', v_ref, true,
      'TVA deductible - ' || COALESCE(NEW.description, ''));
  END IF;

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE), v_bank_code, 0, v_amount_ttc, 'expense', NEW.id, 'AC', v_ref, true,
    'Reglement depense - ' || COALESCE(NEW.description, ''));

  RETURN NEW;
END;
$$;

-- 5c. Payment trigger: remove auto_journal_enabled check
CREATE OR REPLACE FUNCTION auto_journal_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_debit_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payment' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN RETURN NEW; END IF;

  v_debit_code := CASE COALESCE(NEW.payment_method, 'bank_transfer')
    WHEN 'cash' THEN get_user_account_code(NEW.user_id, 'cash')
    WHEN 'check' THEN get_user_account_code(NEW.user_id, 'check')
    ELSE get_user_account_code(NEW.user_id, 'bank')
  END;

  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(NEW.receipt_number, LEFT(NEW.id::TEXT, 8));

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_debit_code, COALESCE(NEW.amount, 0), 0, 'payment', NEW.id, 'BQ', v_ref, true,
    'Encaissement ' || COALESCE(NEW.payment_method, 'virement') || ' - ' || COALESCE(NEW.reference, ''));

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(NEW.amount, 0), 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement client - ' || COALESCE(NEW.reference, ''));

  RETURN NEW;
END;
$$;

-- 5d. Supplier invoice trigger: remove auto_journal_enabled check
CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice() RETURNS TRIGGER AS $$
DECLARE
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_supplier_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  v_ref := 'SINV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
  v_amount_ht := COALESCE(NEW.amount_ht, 0);
  v_tva := COALESCE(NEW.tax_amount, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, v_amount_ht + v_tva);

  IF (TG_OP = 'INSERT' AND NEW.status IN ('received', 'processed'))
     OR (TG_OP = 'UPDATE' AND OLD.status IN ('draft') AND NEW.status IN ('received', 'processed')) THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice' AND source_id = NEW.id AND journal = 'AC'
      AND user_id = NEW.user_id
    ) THEN
      v_expense_code := get_user_account_code(NEW.user_id, 'expense.general');
      v_vat_code := get_user_account_code(NEW.user_id, 'vat_input');
      v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');

      IF v_amount_ht > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Facture fournisseur - ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'TVA deductible - SINV ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      IF v_total_ttc > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_total_ttc, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Dette fournisseur - ' || COALESCE(NEW.invoice_number, ''));
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice_payment' AND source_id = NEW.id AND journal = 'BQ'
      AND user_id = NEW.user_id
    ) THEN
      v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');
      v_bank_code := get_user_account_code(NEW.user_id, 'bank');

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, CURRENT_DATE, v_supplier_code, v_total_ttc, 0, 'supplier_invoice_payment', NEW.id, 'BQ', 'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Reglement fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, CURRENT_DATE, v_bank_code, 0, v_total_ttc, 'supplier_invoice_payment', NEW.id, 'BQ', 'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Paiement fournisseur - ' || COALESCE(NEW.invoice_number, ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5e. Credit note trigger: remove auto_journal_enabled check
CREATE OR REPLACE FUNCTION auto_journal_credit_note()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status IN ('issued', 'sent', 'applied'))
    OR (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status IN ('issued', 'sent', 'applied'))
  ) THEN
    RETURN NEW;
  END IF;

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

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_revenue_code, v_amount_ht, 0, 'credit_note', NEW.id, 'VE', v_ref, true,
    'Avoir client - ' || COALESCE(NEW.credit_note_number, ''));

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, v_tva, 0, 'credit_note', NEW.id, 'VE', v_ref, true,
      'TVA sur avoir - ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, 0, v_total_ttc, 'credit_note', NEW.id, 'VE', v_ref, true,
    'Reduction creance client - ' || COALESCE(NEW.credit_note_number, ''));

  RETURN NEW;
END;
$$;
