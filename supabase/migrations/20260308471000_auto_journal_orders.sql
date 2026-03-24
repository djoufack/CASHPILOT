-- ============================================================================
-- AUTO-JOURNAL: Supplier Orders & Purchase Orders
-- Engagements hors-bilan (classe 8) avec extourne automatique
-- ============================================================================
-- Accounts:
--   801 = Engagements donnés (supplier_orders — we commit to pay)
--   802 = Engagements reçus (purchase_orders — clients commit to buy)
--   809 = Contrepartie des engagements
-- Journal: OD (Opérations Diverses)
-- ============================================================================


-- =====================================================================
-- PART 1: SUPPLIER ORDERS — Auto-journal
-- =====================================================================

CREATE OR REPLACE FUNCTION auto_journal_supplier_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_ref TEXT;
  v_amount NUMERIC;
  v_transaction_date DATE;
  v_company_id UUID;
  v_engagement_code TEXT := '801';
  v_contrepartie_code TEXT := '809';
BEGIN
  -- Guard: auto-journal enabled?
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.total_amount, 0);
  IF v_amount = 0 THEN RETURN NEW; END IF;

  v_transaction_date := COALESCE(NEW.order_date, CURRENT_DATE);
  v_ref := 'SO-' || COALESCE(NEW.order_number, LEFT(NEW.id::TEXT, 8));

  -- Resolve company_id
  v_company_id := NEW.company_id;
  IF v_company_id IS NULL THEN
    v_company_id := resolve_preferred_company_id(NEW.user_id);
  END IF;

  -- Ensure accounts exist
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_engagement_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_contrepartie_code);

  -- ---------------------------------------------------------------
  -- CASE 1: UPDATE — status changed to terminal (received/cancelled)
  -- → Extourne (reverse the commitment)
  -- ---------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND OLD.order_status NOT IN ('received', 'cancelled')
     AND NEW.order_status IN ('received', 'cancelled')
  THEN
    -- Delete existing commitment entries
    DELETE FROM accounting_entries
    WHERE source_type = 'supplier_order' AND source_id = NEW.id
      AND user_id = NEW.user_id AND is_auto = true;

    -- Create extourne entries
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES
    (NEW.user_id, CURRENT_DATE, v_contrepartie_code, v_amount, 0,
     'supplier_order', NEW.id, 'OD', 'EXT-' || v_ref, true,
     'Extourne engagement fournisseur - ' || COALESCE(NEW.order_number, '')),
    (NEW.user_id, CURRENT_DATE, v_engagement_code, 0, v_amount,
     'supplier_order', NEW.id, 'OD', 'EXT-' || v_ref, true,
     'Extourne contrepartie engagement - ' || COALESCE(NEW.order_number, ''));

    INSERT INTO accounting_audit_log (
      user_id, event_type, source_table, source_id,
      entry_count, total_debit, total_credit, balance_ok, details
    ) VALUES (
      NEW.user_id, 'extourne', 'supplier_orders', NEW.id,
      2, v_amount, v_amount, true,
      jsonb_build_object(
        'company_id', v_company_id, 'order_number', NEW.order_number,
        'old_status', OLD.order_status, 'new_status', NEW.order_status,
        'amount', v_amount
      )
    );

    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------
  -- CASE 2: UPDATE — status reverted FROM terminal back to active
  -- → Re-journal the commitment
  -- ---------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND OLD.order_status IN ('received', 'cancelled')
     AND NEW.order_status NOT IN ('received', 'cancelled')
  THEN
    -- Delete extourne entries, will re-journal below
    DELETE FROM accounting_entries
    WHERE source_type = 'supplier_order' AND source_id = NEW.id
      AND user_id = NEW.user_id AND is_auto = true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASE 3: UPDATE — amount changed on active order
  -- → Delete old entries and re-journal
  -- ---------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND NEW.order_status NOT IN ('received', 'cancelled')
     AND (OLD.total_amount IS DISTINCT FROM NEW.total_amount)
  THEN
    DELETE FROM accounting_entries
    WHERE source_type = 'supplier_order' AND source_id = NEW.id
      AND user_id = NEW.user_id AND is_auto = true;
  END IF;

  -- ---------------------------------------------------------------
  -- Idempotency: skip if already journaled (and no changes)
  -- ---------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'supplier_order' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Skip draft and terminal statuses
  IF NEW.order_status IN ('draft', 'received', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------
  -- INSERT / active UPDATE: Record commitment (DEBIT 801, CREDIT 809)
  -- ---------------------------------------------------------------
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES
  (NEW.user_id, v_transaction_date, v_engagement_code, v_amount, 0,
   'supplier_order', NEW.id, 'OD', v_ref, true,
   'Engagement fournisseur - ' || COALESCE(NEW.order_number, '')),
  (NEW.user_id, v_transaction_date, v_contrepartie_code, 0, v_amount,
   'supplier_order', NEW.id, 'OD', v_ref, true,
   'Contrepartie engagement fournisseur - ' || COALESCE(NEW.order_number, ''));

  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'supplier_orders', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id, 'order_number', NEW.order_number,
      'status', NEW.order_status, 'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;
-- Attach trigger
DROP TRIGGER IF EXISTS trg_auto_journal_supplier_order ON public.supplier_orders;
CREATE TRIGGER trg_auto_journal_supplier_order
  AFTER INSERT OR UPDATE ON public.supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_supplier_order();
-- Reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_supplier_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  PERFORM reverse_journal_entries(OLD.user_id, 'supplier_order', OLD.id, 'ANN-SO');

  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    OLD.user_id, 'reversal', 'supplier_orders', OLD.id,
    0, 0, 0, true,
    jsonb_build_object('reason', 'supplier order deleted', 'order_number', OLD.order_number, 'amount', OLD.total_amount)
  );

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_supplier_order_on_delete ON public.supplier_orders;
CREATE TRIGGER trg_reverse_journal_supplier_order_on_delete
  BEFORE DELETE ON public.supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_supplier_order();
-- =====================================================================
-- PART 2: PURCHASE ORDERS — Auto-journal
-- =====================================================================

CREATE OR REPLACE FUNCTION auto_journal_purchase_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_ref TEXT;
  v_amount NUMERIC;
  v_transaction_date DATE;
  v_company_id UUID;
  v_engagement_code TEXT := '802';
  v_contrepartie_code TEXT := '809';
BEGIN
  -- Guard: auto-journal enabled?
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.total, 0);
  IF v_amount = 0 THEN RETURN NEW; END IF;

  v_transaction_date := COALESCE(NEW.date, CURRENT_DATE);
  v_ref := 'PO-' || COALESCE(NEW.po_number, LEFT(NEW.id::TEXT, 8));

  -- Resolve company_id
  v_company_id := NEW.company_id;
  IF v_company_id IS NULL THEN
    v_company_id := resolve_preferred_company_id(NEW.user_id);
  END IF;

  -- Ensure accounts exist
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_engagement_code);
  PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_contrepartie_code);

  -- ---------------------------------------------------------------
  -- CASE 1: UPDATE — status changed to terminal (draft/cancelled)
  -- Purchase orders: 'draft' means reverted, 'cancelled' means cancelled
  -- → Extourne
  -- ---------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('sent', 'confirmed')
     AND NEW.status IN ('draft', 'cancelled')
  THEN
    DELETE FROM accounting_entries
    WHERE source_type = 'purchase_order' AND source_id = NEW.id
      AND user_id = NEW.user_id AND is_auto = true;

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES
    (NEW.user_id, CURRENT_DATE, v_contrepartie_code, v_amount, 0,
     'purchase_order', NEW.id, 'OD', 'EXT-' || v_ref, true,
     'Extourne engagement client - ' || COALESCE(NEW.po_number, '')),
    (NEW.user_id, CURRENT_DATE, v_engagement_code, 0, v_amount,
     'purchase_order', NEW.id, 'OD', 'EXT-' || v_ref, true,
     'Extourne contrepartie engagement - ' || COALESCE(NEW.po_number, ''));

    INSERT INTO accounting_audit_log (
      user_id, event_type, source_table, source_id,
      entry_count, total_debit, total_credit, balance_ok, details
    ) VALUES (
      NEW.user_id, 'extourne', 'purchase_orders', NEW.id,
      2, v_amount, v_amount, true,
      jsonb_build_object(
        'company_id', v_company_id, 'po_number', NEW.po_number,
        'old_status', OLD.status, 'new_status', NEW.status,
        'amount', v_amount
      )
    );

    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------
  -- CASE 2: UPDATE — status reactivated from draft/cancelled
  -- ---------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND OLD.status IN ('draft', 'cancelled')
     AND NEW.status IN ('sent', 'confirmed')
  THEN
    DELETE FROM accounting_entries
    WHERE source_type = 'purchase_order' AND source_id = NEW.id
      AND user_id = NEW.user_id AND is_auto = true;
  END IF;

  -- ---------------------------------------------------------------
  -- CASE 3: UPDATE — amount changed on active order
  -- ---------------------------------------------------------------
  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('sent', 'confirmed')
     AND (OLD.total IS DISTINCT FROM NEW.total)
  THEN
    DELETE FROM accounting_entries
    WHERE source_type = 'purchase_order' AND source_id = NEW.id
      AND user_id = NEW.user_id AND is_auto = true;
  END IF;

  -- ---------------------------------------------------------------
  -- Idempotency
  -- ---------------------------------------------------------------
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'purchase_order' AND source_id = NEW.id AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Skip draft and cancelled
  IF NEW.status IN ('draft', 'cancelled') THEN
    RETURN NEW;
  END IF;

  -- ---------------------------------------------------------------
  -- INSERT / active: Record commitment (DEBIT 802, CREDIT 809)
  -- ---------------------------------------------------------------
  INSERT INTO accounting_entries (
    user_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES
  (NEW.user_id, v_transaction_date, v_engagement_code, v_amount, 0,
   'purchase_order', NEW.id, 'OD', v_ref, true,
   'Engagement client - ' || COALESCE(NEW.po_number, '')),
  (NEW.user_id, v_transaction_date, v_contrepartie_code, 0, v_amount,
   'purchase_order', NEW.id, 'OD', v_ref, true,
   'Contrepartie engagement client - ' || COALESCE(NEW.po_number, ''));

  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'purchase_orders', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'company_id', v_company_id, 'po_number', NEW.po_number,
      'status', NEW.status, 'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;
-- Attach trigger
DROP TRIGGER IF EXISTS trg_auto_journal_purchase_order ON public.purchase_orders;
CREATE TRIGGER trg_auto_journal_purchase_order
  AFTER INSERT OR UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_purchase_order();
-- Reversal on DELETE
CREATE OR REPLACE FUNCTION reverse_journal_purchase_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = OLD.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN OLD;
  END IF;

  PERFORM reverse_journal_entries(OLD.user_id, 'purchase_order', OLD.id, 'ANN-PO');

  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    OLD.user_id, 'reversal', 'purchase_orders', OLD.id,
    0, 0, 0, true,
    jsonb_build_object('reason', 'purchase order deleted', 'po_number', OLD.po_number, 'amount', OLD.total)
  );

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_reverse_journal_purchase_order_on_delete ON public.purchase_orders;
CREATE TRIGGER trg_reverse_journal_purchase_order_on_delete
  BEFORE DELETE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION reverse_journal_purchase_order();
-- =====================================================================
-- PART 3: UPDATE company_id assignment for new source_types
-- =====================================================================

CREATE OR REPLACE FUNCTION assign_accounting_entry_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Try to resolve from source table
  BEGIN
    NEW.company_id := CASE
      WHEN NEW.source_type IN ('invoice', 'invoice_payment', 'invoice_reversal') THEN
        (SELECT company_id FROM invoices WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('expense', 'expense_reversal') THEN
        (SELECT company_id FROM expenses WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('payment', 'payment_reversal') THEN
        (SELECT company_id FROM payments WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('supplier_invoice', 'supplier_invoice_payment', 'supplier_invoice_reversal') THEN
        (SELECT company_id FROM supplier_invoices WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('credit_note', 'credit_note_reversal') THEN
        (SELECT company_id FROM credit_notes WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('fixed_asset', 'depreciation') THEN
        (SELECT company_id FROM accounting_fixed_assets WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('payable', 'payable_reversal') THEN
        (SELECT company_id FROM payables WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('receivable', 'receivable_reversal') THEN
        (SELECT company_id FROM receivables WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('stock_movement', 'stock_movement_reversal') THEN
        (SELECT company_id FROM products WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('bank_reconciliation', 'bank_reconciliation_reversal') THEN
        (SELECT company_id FROM bank_transactions WHERE id = NEW.source_id)
      -- NEW: supplier_order and purchase_order
      WHEN NEW.source_type IN ('supplier_order', 'supplier_order_reversal') THEN
        (SELECT company_id FROM supplier_orders WHERE id = NEW.source_id)
      WHEN NEW.source_type IN ('purchase_order', 'purchase_order_reversal') THEN
        (SELECT company_id FROM purchase_orders WHERE id = NEW.source_id)
      ELSE NULL
    END;
  EXCEPTION WHEN OTHERS THEN
    NEW.company_id := NULL;
  END;

  -- Fallback: user's preferred company
  IF NEW.company_id IS NULL THEN
    NEW.company_id := resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;
-- =====================================================================
-- PART 4: BACKFILL — Journal existing supplier_orders & purchase_orders
-- =====================================================================

DO $$
DECLARE
  v_user_ids UUID[] := ARRAY[
    'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
    'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
    'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
  ];
  so RECORD;
  po RECORD;
  v_company_id UUID;
  v_ref TEXT;
  v_count INT := 0;
BEGIN
  -- 4a. Backfill supplier_orders (pending/confirmed → commitment)
  FOR so IN
    SELECT s.id, s.user_id, s.company_id, s.order_number, s.order_date,
           s.total_amount, s.order_status
    FROM supplier_orders s
    WHERE s.user_id = ANY(v_user_ids)
      AND s.order_status IN ('pending', 'confirmed')
      AND s.total_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'supplier_order' AND ae.source_id = s.id
      )
  LOOP
    v_company_id := COALESCE(so.company_id, resolve_preferred_company_id(so.user_id));
    v_ref := 'SO-' || COALESCE(so.order_number, LEFT(so.id::TEXT, 8));

    PERFORM ensure_account_exists(so.user_id, v_company_id, '801');
    PERFORM ensure_account_exists(so.user_id, v_company_id, '809');

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES
    (so.user_id, COALESCE(so.order_date, CURRENT_DATE), '801', so.total_amount, 0,
     'supplier_order', so.id, 'OD', v_ref, true,
     'Engagement fournisseur - ' || COALESCE(so.order_number, '')),
    (so.user_id, COALESCE(so.order_date, CURRENT_DATE), '809', 0, so.total_amount,
     'supplier_order', so.id, 'OD', v_ref, true,
     'Contrepartie engagement fournisseur - ' || COALESCE(so.order_number, ''));

    v_count := v_count + 2;
  END LOOP;

  -- 4b. Backfill supplier_orders (received/cancelled → extourne)
  FOR so IN
    SELECT s.id, s.user_id, s.company_id, s.order_number, s.order_date,
           s.total_amount, s.order_status
    FROM supplier_orders s
    WHERE s.user_id = ANY(v_user_ids)
      AND s.order_status IN ('received', 'cancelled')
      AND s.total_amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'supplier_order' AND ae.source_id = s.id
      )
  LOOP
    v_company_id := COALESCE(so.company_id, resolve_preferred_company_id(so.user_id));
    v_ref := 'EXT-SO-' || COALESCE(so.order_number, LEFT(so.id::TEXT, 8));

    PERFORM ensure_account_exists(so.user_id, v_company_id, '801');
    PERFORM ensure_account_exists(so.user_id, v_company_id, '809');

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES
    (so.user_id, COALESCE(so.order_date, CURRENT_DATE), '809', so.total_amount, 0,
     'supplier_order', so.id, 'OD', v_ref, true,
     'Extourne engagement fournisseur - ' || COALESCE(so.order_number, '')),
    (so.user_id, COALESCE(so.order_date, CURRENT_DATE), '801', 0, so.total_amount,
     'supplier_order', so.id, 'OD', v_ref, true,
     'Extourne contrepartie engagement - ' || COALESCE(so.order_number, ''));

    v_count := v_count + 2;
  END LOOP;

  -- 4c. Backfill purchase_orders (sent/confirmed → commitment)
  FOR po IN
    SELECT p.id, p.user_id, p.company_id, p.po_number, p.date,
           p.total, p.status
    FROM purchase_orders p
    WHERE p.user_id = ANY(v_user_ids)
      AND p.status IN ('sent', 'confirmed')
      AND p.total > 0
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'purchase_order' AND ae.source_id = p.id
      )
  LOOP
    v_company_id := COALESCE(po.company_id, resolve_preferred_company_id(po.user_id));
    v_ref := 'PO-' || COALESCE(po.po_number, LEFT(po.id::TEXT, 8));

    PERFORM ensure_account_exists(po.user_id, v_company_id, '802');
    PERFORM ensure_account_exists(po.user_id, v_company_id, '809');

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES
    (po.user_id, COALESCE(po.date, CURRENT_DATE), '802', po.total, 0,
     'purchase_order', po.id, 'OD', v_ref, true,
     'Engagement client - ' || COALESCE(po.po_number, '')),
    (po.user_id, COALESCE(po.date, CURRENT_DATE), '809', 0, po.total,
     'purchase_order', po.id, 'OD', v_ref, true,
     'Contrepartie engagement client - ' || COALESCE(po.po_number, ''));

    v_count := v_count + 2;
  END LOOP;

  -- 4d. Backfill purchase_orders (draft → no journal needed, already skipped)

  RAISE NOTICE 'Backfilled % accounting entries for orders', v_count;
END $$;
-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';
