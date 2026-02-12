-- ============================================================
-- Migration 035: Accounting Revenue Split by Item Type
-- Replaces auto_journal_invoice() to split revenue credits
-- by invoice item type (product vs service vs manual).
-- ============================================================

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
  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- === SALE ENTRY: When invoice is sent (not draft) ===
  IF (TG_OP = 'INSERT' AND NEW.status IS NOT NULL AND NEW.status != 'draft')
     OR (TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status != 'draft') THEN

    -- Check idempotency
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

      -- Debit: Client (TTC) - unchanged
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, COALESCE(NEW.total_ttc, 0), 0, 'invoice', NEW.id, 'VE', v_ref, true, 'Facture ' || COALESCE(NEW.invoice_number, ''));

      -- Credit: Revenue - NOW SPLIT BY ITEM TYPE
      -- Check if this invoice has items
      SELECT EXISTS(
        SELECT 1 FROM invoice_items WHERE invoice_id = NEW.id
      ) INTO v_has_items;

      IF v_has_items THEN
        -- Loop over item types and credit appropriate revenue accounts
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
          GROUP BY
            CASE
              WHEN item_type = 'product' THEN 'revenue.product'
              WHEN item_type IN ('service', 'timesheet') THEN 'revenue.service'
              ELSE 'revenue'
            END,
            CASE
              WHEN item_type = 'product' THEN 'Vente produits'
              WHEN item_type IN ('service', 'timesheet') THEN 'Vente services'
              ELSE 'Vente HT'
            END
        LOOP
          IF rec.line_total > 0 THEN
            INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
            VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), get_user_account_code(NEW.user_id, rec.revenue_key), 0, rec.line_total, 'invoice', NEW.id, 'VE', v_ref, true, rec.desc_prefix || ' - ' || COALESCE(NEW.invoice_number, ''));
          END IF;
        END LOOP;
      ELSE
        -- Fallback: no items (legacy invoices), use generic revenue
        IF COALESCE(NEW.total_ht, 0) > 0 THEN
          INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
          VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), get_user_account_code(NEW.user_id, 'revenue'), 0, COALESCE(NEW.total_ht, 0), 'invoice', NEW.id, 'VE', v_ref, true, 'Vente HT - ' || COALESCE(NEW.invoice_number, ''));
        END IF;
      END IF;

      -- Credit: VAT output (unchanged)
      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, 0, v_tva, 'invoice', NEW.id, 'VE', v_ref, true, 'TVA collectée - ' || COALESCE(NEW.invoice_number, ''));
      END IF;
    END IF;
  END IF;

  -- === PAYMENT ENTRY: When invoice becomes fully paid (unchanged) ===
  IF TG_OP = 'UPDATE'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'invoice_payment' AND source_id = NEW.id AND journal = 'BQ'
      AND user_id = NEW.user_id
    ) THEN
      v_bank_code := get_user_account_code(NEW.user_id, 'bank');
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
$$ LANGUAGE plpgsql;
