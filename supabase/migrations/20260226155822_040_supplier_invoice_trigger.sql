-- ============================================================================
-- Migration 040: Auto-Journal for Supplier Invoices
-- ============================================================================

-- A. Auto-journal function for supplier_invoices
CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice() RETURNS TRIGGER AS $$
DECLARE
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
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_journal_supplier_invoice ON supplier_invoices;
CREATE TRIGGER trg_auto_journal_supplier_invoice
  AFTER INSERT OR UPDATE ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_supplier_invoice();

CREATE OR REPLACE FUNCTION reverse_journal_supplier_invoice() RETURNS TRIGGER AS $$
DECLARE
  v_auto_enabled BOOLEAN;
BEGIN
  SELECT auto_journal_enabled INTO v_auto_enabled
  FROM user_accounting_settings
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);

  IF v_auto_enabled IS NOT TRUE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, description, is_auto)
    SELECT OLD.user_id, CURRENT_DATE, account_code, credit AS debit, debit AS credit,
      'supplier_invoice_reversal', OLD.id, 'OD', 'ANN-SINV-' || OLD.id,
      'Annulation facture fournisseur #' || COALESCE(OLD.invoice_number, OLD.id::TEXT), true
    FROM accounting_entries
    WHERE source_type = 'supplier_invoice' AND source_id = OLD.id AND user_id = OLD.user_id;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IN ('received', 'processed') AND NEW.status IN ('draft', 'rejected') THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, description, is_auto)
    SELECT NEW.user_id, CURRENT_DATE, account_code, credit AS debit, debit AS credit,
      'supplier_invoice_reversal', NEW.id, 'OD', 'ANN-SINV-' || NEW.id,
      'Annulation facture fournisseur #' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true
    FROM accounting_entries
    WHERE source_type = 'supplier_invoice' AND source_id = NEW.id AND user_id = NEW.user_id AND journal = 'AC';

    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reverse_supplier_invoice_on_delete ON supplier_invoices;
CREATE TRIGGER trg_reverse_supplier_invoice_on_delete
  BEFORE DELETE ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_supplier_invoice();

DROP TRIGGER IF EXISTS trg_reverse_supplier_invoice_on_cancel ON supplier_invoices;
CREATE TRIGGER trg_reverse_supplier_invoice_on_cancel
  BEFORE UPDATE ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_supplier_invoice();

COMMENT ON FUNCTION auto_journal_supplier_invoice() IS 'Auto-creates accounting entries when a supplier invoice is received/processed or paid';
COMMENT ON FUNCTION reverse_journal_supplier_invoice() IS 'Reverses accounting entries when a supplier invoice is deleted or reverted to draft/rejected';;
