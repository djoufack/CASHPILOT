-- Migration: Fix auto_journal triggers to pass company_id explicitly + fill trigger gaps
-- Date: 2026-03-08
--
-- Part 1: All auto_journal functions now INSERT company_id into accounting_entries
-- Part 2: Missing triggers: payments UPDATE, supplier_invoices DELETE, products INSERT+DELETE
-- Part 3: Fix reverse_journal_entries to also propagate company_id

------------------------------------------------------------------------
-- PART 0: Fix reverse_journal_entries to propagate company_id
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_journal_entries(
  p_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_ref_prefix text DEFAULT 'ANN'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code,
    debit, credit,
    source_type, source_id, journal, entry_ref,
    is_auto, description
  )
  SELECT
    p_user_id,
    company_id,  -- propagate company_id from original entries
    CURRENT_DATE,
    account_code,
    credit AS debit,   -- swap debit/credit for reversal
    debit AS credit,
    p_source_type || '_reversal',
    p_source_id,
    'OD',
    p_ref_prefix || '-' || entry_ref,
    true,
    'Annulation: ' || COALESCE(description, '')
  FROM accounting_entries
  WHERE source_type = p_source_type
    AND source_id = p_source_id
    AND user_id = p_user_id;
END;
$$;

------------------------------------------------------------------------
-- PART 1A: auto_journal_payable — already has v_company_id, add to INSERTs
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_payable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_expense_code TEXT;
  v_supplier_code TEXT;
  v_ref TEXT;
  v_amount NUMERIC;
  v_transaction_date DATE;
  v_company_id UUID;
  v_country TEXT;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payable' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.amount IS DISTINCT FROM NEW.amount
         OR OLD.creditor_name IS DISTINCT FROM NEW.creditor_name
         OR OLD.status IS DISTINCT FROM NEW.status THEN
        DELETE FROM accounting_entries
        WHERE source_type = 'payable' AND source_id = NEW.id
          AND user_id = NEW.user_id AND is_auto = true;
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount = 0 THEN RETURN NEW; END IF;

  v_transaction_date := COALESCE(NEW.date_borrowed, CURRENT_DATE);
  v_ref := 'PAY-' || NEW.id;

  v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');

  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  v_expense_code := CASE COALESCE(v_country, 'OHADA')
    WHEN 'FR' THEN '658'
    WHEN 'OHADA' THEN '658'
    ELSE '658'
  END;

  -- Resolve company_id
  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));

  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_expense_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_supplier_code);

  -- DEBIT: 658 Charges diverses
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, v_transaction_date, v_expense_code, v_amount, 0,
    'payable', NEW.id, 'OD', v_ref, true,
    'Charge diverse - ' || COALESCE(NEW.creditor_name, '') || ' ' || COALESCE(NEW.description, '')
  );

  -- CREDIT: 401 Fournisseurs
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, v_transaction_date, v_supplier_code, 0, v_amount,
    'payable', NEW.id, 'OD', v_ref, true,
    'Fournisseur - Dette ' || COALESCE(NEW.creditor_name, '')
  );

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'payables', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id,
      'expense_code', v_expense_code,
      'supplier_code', v_supplier_code,
      'creditor', NEW.creditor_name,
      'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- PART 1B: auto_journal_receivable — already has v_company_id, add to INSERTs
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_receivable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_ref TEXT;
  v_amount NUMERIC;
  v_transaction_date DATE;
  v_company_id UUID;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'receivable' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    IF TG_OP = 'UPDATE' THEN
      IF OLD.amount IS DISTINCT FROM NEW.amount
         OR OLD.debtor_name IS DISTINCT FROM NEW.debtor_name
         OR OLD.status IS DISTINCT FROM NEW.status THEN
        DELETE FROM accounting_entries
        WHERE source_type = 'receivable' AND source_id = NEW.id
          AND user_id = NEW.user_id AND is_auto = true;
      ELSE
        RETURN NEW;
      END IF;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount = 0 THEN RETURN NEW; END IF;

  v_transaction_date := COALESCE(NEW.date_lent, CURRENT_DATE);
  v_ref := 'REC-' || NEW.id;

  v_client_code := get_user_account_code(NEW.user_id, 'client');

  DECLARE
    v_country TEXT;
  BEGIN
    SELECT country INTO v_country
    FROM user_accounting_settings
    WHERE user_id = NEW.user_id;

    v_revenue_code := CASE COALESCE(v_country, 'OHADA')
      WHEN 'FR' THEN '758'
      WHEN 'OHADA' THEN '758'
      ELSE '758'
    END;
  END;

  -- Resolve company_id
  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));

  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_revenue_code);

  -- DEBIT: 411 Client
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, v_transaction_date, v_client_code, v_amount, 0,
    'receivable', NEW.id, 'OD', v_ref, true,
    'Creance client - ' || COALESCE(NEW.debtor_name, '') || ' ' || COALESCE(NEW.description, '')
  );

  -- CREDIT: 758 Produits divers
  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, v_transaction_date, v_revenue_code, 0, v_amount,
    'receivable', NEW.id, 'OD', v_ref, true,
    'Produit divers - Creance ' || COALESCE(NEW.debtor_name, '')
  );

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'receivables', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id,
      'client_code', v_client_code,
      'revenue_code', v_revenue_code,
      'debtor', NEW.debtor_name,
      'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- PART 1C: auto_journal_payment — add company_id + UPDATE handling
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_debit_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
  v_company_id UUID;
  v_amount NUMERIC;
BEGIN
  -- On UPDATE: if amount changed, delete old entries and re-journal
  IF TG_OP = 'UPDATE' THEN
    IF OLD.amount IS DISTINCT FROM NEW.amount
       OR OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN
      DELETE FROM accounting_entries
      WHERE source_type = 'payment' AND source_id = NEW.id
        AND user_id = NEW.user_id AND is_auto = true;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  -- Idempotency for INSERT
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'payment' AND source_id = NEW.id AND user_id = NEW.user_id
    ) THEN RETURN NEW; END IF;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  IF v_amount = 0 THEN RETURN NEW; END IF;

  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));

  v_debit_code := CASE COALESCE(NEW.payment_method, 'bank_transfer')
    WHEN 'cash' THEN get_user_account_code(NEW.user_id, 'cash')
    WHEN 'check' THEN get_user_account_code(NEW.user_id, 'check')
    ELSE get_user_account_code(NEW.user_id, 'bank')
  END;

  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(NEW.receipt_number, LEFT(NEW.id::TEXT, 8));

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, COALESCE(NEW.payment_date, CURRENT_DATE),
    v_debit_code, v_amount, 0,
    'payment', NEW.id, 'BQ', v_ref, true,
    'Encaissement ' || COALESCE(NEW.payment_method, 'virement') || ' - ' || COALESCE(NEW.reference, '')
  );

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, COALESCE(NEW.payment_date, CURRENT_DATE),
    v_client_code, 0, v_amount,
    'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement client - ' || COALESCE(NEW.reference, '')
  );

  RETURN NEW;
END;
$$;

-- Add UPDATE trigger for payments (was missing)
DROP TRIGGER IF EXISTS trg_auto_journal_payment_on_update ON payments;
CREATE TRIGGER trg_auto_journal_payment_on_update
AFTER UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION auto_journal_payment();

------------------------------------------------------------------------
-- PART 1D: auto_journal_expense — add company_id
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_expense()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
  v_company_id UUID;
BEGIN
  -- Idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'expense' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));

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

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id,
    COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE),
    v_expense_code, v_amount_ht, 0,
    'expense', NEW.id, 'AC', v_ref, true,
    'Depense ' || COALESCE(NEW.category, 'divers') || ': ' || COALESCE(NEW.description, '')
  );

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id,
      COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE),
      v_vat_code, v_tva, 0,
      'expense', NEW.id, 'AC', v_ref, true,
      'TVA deductible - ' || COALESCE(NEW.description, '')
    );
  END IF;

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id,
    COALESCE(NEW.expense_date, NEW.created_at::date, CURRENT_DATE),
    v_bank_code, 0, v_amount_ttc,
    'expense', NEW.id, 'AC', v_ref, true,
    'Reglement depense - ' || COALESCE(NEW.description, '')
  );

  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- PART 1E: auto_journal_invoice — add company_id
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
  v_has_items BOOLEAN;
  v_company_id UUID;
  rec RECORD;
BEGIN
  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));

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

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
        v_client_code, COALESCE(NEW.total_ttc, 0), 0,
        'invoice', NEW.id, 'VE', v_ref, true,
        'Facture ' || COALESCE(NEW.invoice_number, '')
      );

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
            INSERT INTO accounting_entries (
              user_id, company_id, transaction_date, account_code, debit, credit,
              source_type, source_id, journal, entry_ref, is_auto, description
            ) VALUES (
              NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
              get_user_account_code(NEW.user_id, rec.revenue_key), 0, rec.line_total,
              'invoice', NEW.id, 'VE', v_ref, true,
              rec.desc_prefix || ' - ' || COALESCE(NEW.invoice_number, '')
            );
          END IF;
        END LOOP;
      ELSE
        IF COALESCE(NEW.total_ht, 0) > 0 THEN
          INSERT INTO accounting_entries (
            user_id, company_id, transaction_date, account_code, debit, credit,
            source_type, source_id, journal, entry_ref, is_auto, description
          ) VALUES (
            NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
            get_user_account_code(NEW.user_id, 'revenue'), 0, COALESCE(NEW.total_ht, 0),
            'invoice', NEW.id, 'VE', v_ref, true,
            'Vente HT - ' || COALESCE(NEW.invoice_number, '')
          );
        END IF;
      END IF;

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (
          user_id, company_id, transaction_date, account_code, debit, credit,
          source_type, source_id, journal, entry_ref, is_auto, description
        ) VALUES (
          NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
          v_vat_code, 0, v_tva,
          'invoice', NEW.id, 'VE', v_ref, true,
          'TVA collectee - ' || COALESCE(NEW.invoice_number, '')
        );
      END IF;
    END IF;
  END IF;

  -- Payment handling
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

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, CURRENT_DATE,
        v_bank_code, COALESCE(NEW.total_ttc, 0), 0,
        'invoice_payment', NEW.id, 'BQ', v_ref, true,
        'Encaissement facture ' || COALESCE(NEW.invoice_number, '')
      );

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, CURRENT_DATE,
        v_client_code, 0, COALESCE(NEW.total_ttc, 0),
        'invoice_payment', NEW.id, 'BQ', v_ref, true,
        'Encaissement client - ' || COALESCE(NEW.invoice_number, '')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- PART 1F: auto_journal_credit_note — add company_id
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_credit_note()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_code TEXT;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
  v_company_id UUID;
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

  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));

  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_revenue_code := get_user_account_code(NEW.user_id, 'revenue');
  v_vat_code := get_user_account_code(NEW.user_id, 'vat_output');
  v_ref := 'CN-' || COALESCE(NEW.credit_note_number, NEW.id::TEXT);
  v_amount_ht := COALESCE(NEW.total_ht, 0);
  v_tva := COALESCE(NEW.total_ttc, 0) - v_amount_ht;
  v_total_ttc := COALESCE(NEW.total_ttc, 0);

  IF v_total_ttc = 0 THEN RETURN NEW; END IF;

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
    v_revenue_code, v_amount_ht, 0,
    'credit_note', NEW.id, 'VE', v_ref, true,
    'Avoir client - ' || COALESCE(NEW.credit_note_number, '')
  );

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
      v_vat_code, v_tva, 0,
      'credit_note', NEW.id, 'VE', v_ref, true,
      'TVA sur avoir - ' || COALESCE(NEW.credit_note_number, '')
    );
  END IF;

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    NEW.user_id, v_company_id, COALESCE(NEW.date, CURRENT_DATE),
    v_client_code, 0, v_total_ttc,
    'credit_note', NEW.id, 'VE', v_ref, true,
    'Reduction creance client - ' || COALESCE(NEW.credit_note_number, '')
  );

  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- PART 1G: auto_journal_supplier_invoice — add company_id
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_supplier_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_supplier_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_user_id UUID;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
  v_company_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.user_id, (SELECT user_id FROM suppliers WHERE id = NEW.supplier_id));
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(v_user_id));

  v_ref := 'SINV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
  v_amount_ht := COALESCE(NEW.total_ht, 0);
  v_tva := COALESCE(NEW.vat_amount, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, v_amount_ht + v_tva);

  -- Journal on status change to received/processed
  IF (TG_OP = 'INSERT' AND COALESCE(NEW.status, '') IN ('received', 'processed'))
     OR (TG_OP = 'UPDATE' AND COALESCE(OLD.status, 'draft') IN ('draft', 'pending') AND NEW.status IN ('received', 'processed')) THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice' AND source_id = NEW.id AND journal = 'AC'
      AND user_id = v_user_id
    ) THEN
      v_expense_code := get_user_account_code(v_user_id, 'expense.general');
      v_vat_code := get_user_account_code(v_user_id, 'vat_input');
      v_supplier_code := get_user_account_code(v_user_id, 'supplier');

      IF v_amount_ht > 0 THEN
        INSERT INTO accounting_entries (
          user_id, company_id, transaction_date, account_code, debit, credit,
          source_type, source_id, journal, entry_ref, is_auto, description
        ) VALUES (
          v_user_id, v_company_id, COALESCE(NEW.invoice_date, CURRENT_DATE),
          v_expense_code, v_amount_ht, 0,
          'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Facture fournisseur - ' || COALESCE(NEW.invoice_number, '')
        );
      END IF;

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (
          user_id, company_id, transaction_date, account_code, debit, credit,
          source_type, source_id, journal, entry_ref, is_auto, description
        ) VALUES (
          v_user_id, v_company_id, COALESCE(NEW.invoice_date, CURRENT_DATE),
          v_vat_code, v_tva, 0,
          'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'TVA deductible - SINV ' || COALESCE(NEW.invoice_number, '')
        );
      END IF;

      IF v_total_ttc > 0 THEN
        INSERT INTO accounting_entries (
          user_id, company_id, transaction_date, account_code, debit, credit,
          source_type, source_id, journal, entry_ref, is_auto, description
        ) VALUES (
          v_user_id, v_company_id, COALESCE(NEW.invoice_date, CURRENT_DATE),
          v_supplier_code, 0, v_total_ttc,
          'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Dette fournisseur - ' || COALESCE(NEW.invoice_number, '')
        );
      END IF;
    END IF;
  END IF;

  -- Payment handling
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

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        v_user_id, v_company_id, CURRENT_DATE,
        v_supplier_code, v_total_ttc, 0,
        'supplier_invoice_payment', NEW.id, 'BQ',
        'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Reglement fournisseur - ' || COALESCE(NEW.invoice_number, '')
      );

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        v_user_id, v_company_id, CURRENT_DATE,
        v_bank_code, 0, v_total_ttc,
        'supplier_invoice_payment', NEW.id, 'BQ',
        'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Paiement fournisseur - ' || COALESCE(NEW.invoice_number, '')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- PART 1H: auto_journal_bank_transaction — add company_id to all INSERTs
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_bank_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_bank_code TEXT;
  v_client_code TEXT;
  v_supplier_code TEXT;
  v_expense_code TEXT;
  v_ref TEXT;
  v_amount NUMERIC;
  v_abs_amount NUMERIC;
  v_transaction_date DATE;
  v_description TEXT;
  v_matched_source_type TEXT;
  v_matched_source_id UUID;
  v_company_id UUID;
BEGIN
  IF NOT (
    (TG_OP = 'UPDATE'
      AND OLD.reconciliation_status IS DISTINCT FROM NEW.reconciliation_status
      AND NEW.reconciliation_status = 'matched')
  ) THEN
    RETURN NEW;
  END IF;

  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'bank_transaction' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.amount, 0);
  v_abs_amount := ABS(v_amount);
  v_transaction_date := COALESCE(NEW.booking_date, NEW.date, CURRENT_DATE);
  v_ref := 'BK-' || NEW.id;

  IF v_abs_amount = 0 THEN RETURN NEW; END IF;

  v_bank_code := get_user_account_code(NEW.user_id, 'bank');

  -- Resolve company_id: from bank_connection first, then from row, then fallback
  SELECT bc.company_id INTO v_company_id
  FROM bank_connections bc
  WHERE bc.id = NEW.bank_connection_id;

  v_company_id := COALESCE(v_company_id, NEW.company_id, resolve_preferred_company_id(NEW.user_id));

  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_bank_code);

  -- Determine match
  IF NEW.invoice_id IS NOT NULL THEN
    v_matched_source_type := 'invoice';
    v_matched_source_id := NEW.invoice_id;
  ELSE
    SELECT bsl.matched_source_type, bsl.matched_source_id
    INTO v_matched_source_type, v_matched_source_id
    FROM bank_statement_lines bsl
    WHERE bsl.user_id = NEW.user_id
      AND bsl.matched_source_id IS NOT NULL
      AND ABS(bsl.amount - v_amount) < 0.01
      AND bsl.reconciliation_status = 'matched'
    ORDER BY bsl.matched_at DESC
    LIMIT 1;
  END IF;

  IF v_matched_source_type = 'invoice' THEN
    v_client_code := get_user_account_code(NEW.user_id, 'client');
    PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);
    v_description := 'Rapprochement bancaire - Encaissement client';

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, v_transaction_date, v_bank_code, v_abs_amount, 0,
      'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
    );

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, v_transaction_date, v_client_code, 0, v_abs_amount,
      'bank_transaction', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Solde creance client'
    );

  ELSIF v_matched_source_type = 'supplier_invoice' THEN
    v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');
    PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_supplier_code);
    v_description := 'Rapprochement bancaire - Paiement fournisseur';

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, v_transaction_date, v_supplier_code, v_abs_amount, 0,
      'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
    );

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, v_transaction_date, v_bank_code, 0, v_abs_amount,
      'bank_transaction', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Decaissement fournisseur'
    );

  ELSIF v_matched_source_type = 'expense' THEN
    DECLARE
      v_expense_category TEXT;
    BEGIN
      SELECT e.category INTO v_expense_category
      FROM expenses e
      WHERE e.id = v_matched_source_id AND e.user_id = NEW.user_id;

      v_expense_code := get_user_account_code(NEW.user_id, 'expense.' || COALESCE(v_expense_category, 'general'));
    END;

    PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_expense_code);
    v_description := 'Rapprochement bancaire - Charge rapprochee';

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, v_transaction_date, v_expense_code, v_abs_amount, 0,
      'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
    );

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, v_transaction_date, v_bank_code, 0, v_abs_amount,
      'bank_transaction', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Decaissement charge'
    );

  ELSE
    IF v_amount > 0 THEN
      v_description := 'Rapprochement bancaire - Encaissement divers';

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, v_transaction_date, v_bank_code, v_abs_amount, 0,
        'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
      );

      v_client_code := get_user_account_code(NEW.user_id, 'client');
      PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, v_transaction_date, v_client_code, 0, v_abs_amount,
        'bank_transaction', NEW.id, 'BQ', v_ref, true,
        'Rapprochement bancaire - Solde creance'
      );
    ELSE
      v_description := 'Rapprochement bancaire - Decaissement divers';

      v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');
      PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_supplier_code);

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, v_transaction_date, v_supplier_code, v_abs_amount, 0,
        'bank_transaction', NEW.id, 'BQ', v_ref, true, v_description
      );

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, v_transaction_date, v_bank_code, 0, v_abs_amount,
        'bank_transaction', NEW.id, 'BQ', v_ref, true,
        'Rapprochement bancaire - Sortie banque'
      );
    END IF;
  END IF;

  -- AUDIT LOG
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'bank_transactions', NEW.id,
    2, v_abs_amount, v_abs_amount, true,
    jsonb_build_object(
      'company_id', v_company_id,
      'bank_code', v_bank_code,
      'matched_source_type', v_matched_source_type,
      'matched_source_id', v_matched_source_id,
      'amount', v_amount,
      'reconciliation_status', NEW.reconciliation_status
    )
  );

  RETURN NEW;
END;
$$;

------------------------------------------------------------------------
-- PART 1I: auto_journal_stock_movement — add company_id
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.auto_journal_stock_movement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_qty_change NUMERIC;
  v_unit_cost NUMERIC;
  v_amount NUMERIC;
  v_stock_code TEXT;
  v_variation_code TEXT;
  v_ref TEXT;
  v_country TEXT;
  v_company_id UUID;
BEGIN
  -- Handle INSERT: treat as stock increase from 0
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.stock_quantity, 0) = 0 THEN
      RETURN NEW;
    END IF;
  ELSE
    -- UPDATE: only fire if stock_quantity changed
    IF OLD.stock_quantity IS NOT DISTINCT FROM NEW.stock_quantity THEN
      RETURN NEW;
    END IF;
  END IF;

  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_unit_cost := COALESCE(NEW.purchase_price, NEW.unit_price, 0);
  IF v_unit_cost = 0 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_qty_change := COALESCE(NEW.stock_quantity, 0);
  ELSE
    v_qty_change := NEW.stock_quantity - OLD.stock_quantity;
  END IF;

  v_amount := ABS(v_qty_change) * v_unit_cost;
  IF v_amount = 0 THEN
    RETURN NEW;
  END IF;

  v_ref := 'STK-' || NEW.id;

  -- Idempotency for INSERT
  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE entry_ref = v_ref AND user_id = NEW.user_id
        AND source_type = 'stock_movement'
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- For UPDATE, check idempotency with date
  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE entry_ref = v_ref AND user_id = NEW.user_id
        AND source_type = 'stock_movement'
        AND transaction_date = CURRENT_DATE
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  v_company_id := COALESCE(NEW.company_id, resolve_preferred_company_id(NEW.user_id));

  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  v_country := COALESCE(v_country, 'OHADA');
  v_stock_code := '31';
  v_variation_code := '603';

  IF v_qty_change > 0 THEN
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, CURRENT_DATE, v_stock_code, v_amount, 0,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Entree stock: ' || COALESCE(NEW.product_name, '') || ' (+' || v_qty_change || ')'
    );

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, CURRENT_DATE, v_variation_code, 0, v_amount,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Variation stock: ' || COALESCE(NEW.product_name, '') || ' (+' || v_qty_change || ')'
    );
  ELSE
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, CURRENT_DATE, v_variation_code, v_amount, 0,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Variation stock: ' || COALESCE(NEW.product_name, '') || ' (' || v_qty_change || ')'
    );

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, v_company_id, CURRENT_DATE, v_stock_code, 0, v_amount,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Sortie stock: ' || COALESCE(NEW.product_name, '') || ' (' || v_qty_change || ')'
    );
  END IF;

  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'products', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id,
      'product', NEW.product_name,
      'old_qty', CASE WHEN TG_OP = 'INSERT' THEN 0 ELSE OLD.stock_quantity END,
      'new_qty', NEW.stock_quantity,
      'unit_cost', v_unit_cost,
      'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;

-- Replace the products trigger to also fire on INSERT
DROP TRIGGER IF EXISTS trg_auto_journal_stock_movement ON products;
CREATE TRIGGER trg_auto_journal_stock_movement
AFTER INSERT OR UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION auto_journal_stock_movement();

------------------------------------------------------------------------
-- PART 2A: supplier_invoices DELETE trigger (function exists, trigger missing)
------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_reverse_journal_supplier_invoice_on_delete ON supplier_invoices;
CREATE TRIGGER trg_reverse_journal_supplier_invoice_on_delete
BEFORE DELETE ON supplier_invoices
FOR EACH ROW EXECUTE FUNCTION reverse_journal_supplier_invoice();

------------------------------------------------------------------------
-- PART 2B: products DELETE reverse trigger
------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.reverse_journal_stock_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM accounting_entries
  WHERE source_type = 'stock_movement' AND source_id = OLD.id AND is_auto = true;

  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    OLD.user_id, 'reversal', 'products', OLD.id,
    0, 0, 0, true,
    jsonb_build_object(
      'reason', 'product deleted',
      'product_name', OLD.product_name,
      'stock_quantity', OLD.stock_quantity
    )
  );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_reverse_journal_stock_on_delete ON products;
CREATE TRIGGER trg_reverse_journal_stock_on_delete
BEFORE DELETE ON products
FOR EACH ROW EXECUTE FUNCTION reverse_journal_stock_on_delete();
