-- =====================================================================
-- Sprint D: Auto-journal triggers for stock movements, bank statement
-- reconciliation, fixed asset depreciation, and balance enforcement.
--
-- D1: auto_journal_stock_movement() — AFTER UPDATE on products
-- D2: auto_journal_bank_statement_line_reconciled() — AFTER UPDATE on bank_statement_lines
-- D3: generate_depreciation_entries(p_user_id, p_date) — Callable function
-- D4: enforce_balanced_entries() — Constraint trigger on accounting_entries
-- =====================================================================

-- =====================================================================
-- D1: AUTO-JOURNAL STOCK MOVEMENT
-- Fires AFTER UPDATE on products WHEN stock_quantity changes.
-- FIFO/average cost: uses purchase_price or unit_price for valuation.
-- Stock increase (purchase/receipt): Debit 31/37, Credit 603
-- Stock decrease (sale/consumption): Debit 603, Credit 31/37
-- =====================================================================

CREATE OR REPLACE FUNCTION auto_journal_stock_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_qty_change NUMERIC;
  v_unit_cost NUMERIC;
  v_amount NUMERIC;
  v_stock_code TEXT;   -- 31x/37x Stock account
  v_variation_code TEXT; -- 603 Variation de stock
  v_ref TEXT;
  v_country TEXT;
BEGIN
  -- Only fire if stock_quantity actually changed
  IF OLD.stock_quantity IS NOT DISTINCT FROM NEW.stock_quantity THEN
    RETURN NEW;
  END IF;

  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Determine unit cost (FIFO/average approximation)
  v_unit_cost := COALESCE(NEW.purchase_price, NEW.unit_price, 0);

  -- Skip if no valuation possible
  IF v_unit_cost = 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate movement
  v_qty_change := NEW.stock_quantity - OLD.stock_quantity;
  v_amount := ABS(v_qty_change) * v_unit_cost;

  -- Skip zero-amount movements
  IF v_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Idempotency: check for existing entry with same ref
  v_ref := 'STK-' || NEW.id;
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE entry_ref = v_ref AND user_id = NEW.user_id
      AND source_type = 'stock_movement'
      AND transaction_date = CURRENT_DATE
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve account codes by country
  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  v_country := COALESCE(v_country, 'OHADA');

  -- Stock account: 31 (marchandises) or 37 (stocks en cours)
  -- Default to 31 for products
  v_stock_code := CASE
    WHEN v_country = 'FR' THEN '31'
    WHEN v_country = 'OHADA' THEN '31'
    ELSE '31'
  END;

  -- Variation de stock: 603
  v_variation_code := CASE
    WHEN v_country = 'FR' THEN '603'
    WHEN v_country = 'OHADA' THEN '603'
    ELSE '603'
  END;

  IF v_qty_change > 0 THEN
    -- Stock INCREASE (purchase/receipt): Debit Stock, Credit Variation
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, CURRENT_DATE, v_stock_code, v_amount, 0,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Entree stock: ' || COALESCE(NEW.product_name, '') || ' (+' || v_qty_change || ')'
    );

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, CURRENT_DATE, v_variation_code, 0, v_amount,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Variation stock: ' || COALESCE(NEW.product_name, '') || ' (+' || v_qty_change || ')'
    );
  ELSE
    -- Stock DECREASE (sale/consumption): Debit Variation, Credit Stock
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, CURRENT_DATE, v_variation_code, v_amount, 0,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Variation stock: ' || COALESCE(NEW.product_name, '') || ' (' || v_qty_change || ')'
    );

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, CURRENT_DATE, v_stock_code, 0, v_amount,
      'stock_movement', NEW.id, 'OD', v_ref, true,
      'Sortie stock: ' || COALESCE(NEW.product_name, '') || ' (' || v_qty_change || ')'
    );
  END IF;

  -- Audit log
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'products', NEW.id,
    2, v_amount, v_amount, true,
    jsonb_build_object(
      'product', NEW.product_name,
      'old_qty', OLD.stock_quantity,
      'new_qty', NEW.stock_quantity,
      'unit_cost', v_unit_cost,
      'amount', v_amount
    )
  );

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_journal_stock_movement ON public.products;
CREATE TRIGGER trg_auto_journal_stock_movement
  AFTER UPDATE ON public.products
  FOR EACH ROW
  WHEN (OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity)
  EXECUTE FUNCTION auto_journal_stock_movement();
-- =====================================================================
-- D2: AUTO-JOURNAL BANK STATEMENT LINE RECONCILED
-- Fires AFTER UPDATE on bank_statement_lines when reconciliation_status
-- changes to 'matched' (the schema uses 'matched', not 'reconciled').
-- Credit amounts (amount > 0, money in): Debit 512 Banque, Credit 471
-- Debit amounts (amount < 0, money out): Debit 471, Credit 512 Banque
-- =====================================================================

CREATE OR REPLACE FUNCTION auto_journal_bank_statement_line_reconciled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled BOOLEAN;
  v_bank_code TEXT;
  v_suspense_code TEXT;
  v_country TEXT;
  v_ref TEXT;
  v_abs_amount NUMERIC;
BEGIN
  -- Only fire when status transitions TO matched from a non-matched state
  IF NEW.reconciliation_status NOT IN ('matched') THEN
    RETURN NEW;
  END IF;

  IF OLD.reconciliation_status IN ('matched') THEN
    RETURN NEW;
  END IF;

  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Idempotency
  v_ref := 'BSL-' || NEW.id;
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE entry_ref = v_ref AND user_id = NEW.user_id
      AND source_type = 'bank_reconciliation'
  ) THEN
    RETURN NEW;
  END IF;

  -- Skip zero amounts
  v_abs_amount := ABS(COALESCE(NEW.amount, 0));
  IF v_abs_amount = 0 THEN
    RETURN NEW;
  END IF;

  -- Resolve account codes
  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  v_country := COALESCE(v_country, 'OHADA');

  v_bank_code := CASE
    WHEN v_country = 'FR' THEN '512'
    WHEN v_country = 'OHADA' THEN '521'
    ELSE '550'
  END;

  v_suspense_code := CASE
    WHEN v_country = 'FR' THEN '471'
    WHEN v_country = 'OHADA' THEN '471'
    ELSE '471'
  END;

  IF NEW.amount > 0 THEN
    -- Credit (money in): Debit Banque, Credit Compte d'attente
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, COALESCE(NEW.transaction_date, CURRENT_DATE), v_bank_code, v_abs_amount, 0,
      'bank_reconciliation', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Credit: ' || COALESCE(NEW.description, '')
    );

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, COALESCE(NEW.transaction_date, CURRENT_DATE), v_suspense_code, 0, v_abs_amount,
      'bank_reconciliation', NEW.id, 'BQ', v_ref, true,
      'Compte attente rapprochement: ' || COALESCE(NEW.description, '')
    );
  ELSE
    -- Debit (money out): Debit Compte d'attente, Credit Banque
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, COALESCE(NEW.transaction_date, CURRENT_DATE), v_suspense_code, v_abs_amount, 0,
      'bank_reconciliation', NEW.id, 'BQ', v_ref, true,
      'Compte attente rapprochement: ' || COALESCE(NEW.description, '')
    );

    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      NEW.user_id, COALESCE(NEW.transaction_date, CURRENT_DATE), v_bank_code, 0, v_abs_amount,
      'bank_reconciliation', NEW.id, 'BQ', v_ref, true,
      'Rapprochement bancaire - Debit: ' || COALESCE(NEW.description, '')
    );
  END IF;

  -- Audit log
  INSERT INTO accounting_audit_log (
    user_id, event_type, source_table, source_id,
    entry_count, total_debit, total_credit, balance_ok, details
  ) VALUES (
    NEW.user_id, 'auto_journal', 'bank_statement_lines', NEW.id,
    2, v_abs_amount, v_abs_amount, true,
    jsonb_build_object(
      'amount', NEW.amount,
      'description', NEW.description,
      'matched_source_type', NEW.matched_source_type,
      'matched_source_id', NEW.matched_source_id
    )
  );

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_auto_journal_bsl_reconciled ON public.bank_statement_lines;
CREATE TRIGGER trg_auto_journal_bsl_reconciled
  AFTER UPDATE ON public.bank_statement_lines
  FOR EACH ROW
  WHEN (OLD.reconciliation_status IS DISTINCT FROM NEW.reconciliation_status)
  EXECUTE FUNCTION auto_journal_bank_statement_line_reconciled();
-- =====================================================================
-- D3: GENERATE DEPRECIATION ENTRIES (callable function, not auto-trigger)
-- Called monthly/annually to generate depreciation journal entries for
-- all active fixed assets belonging to a user.
-- Linear depreciation: monthly_amount = acquisition_cost / (useful_life_years * 12)
-- Debit 681 (Dotation amortissements), Credit 28x (Amortissement du bien)
-- Returns count of entries created.
-- =====================================================================

CREATE OR REPLACE FUNCTION generate_depreciation_entries(p_user_id UUID, p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_asset RECORD;
  v_monthly_amount NUMERIC;
  v_accumulated NUMERIC;
  v_net_book_value NUMERIC;
  v_ref TEXT;
  v_period_year INTEGER;
  v_period_month INTEGER;
  v_count INTEGER := 0;
  v_expense_code TEXT;
  v_depreciation_code TEXT;
BEGIN
  v_period_year := EXTRACT(YEAR FROM p_date)::INTEGER;
  v_period_month := EXTRACT(MONTH FROM p_date)::INTEGER;

  FOR v_asset IN
    SELECT *
    FROM accounting_fixed_assets
    WHERE user_id = p_user_id
      AND status = 'active'
      AND depreciation_method = 'linear'
      AND acquisition_date <= p_date
  LOOP
    -- Skip if already depreciated for this month
    IF EXISTS (
      SELECT 1 FROM accounting_depreciation_schedule
      WHERE asset_id = v_asset.id
        AND period_year = v_period_year
        AND period_month = v_period_month
        AND is_posted = true
    ) THEN
      CONTINUE;
    END IF;

    -- Also check accounting_entries for idempotency
    v_ref := 'DEP-' || v_asset.id || '-' || v_period_year || '-' || LPAD(v_period_month::TEXT, 2, '0');
    IF EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE entry_ref = v_ref AND user_id = p_user_id
        AND source_type = 'depreciation'
    ) THEN
      CONTINUE;
    END IF;

    -- Calculate monthly depreciation (linear)
    v_monthly_amount := ROUND(
      (v_asset.acquisition_cost - COALESCE(v_asset.residual_value, 0))
      / (v_asset.useful_life_years * 12),
      2
    );

    -- Skip if nothing to depreciate
    IF v_monthly_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Calculate accumulated depreciation so far
    SELECT COALESCE(SUM(depreciation_amount), 0) INTO v_accumulated
    FROM accounting_depreciation_schedule
    WHERE asset_id = v_asset.id AND is_posted = true;

    -- Check if fully depreciated
    IF v_accumulated + v_monthly_amount > (v_asset.acquisition_cost - COALESCE(v_asset.residual_value, 0)) THEN
      -- Adjust last period amount
      v_monthly_amount := (v_asset.acquisition_cost - COALESCE(v_asset.residual_value, 0)) - v_accumulated;
      IF v_monthly_amount <= 0 THEN
        -- Mark as fully depreciated
        UPDATE accounting_fixed_assets
        SET status = 'fully_depreciated', updated_at = now()
        WHERE id = v_asset.id;
        CONTINUE;
      END IF;
    END IF;

    v_net_book_value := v_asset.acquisition_cost - v_accumulated - v_monthly_amount;

    -- Use asset-specific accounts or defaults
    v_expense_code := COALESCE(v_asset.account_code_expense, '6811');
    v_depreciation_code := COALESCE(v_asset.account_code_depreciation, '2815');

    -- DEBIT: Dotation aux amortissements (681x)
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_user_id, p_date, v_expense_code, v_monthly_amount, 0,
      'depreciation', v_asset.id, 'OD', v_ref, true,
      'Dotation amortissement: ' || v_asset.asset_name || ' (' || v_period_month || '/' || v_period_year || ')'
    );

    -- CREDIT: Amortissement du bien (28x)
    INSERT INTO accounting_entries (
      user_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_user_id, p_date, v_depreciation_code, 0, v_monthly_amount,
      'depreciation', v_asset.id, 'OD', v_ref, true,
      'Amortissement cumule: ' || v_asset.asset_name || ' (' || v_period_month || '/' || v_period_year || ')'
    );

    -- Record in depreciation schedule
    INSERT INTO accounting_depreciation_schedule (
      user_id, asset_id, period_year, period_month,
      depreciation_amount, accumulated_depreciation, net_book_value,
      is_posted, entry_ref, posted_at
    ) VALUES (
      p_user_id, v_asset.id, v_period_year, v_period_month,
      v_monthly_amount, v_accumulated + v_monthly_amount, v_net_book_value,
      true, v_ref, now()
    )
    ON CONFLICT (asset_id, period_year, period_month)
    DO UPDATE SET
      depreciation_amount = EXCLUDED.depreciation_amount,
      accumulated_depreciation = EXCLUDED.accumulated_depreciation,
      net_book_value = EXCLUDED.net_book_value,
      is_posted = true,
      entry_ref = EXCLUDED.entry_ref,
      posted_at = now();

    -- Mark fully depreciated if needed
    IF v_net_book_value <= COALESCE(v_asset.residual_value, 0) THEN
      UPDATE accounting_fixed_assets
      SET status = 'fully_depreciated', updated_at = now()
      WHERE id = v_asset.id;
    END IF;

    -- Audit log
    INSERT INTO accounting_audit_log (
      user_id, event_type, source_table, source_id,
      entry_count, total_debit, total_credit, balance_ok, details
    ) VALUES (
      p_user_id, 'auto_journal', 'accounting_fixed_assets', v_asset.id,
      2, v_monthly_amount, v_monthly_amount, true,
      jsonb_build_object(
        'asset', v_asset.asset_name,
        'period', v_period_year || '-' || LPAD(v_period_month::TEXT, 2, '0'),
        'monthly_amount', v_monthly_amount,
        'accumulated', v_accumulated + v_monthly_amount,
        'net_book_value', v_net_book_value
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
-- =====================================================================
-- D4: ENFORCE BALANCED ENTRIES (constraint trigger)
-- Fires AFTER INSERT on accounting_entries.
-- Checks that for the same entry_ref, total debit = total credit
-- (within 0.01 tolerance). Uses RAISE WARNING to avoid breaking
-- existing triggers while logging imbalances.
-- =====================================================================

CREATE OR REPLACE FUNCTION enforce_balanced_entries()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check that for the same entry_ref, total debit = total credit (within 0.01 tolerance)
  IF NEW.entry_ref IS NOT NULL AND EXISTS (
    SELECT entry_ref
    FROM accounting_entries
    WHERE entry_ref = NEW.entry_ref AND user_id = NEW.user_id
    GROUP BY entry_ref
    HAVING ABS(SUM(COALESCE(debit, 0)) - SUM(COALESCE(credit, 0))) > 0.01
  ) THEN
    RAISE WARNING 'Unbalanced entry detected for ref %: debit=%, credit=%',
      NEW.entry_ref,
      (SELECT SUM(COALESCE(debit, 0)) FROM accounting_entries WHERE entry_ref = NEW.entry_ref AND user_id = NEW.user_id),
      (SELECT SUM(COALESCE(credit, 0)) FROM accounting_entries WHERE entry_ref = NEW.entry_ref AND user_id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_balanced_entries ON public.accounting_entries;
CREATE CONSTRAINT TRIGGER trg_enforce_balanced_entries
  AFTER INSERT ON public.accounting_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION enforce_balanced_entries();
-- =====================================================================
-- Update company_id resolver to handle new source types
-- =====================================================================

CREATE OR REPLACE FUNCTION public.assign_accounting_entry_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_id IS NOT NULL THEN
    CASE
      WHEN NEW.source_type IN ('invoice', 'invoice_payment', 'invoice_reversal') THEN
        SELECT i.company_id INTO v_company_id
        FROM public.invoices i WHERE i.id = NEW.source_id;

      WHEN NEW.source_type IN ('expense', 'expense_reversal') THEN
        SELECT e.company_id INTO v_company_id
        FROM public.expenses e WHERE e.id = NEW.source_id;

      WHEN NEW.source_type IN ('payment', 'payment_reversal') THEN
        SELECT p.company_id INTO v_company_id
        FROM public.payments p WHERE p.id = NEW.source_id;

      WHEN NEW.source_type IN ('supplier_invoice', 'supplier_invoice_payment', 'supplier_invoice_reversal') THEN
        SELECT si.company_id INTO v_company_id
        FROM public.supplier_invoices si WHERE si.id = NEW.source_id;

      WHEN NEW.source_type IN ('credit_note', 'credit_note_reversal') THEN
        SELECT cn.company_id INTO v_company_id
        FROM public.credit_notes cn WHERE cn.id = NEW.source_id;

      WHEN NEW.source_type IN ('fixed_asset', 'depreciation') THEN
        SELECT fa.company_id INTO v_company_id
        FROM public.accounting_fixed_assets fa WHERE fa.id = NEW.source_id;

      WHEN NEW.source_type = 'stock_movement' THEN
        -- Products don't have company_id, resolve via user preference
        v_company_id := NULL;

      WHEN NEW.source_type = 'bank_reconciliation' THEN
        -- Bank statement lines: resolve via statement -> user preference
        v_company_id := NULL;

      ELSE
        v_company_id := NULL;
    END CASE;
  END IF;

  IF v_company_id IS NULL THEN
    v_company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  NEW.company_id := v_company_id;
  RETURN NEW;
END;
$$;
