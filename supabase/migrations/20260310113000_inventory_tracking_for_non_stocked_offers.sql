-- ============================================================================
-- Inventory tracking compliance for non-stockable offers
-- - Add explicit inventory_tracking_enabled flag on products
-- - Prevent stock/603 journalization for non-stockable offers
-- - Clean demo service-like products that were incorrectly tracked as stock
-- - Give account 603 an explicit French label when auto-created
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.products.inventory_tracking_enabled IS
  'TRUE for stock-tracked goods only. FALSE for services, subscriptions, licenses, and other non-stockable offers.';

CREATE OR REPLACE FUNCTION public.auto_stock_decrement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invoice_number TEXT;
    v_prev_qty NUMERIC(14,2);
    v_user_id UUID;
    v_company_id UUID;
    v_track_inventory BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.item_type = 'product' AND NEW.product_id IS NOT NULL THEN
        SELECT p.stock_quantity, COALESCE(p.inventory_tracking_enabled, TRUE), p.company_id
          INTO v_prev_qty, v_track_inventory, v_company_id
        FROM public.products p
        WHERE p.id = NEW.product_id;

        IF COALESCE(v_track_inventory, TRUE) IS NOT TRUE THEN
            RETURN NEW;
        END IF;

        SELECT invoice_number, user_id INTO v_invoice_number, v_user_id
        FROM public.invoices WHERE id = NEW.invoice_id;

        UPDATE public.products
        SET stock_quantity = stock_quantity - COALESCE(NEW.quantity, 0)
        WHERE id = NEW.product_id;

        INSERT INTO public.product_stock_history (
            user_product_id, product_id, company_id, previous_quantity, new_quantity, change_quantity,
            reason, notes, created_by
        ) VALUES (
            NEW.product_id, NEW.product_id, v_company_id, v_prev_qty, v_prev_qty - COALESCE(NEW.quantity, 0),
            -COALESCE(NEW.quantity, 0), 'sale',
            'Facture ' || COALESCE(v_invoice_number, 'N/A'), v_user_id
        );

    ELSIF TG_OP = 'DELETE' AND OLD.item_type = 'product' AND OLD.product_id IS NOT NULL THEN
        SELECT p.stock_quantity, COALESCE(p.inventory_tracking_enabled, TRUE), p.company_id
          INTO v_prev_qty, v_track_inventory, v_company_id
        FROM public.products p
        WHERE p.id = OLD.product_id;

        IF COALESCE(v_track_inventory, TRUE) IS NOT TRUE THEN
            RETURN OLD;
        END IF;

        SELECT invoice_number, user_id INTO v_invoice_number, v_user_id
        FROM public.invoices WHERE id = OLD.invoice_id;

        UPDATE public.products
        SET stock_quantity = stock_quantity + COALESCE(OLD.quantity, 0)
        WHERE id = OLD.product_id;

        INSERT INTO public.product_stock_history (
            user_product_id, product_id, company_id, previous_quantity, new_quantity, change_quantity,
            reason, notes, created_by
        ) VALUES (
            OLD.product_id, OLD.product_id, v_company_id, v_prev_qty, v_prev_qty + COALESCE(OLD.quantity, 0),
            COALESCE(OLD.quantity, 0), 'adjustment',
            'Annulation facture ' || COALESCE(v_invoice_number, 'N/A'), v_user_id
        );
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_stock_decrement ON public.invoice_items;
CREATE TRIGGER trg_auto_stock_decrement
    AFTER INSERT OR DELETE ON public.invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.auto_stock_decrement();

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
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.stock_quantity, 0) = 0 THEN
      RETURN NEW;
    END IF;
  ELSE
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

  IF COALESCE(NEW.inventory_tracking_enabled, TRUE) IS NOT TRUE THEN
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

  IF TG_OP = 'INSERT' THEN
    IF EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE entry_ref = v_ref AND user_id = NEW.user_id
        AND source_type = 'stock_movement'
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

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

CREATE OR REPLACE FUNCTION public.ensure_account_exists(
  p_user_id UUID,
  p_company_id UUID,
  p_account_code TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name TEXT;
  v_type TEXT;
BEGIN
  IF p_account_code IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM accounting_chart_of_accounts
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND account_code = p_account_code
  ) THEN
    RETURN;
  END IF;

  v_type := CASE
    WHEN p_account_code ~ '^1' THEN 'equity'
    WHEN p_account_code ~ '^[23]' THEN 'asset'
    WHEN p_account_code ~ '^4[01]' THEN 'asset'
    WHEN p_account_code ~ '^44[56]' THEN 'asset'
    WHEN p_account_code ~ '^4' THEN 'liability'
    WHEN p_account_code ~ '^5' THEN 'asset'
    WHEN p_account_code ~ '^6' THEN 'expense'
    WHEN p_account_code ~ '^7' THEN 'revenue'
    ELSE 'expense'
  END;

  v_name := CASE p_account_code
    WHEN '400' THEN 'Clients (PCMN)'
    WHEN '401' THEN 'Fournisseurs'
    WHEN '411' THEN 'Clients'
    WHEN '440' THEN 'Fournisseurs (PCMN)'
    WHEN '4110' THEN 'TVA deductible (PCMN)'
    WHEN '4431' THEN 'TVA facturee (SYSCOHADA)'
    WHEN '44566' THEN 'TVA deductible sur ABS'
    WHEN '44571' THEN 'TVA collectee'
    WHEN '4452' THEN 'TVA recuperable (SYSCOHADA)'
    WHEN '451' THEN 'TVA a payer'
    WHEN '4510' THEN 'TVA a payer (PCMN)'
    WHEN '512' THEN 'Banque'
    WHEN '5112' THEN 'Cheques a encaisser'
    WHEN '513' THEN 'Cheques (SYSCOHADA)'
    WHEN '521' THEN 'Banque (SYSCOHADA)'
    WHEN '530' THEN 'Caisse'
    WHEN '550' THEN 'Banque (PCMN)'
    WHEN '570' THEN 'Caisse (PCMN)'
    WHEN '571' THEN 'Caisse (SYSCOHADA)'
    WHEN '601' THEN 'Achats de matieres premieres'
    WHEN '603' THEN 'Variation des stocks (approvisionnements et marchandises)'
    WHEN '6051' THEN 'Fournitures non stockables (SYSCOHADA)'
    WHEN '6053' THEN 'Fournitures de bureau (SYSCOHADA)'
    WHEN '6054' THEN 'Fournitures informatiques (SYSCOHADA)'
    WHEN '6061' THEN 'Fournitures non stockables'
    WHEN '6063' THEN 'Fournitures informatiques'
    WHEN '6064' THEN 'Fournitures de bureau'
    WHEN '6116' THEN 'Sous-traitance logicielle'
    WHEN '6132' THEN 'Locations immobilieres'
    WHEN '6155' THEN 'Entretien materiel (SYSCOHADA)'
    WHEN '615' THEN 'Entretien et reparations'
    WHEN '616' THEN 'Assurances'
    WHEN '618' THEN 'Divers services exterieurs'
    WHEN '6180' THEN 'Divers services exterieurs (PCMN)'
    WHEN '620' THEN 'Remunerations (PCMN)'
    WHEN '625' THEN 'Assurances (SYSCOHADA)'
    WHEN '6222' THEN 'Loyers (SYSCOHADA)'
    WHEN '6226' THEN 'Honoraires'
    WHEN '6231' THEN 'Publicite et marketing'
    WHEN '6241' THEN 'Transports de biens'
    WHEN '6251' THEN 'Voyages et deplacements'
    WHEN '6257' THEN 'Frais de reception'
    WHEN '626' THEN 'Telecommunications'
    WHEN '627' THEN 'Frais bancaires'
    WHEN '628' THEN 'Telecommunications (SYSCOHADA)'
    WHEN '630' THEN 'Amortissements (PCMN)'
    WHEN '631' THEN 'Frais bancaires (SYSCOHADA)'
    WHEN '633' THEN 'Formation (SYSCOHADA)'
    WHEN '6324' THEN 'Honoraires (SYSCOHADA)'
    WHEN '6333' THEN 'Formation du personnel'
    WHEN '634' THEN 'Logiciels et licences (SYSCOHADA)'
    WHEN '635' THEN 'Impots et taxes'
    WHEN '636' THEN 'Frais de restauration (SYSCOHADA)'
    WHEN '638' THEN 'Charges diverses (SYSCOHADA)'
    WHEN '6371' THEN 'Voyages et deplacements (SYSCOHADA)'
    WHEN '641' THEN 'Remunerations du personnel'
    WHEN '646' THEN 'Impots et taxes (SYSCOHADA)'
    WHEN '658' THEN 'Charges diverses de gestion'
    WHEN '661' THEN 'Remunerations (SYSCOHADA)'
    WHEN '681' THEN 'Dotations aux amortissements'
    WHEN '700' THEN 'Ventes de marchandises'
    WHEN '701' THEN 'Ventes de produits finis'
    WHEN '702' THEN 'Ventes de produits intermediaires'
    WHEN '706' THEN 'Prestations de services'
    WHEN '7061' THEN 'Prestations de services (PCMN)'
    ELSE 'Compte ' || p_account_code
  END;

  INSERT INTO accounting_chart_of_accounts
    (id, user_id, company_id, account_code, account_name, account_type)
  VALUES
    (gen_random_uuid(), p_user_id, p_company_id, p_account_code, v_name, v_type);
END;
$fn$;

UPDATE public.accounting_chart_of_accounts coa
SET account_name = CASE
  WHEN c.country = 'FR' THEN 'Variation des stocks (approvisionnements et marchandises)'
  WHEN c.country = 'BE' THEN 'Variations des stocks de biens achetes'
  ELSE 'Variations des stocks de biens achetes'
END
FROM public.company c
WHERE coa.company_id = c.id
  AND coa.account_code = '603'
  AND COALESCE(coa.account_name, '') IN ('', 'Compte 603');

WITH demo_service_products AS (
  SELECT p.id
  FROM public.products p
  JOIN public.company c ON c.id = p.company_id
  WHERE c.company_name ILIKE 'CashPilot Demo %'
    AND p.product_name = ANY (ARRAY[
      'Licence CRM Pro',
      'Pack Formation 10h',
      'Module Analytics',
      'Support Premium 6 mois',
      'Passerelle API',
      'Suite Securite',
      'Backup Cloud Annuel',
      'CRM Pro License',
      'Training Pack 10h',
      'Analytics Module',
      'Premium Support 6M',
      'API Gateway',
      'Security Suite',
      'Annual Cloud Backup'
    ])
)
DELETE FROM public.accounting_entries ae
USING demo_service_products dsp
WHERE ae.source_type = 'stock_movement'
  AND ae.source_id = dsp.id
  AND ae.is_auto = TRUE;

WITH demo_service_products AS (
  SELECT p.id
  FROM public.products p
  JOIN public.company c ON c.id = p.company_id
  WHERE c.company_name ILIKE 'CashPilot Demo %'
    AND p.product_name = ANY (ARRAY[
      'Licence CRM Pro',
      'Pack Formation 10h',
      'Module Analytics',
      'Support Premium 6 mois',
      'Passerelle API',
      'Suite Securite',
      'Backup Cloud Annuel',
      'CRM Pro License',
      'Training Pack 10h',
      'Analytics Module',
      'Premium Support 6M',
      'API Gateway',
      'Security Suite',
      'Annual Cloud Backup'
    ])
)
DELETE FROM public.accounting_audit_log aal
USING demo_service_products dsp
WHERE aal.source_table = 'products'
  AND aal.source_id = dsp.id
  AND aal.event_type = 'auto_journal';

WITH demo_service_products AS (
  SELECT p.id
  FROM public.products p
  JOIN public.company c ON c.id = p.company_id
  WHERE c.company_name ILIKE 'CashPilot Demo %'
    AND p.product_name = ANY (ARRAY[
      'Licence CRM Pro',
      'Pack Formation 10h',
      'Module Analytics',
      'Support Premium 6 mois',
      'Passerelle API',
      'Suite Securite',
      'Backup Cloud Annuel',
      'CRM Pro License',
      'Training Pack 10h',
      'Analytics Module',
      'Premium Support 6M',
      'API Gateway',
      'Security Suite',
      'Annual Cloud Backup'
    ])
)
DELETE FROM public.product_stock_history psh
USING demo_service_products dsp
WHERE COALESCE(psh.product_id, psh.user_product_id) = dsp.id;

WITH demo_service_products AS (
  SELECT p.id
  FROM public.products p
  JOIN public.company c ON c.id = p.company_id
  WHERE c.company_name ILIKE 'CashPilot Demo %'
    AND p.product_name = ANY (ARRAY[
      'Licence CRM Pro',
      'Pack Formation 10h',
      'Module Analytics',
      'Support Premium 6 mois',
      'Passerelle API',
      'Suite Securite',
      'Backup Cloud Annuel',
      'CRM Pro License',
      'Training Pack 10h',
      'Analytics Module',
      'Premium Support 6M',
      'API Gateway',
      'Security Suite',
      'Annual Cloud Backup'
    ])
)
DELETE FROM public.stock_alerts sa
USING demo_service_products dsp
WHERE COALESCE(sa.product_id, sa.user_product_id) = dsp.id;

WITH demo_service_products AS (
  SELECT p.id
  FROM public.products p
  JOIN public.company c ON c.id = p.company_id
  WHERE c.company_name ILIKE 'CashPilot Demo %'
    AND p.product_name = ANY (ARRAY[
      'Licence CRM Pro',
      'Pack Formation 10h',
      'Module Analytics',
      'Support Premium 6 mois',
      'Passerelle API',
      'Suite Securite',
      'Backup Cloud Annuel',
      'CRM Pro License',
      'Training Pack 10h',
      'Analytics Module',
      'Premium Support 6M',
      'API Gateway',
      'Security Suite',
      'Annual Cloud Backup'
    ])
)
UPDATE public.products p
SET inventory_tracking_enabled = FALSE,
    stock_quantity = 0,
    min_stock_level = 0
FROM demo_service_products dsp
WHERE p.id = dsp.id;
