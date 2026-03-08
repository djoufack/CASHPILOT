-- ============================================================================
-- Fix accounting entries: correct company_id assignment for payable,
-- receivable, stock_movement source types + generate missing entries
--
-- Root cause: assign_accounting_entry_company_id() didn't handle payable/
-- receivable source types, and marked stock_movement as NULL.
-- All entries fell back to resolve_preferred_company_id() → one company.
--
-- Directive: "privilegier l'integrite referentielle pk-fk, aux triggers"
-- ============================================================================

-- ============================================================
-- Step 1: Fix the assign function to handle ALL source types
-- ============================================================
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

      -- FIX: payable → resolve from payables table
      WHEN NEW.source_type = 'payable' THEN
        SELECT p.company_id INTO v_company_id
        FROM public.payables p WHERE p.id = NEW.source_id;

      -- FIX: receivable → resolve from receivables table
      WHEN NEW.source_type = 'receivable' THEN
        SELECT r.company_id INTO v_company_id
        FROM public.receivables r WHERE r.id = NEW.source_id;

      -- FIX: stock_movement → resolve from products table (products DO have company_id)
      WHEN NEW.source_type = 'stock_movement' THEN
        SELECT pr.company_id INTO v_company_id
        FROM public.products pr WHERE pr.id = NEW.source_id;

      WHEN NEW.source_type = 'bank_reconciliation' THEN
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


-- ============================================================
-- Step 2: Reassign misplaced payable entries to correct company
-- ============================================================
UPDATE accounting_entries ae
SET company_id = p.company_id
FROM payables p
WHERE ae.source_type = 'payable'
  AND ae.source_id = p.id
  AND ae.company_id != p.company_id;

-- ============================================================
-- Step 3: Reassign misplaced receivable entries to correct company
-- ============================================================
UPDATE accounting_entries ae
SET company_id = r.company_id
FROM receivables r
WHERE ae.source_type = 'receivable'
  AND ae.source_id = r.id
  AND ae.company_id != r.company_id;

-- ============================================================
-- Step 4: Reassign misplaced stock_movement entries to correct company
-- ============================================================
UPDATE accounting_entries ae
SET company_id = pr.company_id
FROM products pr
WHERE ae.source_type = 'stock_movement'
  AND ae.source_id = pr.id
  AND ae.company_id != pr.company_id;


-- ============================================================
-- Step 5: Generate missing payable accounting entries
-- (for companies that have payables but no corresponding entries)
-- ============================================================
DO $$
DECLARE
  v_pay RECORD;
  v_ref TEXT;
BEGIN
  FOR v_pay IN
    SELECT p.id, p.user_id, p.company_id, p.amount,
           p.creditor_name, p.description,
           COALESCE(p.date_borrowed, p.created_at::date) AS tx_date
    FROM payables p
    WHERE p.user_id IN (
      'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
      'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
      'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
    )
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.source_type = 'payable'
        AND ae.source_id = p.id
        AND ae.company_id = p.company_id
    )
  LOOP
    v_ref := 'PAY-' || v_pay.id::text;

    -- DEBIT: 658 (Charges diverses)
    INSERT INTO accounting_entries (
      id, user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id, journal, entry_ref,
      is_auto, description
    ) VALUES (
      gen_random_uuid(), v_pay.user_id, v_pay.company_id, v_pay.tx_date,
      '658', v_pay.amount, 0,
      'payable', v_pay.id, 'OD', v_ref, true,
      'Charge diverse - ' || COALESCE(v_pay.creditor_name, '') || ' ' || COALESCE(v_pay.description, '')
    );

    -- CREDIT: 401 (Fournisseurs)
    INSERT INTO accounting_entries (
      id, user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id, journal, entry_ref,
      is_auto, description
    ) VALUES (
      gen_random_uuid(), v_pay.user_id, v_pay.company_id, v_pay.tx_date,
      '401', 0, v_pay.amount,
      'payable', v_pay.id, 'OD', v_ref, true,
      'Fournisseur - Dette ' || COALESCE(v_pay.creditor_name, '')
    );
  END LOOP;

  RAISE NOTICE 'Payable accounting entries generated';
END $$;


-- ============================================================
-- Step 6: Generate missing receivable accounting entries
-- ============================================================
DO $$
DECLARE
  v_rec RECORD;
  v_ref TEXT;
BEGIN
  FOR v_rec IN
    SELECT r.id, r.user_id, r.company_id, r.amount,
           r.debtor_name, r.description,
           COALESCE(r.date_lent, r.created_at::date) AS tx_date
    FROM receivables r
    WHERE r.user_id IN (
      'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
      'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
      'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
    )
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.source_type = 'receivable'
        AND ae.source_id = r.id
        AND ae.company_id = r.company_id
    )
  LOOP
    v_ref := 'REC-' || v_rec.id::text;

    -- DEBIT: 411 (Creances clients)
    INSERT INTO accounting_entries (
      id, user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id, journal, entry_ref,
      is_auto, description
    ) VALUES (
      gen_random_uuid(), v_rec.user_id, v_rec.company_id, v_rec.tx_date,
      '411', v_rec.amount, 0,
      'receivable', v_rec.id, 'OD', v_ref, true,
      'Creance client - ' || COALESCE(v_rec.debtor_name, '') || ' ' || COALESCE(v_rec.description, '')
    );

    -- CREDIT: 758 (Produits divers)
    INSERT INTO accounting_entries (
      id, user_id, company_id, transaction_date, account_code,
      debit, credit, source_type, source_id, journal, entry_ref,
      is_auto, description
    ) VALUES (
      gen_random_uuid(), v_rec.user_id, v_rec.company_id, v_rec.tx_date,
      '758', 0, v_rec.amount,
      'receivable', v_rec.id, 'OD', v_ref, true,
      'Produit divers - Creance ' || COALESCE(v_rec.debtor_name, '')
    );
  END LOOP;

  RAISE NOTICE 'Receivable accounting entries generated';
END $$;


-- ============================================================
-- Step 7: Generate missing stock_movement accounting entries
-- ============================================================
DO $$
DECLARE
  v_prod RECORD;
  v_ref TEXT;
  v_amount NUMERIC(15,2);
BEGIN
  FOR v_prod IN
    SELECT pr.id, pr.user_id, pr.company_id, pr.product_name,
           pr.stock_quantity, pr.purchase_price, pr.unit_price
    FROM products pr
    WHERE pr.user_id IN (
      'a6985aad-8ae5-21d1-a773-511d32b71b24'::uuid,
      'e3b36145-b3ab-bab9-4101-68b5fe900811'::uuid,
      'eb70d17b-9562-59ed-f783-89327e65a7c1'::uuid
    )
    AND pr.stock_quantity > 0
    AND NOT EXISTS (
      SELECT 1 FROM accounting_entries ae
      WHERE ae.source_type = 'stock_movement'
        AND ae.source_id = pr.id
        AND ae.company_id = pr.company_id
    )
  LOOP
    v_ref := 'STK-' || v_prod.id::text;
    v_amount := v_prod.stock_quantity * COALESCE(v_prod.purchase_price, v_prod.unit_price);

    IF v_amount > 0 THEN
      -- DEBIT: 31 (Stock marchandises)
      INSERT INTO accounting_entries (
        id, user_id, company_id, transaction_date, account_code,
        debit, credit, source_type, source_id, journal, entry_ref,
        is_auto, description
      ) VALUES (
        gen_random_uuid(), v_prod.user_id, v_prod.company_id, CURRENT_DATE,
        '31', v_amount, 0,
        'stock_movement', v_prod.id, 'OD', v_ref, true,
        'Entree stock: ' || COALESCE(v_prod.product_name, '') || ' (+' || v_prod.stock_quantity || ')'
      );

      -- CREDIT: 603 (Variation de stock)
      INSERT INTO accounting_entries (
        id, user_id, company_id, transaction_date, account_code,
        debit, credit, source_type, source_id, journal, entry_ref,
        is_auto, description
      ) VALUES (
        gen_random_uuid(), v_prod.user_id, v_prod.company_id, CURRENT_DATE,
        '603', 0, v_amount,
        'stock_movement', v_prod.id, 'OD', v_ref, true,
        'Variation stock: ' || COALESCE(v_prod.product_name, '') || ' (+' || v_prod.stock_quantity || ')'
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Stock movement accounting entries generated';
END $$;


NOTIFY pgrst, 'reload schema';
