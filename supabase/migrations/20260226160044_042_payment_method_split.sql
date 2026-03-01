CREATE OR REPLACE FUNCTION get_payment_account_code(
  p_user_id UUID,
  p_payment_method TEXT
) RETURNS TEXT AS $$
BEGIN
  RETURN CASE p_payment_method
    WHEN 'cash' THEN get_user_account_code(p_user_id, 'cash')
    WHEN 'check' THEN get_user_account_code(p_user_id, 'check')
    ELSE get_user_account_code(p_user_id, 'bank')
  END;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION auto_journal_payment() RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_payment_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payment' AND source_id = NEW.id
    AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  v_payment_code := get_payment_account_code(NEW.user_id, COALESCE(NEW.payment_method, 'bank_transfer'));
  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(NEW.receipt_number, NEW.id::TEXT);

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_payment_code, COALESCE(NEW.amount, 0), 0, 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement recu (' || COALESCE(NEW.payment_method, 'bank_transfer') || ') - ' || COALESCE(NEW.reference, ''));

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(NEW.amount, 0), 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement client - ' || COALESCE(NEW.reference, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_journal_invoice() RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_client_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
  v_has_items BOOLEAN;
  rec RECORD;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

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
          FROM invoice_items
          WHERE invoice_id = NEW.id
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
$$ LANGUAGE plpgsql;;
