-- ============================================================================
-- Fix invoice auto-journal rounding and backfill missing accounting categories
-- Date: 2026-03-09
--
-- 1. Use invoice_items.total as the canonical HT source for revenue splits
-- 2. Reconcile the last revenue line so every invoice journal balances to total_ht
-- 3. Auto-assign meaningful account_category values for newly created accounts
-- 4. Backfill missing categories for demo pilotage users
-- 5. Rebuild existing auto-generated invoice sales journals with the corrected logic
-- ============================================================================

CREATE OR REPLACE FUNCTION public.infer_account_category(
  p_account_code text,
  p_account_name text DEFAULT NULL,
  p_account_type text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
  v_code text := COALESCE(BTRIM(p_account_code), '');
  v_name text := LOWER(COALESCE(p_account_name, ''));
  v_type text := LOWER(COALESCE(p_account_type, ''));
BEGIN
  IF v_code = '' AND v_name = '' THEN
    RETURN NULL;
  END IF;

  IF v_code ~ '^5' OR v_name ~ '(banque|bank|cash|caisse|tresorerie)' THEN
    RETURN 'cash';
  END IF;

  IF v_code ~ '^41' OR v_name ~ '(client|customer|receivable|creance|debiteur)' THEN
    RETURN 'creances_clients';
  END IF;

  IF v_code ~ '^(40|440)' OR v_name ~ '(fournisseur|supplier|vendor|trade payable|dettes? commerciales?)' THEN
    RETURN 'dettes_fournisseurs';
  END IF;

  IF v_code ~ '^(445|451|443|44)' OR v_name ~ '(tva|vat|tax|fiscal|impot|etat|urssaf|social)' THEN
    RETURN 'dettes_fiscales';
  END IF;

  IF v_code ~ '^(16|17|18|42|43)' OR v_name ~ '(emprunt|loan|borrow|credit-bail|credit bail|financial debt|dette financiere|dettes financieres|financement)' THEN
    RETURN 'dettes_financieres';
  END IF;

  IF v_code ~ '^1' OR v_name ~ '(capital|reserve|prime|report a nouveau|report)' THEN
    RETURN 'capital';
  END IF;

  IF v_code ~ '^3' OR v_name ~ '(stock|inventory|marchandise|matiere|en-cours)' THEN
    RETURN 'stocks';
  END IF;

  IF v_code ~ '^[23]' OR v_name ~ '(immobil|fixed asset|property|plant|equipment|materiel|logiciel|software)' THEN
    RETURN 'immobilisations';
  END IF;

  IF v_code ~ '^70' THEN
    RETURN 'ventes';
  END IF;

  IF v_code ~ '^(71|72|73|74|75)' THEN
    RETURN 'produits';
  END IF;

  IF v_code ~ '^76' THEN
    RETURN 'produits_financiers';
  END IF;

  IF v_code ~ '^(77|82|84)' THEN
    RETURN 'hao';
  END IF;

  IF v_code ~ '^(78|86)' THEN
    RETURN 'reprises';
  END IF;

  IF v_code ~ '^79' THEN
    RETURN 'transferts';
  END IF;

  IF v_code ~ '^66' OR v_name ~ '(interet|interest|escompte|change|financ)' THEN
    RETURN 'charges_financieres';
  END IF;

  IF v_code ~ '^(68|69)' OR v_name ~ '(amort|depreci|dotation|provision)' THEN
    RETURN 'dotations';
  END IF;

  IF v_code ~ '^64' OR v_name ~ '(personnel|salary|salaire|wage|payroll|remuneration)' THEN
    RETURN 'charges_personnel';
  END IF;

  IF v_code ~ '^(63|635|646)' OR v_name ~ '(impot|taxe|fiscal)' THEN
    RETURN 'impots_taxes';
  END IF;

  IF v_code ~ '^60' THEN
    RETURN 'achats';
  END IF;

  IF v_code ~ '^(61|62)' OR v_name ~ '(loyer|honoraire|telecom|assurance|entretien|service)' THEN
    RETURN 'services_exterieurs';
  END IF;

  IF v_code ~ '^65' THEN
    RETURN 'autres_charges';
  END IF;

  IF v_type = 'revenue' THEN
    RETURN 'produits';
  END IF;

  IF v_type = 'expense' THEN
    RETURN 'autres_charges';
  END IF;

  RETURN NULL;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.ensure_account_exists(
  p_user_id uuid,
  p_company_id uuid,
  p_account_code text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_name text;
  v_type text;
  v_category text;
BEGIN
  IF p_account_code IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM accounting_chart_of_accounts
    WHERE user_id = p_user_id
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

  v_category := public.infer_account_category(p_account_code, v_name, v_type);

  INSERT INTO accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type, account_category)
  VALUES (gen_random_uuid(), p_user_id, p_account_code, v_name, v_type, v_category);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.insert_invoice_sales_entries(
  p_invoice invoices,
  p_company_id uuid,
  p_entry_ref text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  rec record;
  v_revenue_code text;
  v_inserted_total numeric := 0;
  v_effective_total_ht numeric := ROUND(COALESCE(p_invoice.total_ht, 0)::numeric, 2);
  v_line_total numeric;
BEGIN
  FOR rec IN
    WITH grouped_items AS (
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
        ROUND(SUM(COALESCE(total, quantity * unit_price, 0))::numeric, 2) AS line_total
      FROM invoice_items
      WHERE invoice_id = p_invoice.id
      GROUP BY 1, 2
    ), ranked_groups AS (
      SELECT
        revenue_key,
        desc_prefix,
        line_total,
        ROW_NUMBER() OVER (ORDER BY revenue_key, desc_prefix) AS line_rank,
        COUNT(*) OVER () AS line_count
      FROM grouped_items
      WHERE line_total > 0
    )
    SELECT *
    FROM ranked_groups
    ORDER BY line_rank
  LOOP
    v_line_total := CASE
      WHEN rec.line_rank < rec.line_count THEN rec.line_total
      ELSE ROUND(v_effective_total_ht - v_inserted_total, 2)
    END;

    IF v_line_total <= 0 THEN
      CONTINUE;
    END IF;

    v_revenue_code := get_user_account_code(p_invoice.user_id, rec.revenue_key);
    PERFORM ensure_account_exists(p_invoice.user_id, p_company_id, v_revenue_code);

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_invoice.user_id, p_company_id, COALESCE(p_invoice.date, CURRENT_DATE),
      v_revenue_code, 0, v_line_total,
      'invoice', p_invoice.id, 'VE', p_entry_ref, true,
      rec.desc_prefix || ' - ' || COALESCE(p_invoice.invoice_number, '')
    );

    v_inserted_total := v_inserted_total + v_line_total;
  END LOOP;

  IF v_inserted_total = 0 AND v_effective_total_ht > 0 THEN
    v_revenue_code := get_user_account_code(p_invoice.user_id, 'revenue');
    PERFORM ensure_account_exists(p_invoice.user_id, p_company_id, v_revenue_code);

    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_invoice.user_id, p_company_id, COALESCE(p_invoice.date, CURRENT_DATE),
      v_revenue_code, 0, v_effective_total_ht,
      'invoice', p_invoice.id, 'VE', p_entry_ref, true,
      'Vente HT - ' || COALESCE(p_invoice.invoice_number, '')
    );
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.insert_invoice_journal_entries(
  p_invoice invoices
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_client_code text;
  v_vat_code text;
  v_ref text;
  v_tva numeric;
  v_company_id uuid;
BEGIN
  v_company_id := COALESCE(p_invoice.company_id, resolve_preferred_company_id(p_invoice.user_id));
  v_client_code := get_user_account_code(p_invoice.user_id, 'client');
  v_vat_code := get_user_account_code(p_invoice.user_id, 'vat_output');
  v_ref := 'INV-' || COALESCE(p_invoice.invoice_number, p_invoice.id::text);
  v_tva := ROUND((COALESCE(p_invoice.total_ttc, 0) - COALESCE(p_invoice.total_ht, 0))::numeric, 2);

  PERFORM ensure_account_exists(p_invoice.user_id, v_company_id, v_client_code);
  PERFORM ensure_account_exists(p_invoice.user_id, v_company_id, v_vat_code);

  INSERT INTO accounting_entries (
    user_id, company_id, transaction_date, account_code, debit, credit,
    source_type, source_id, journal, entry_ref, is_auto, description
  ) VALUES (
    p_invoice.user_id, v_company_id, COALESCE(p_invoice.date, CURRENT_DATE),
    v_client_code, COALESCE(p_invoice.total_ttc, 0), 0,
    'invoice', p_invoice.id, 'VE', v_ref, true,
    'Facture ' || COALESCE(p_invoice.invoice_number, '')
  );

  PERFORM public.insert_invoice_sales_entries(p_invoice, v_company_id, v_ref);

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (
      user_id, company_id, transaction_date, account_code, debit, credit,
      source_type, source_id, journal, entry_ref, is_auto, description
    ) VALUES (
      p_invoice.user_id, v_company_id, COALESCE(p_invoice.date, CURRENT_DATE),
      v_vat_code, 0, v_tva,
      'invoice', p_invoice.id, 'VE', v_ref, true,
      'TVA collectee - ' || COALESCE(p_invoice.invoice_number, '')
    );
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.rebuild_auto_invoice_entries(
  p_user_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  rec invoices%ROWTYPE;
  v_rebuilt_count integer := 0;
BEGIN
  DELETE FROM accounting_entries
  WHERE source_type = 'invoice'
    AND journal = 'VE'
    AND is_auto = true
    AND (p_user_id IS NULL OR user_id = p_user_id);

  FOR rec IN
    SELECT i.*
    FROM invoices i
    LEFT JOIN user_accounting_settings uas ON uas.user_id = i.user_id
    WHERE i.status IS NOT NULL
      AND i.status NOT IN ('draft', 'cancelled')
      AND COALESCE(uas.auto_journal_enabled, true) = true
      AND (p_user_id IS NULL OR i.user_id = p_user_id)
    ORDER BY COALESCE(i.date, CURRENT_DATE), i.created_at, i.id
  LOOP
    PERFORM public.insert_invoice_journal_entries(rec);
    v_rebuilt_count := v_rebuilt_count + 1;
  END LOOP;

  RETURN v_rebuilt_count;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.auto_journal_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_code text;
  v_bank_code text;
  v_company_id uuid;
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
      PERFORM public.insert_invoice_journal_entries(NEW);
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
      FROM payments p
      WHERE p.invoice_id = NEW.id
      ORDER BY p.created_at DESC
      LIMIT 1;

      v_bank_code := get_payment_account_code(NEW.user_id, COALESCE(v_bank_code, 'bank_transfer'));
      v_client_code := get_user_account_code(NEW.user_id, 'client');

      PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_bank_code);
      PERFORM ensure_account_exists(NEW.user_id, v_company_id, v_client_code);

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, CURRENT_DATE,
        v_bank_code, COALESCE(NEW.total_ttc, 0), 0,
        'invoice_payment', NEW.id, 'BQ', 'PAY-INV-' || COALESCE(NEW.invoice_number, NEW.id::text), true,
        'Encaissement facture ' || COALESCE(NEW.invoice_number, '')
      );

      INSERT INTO accounting_entries (
        user_id, company_id, transaction_date, account_code, debit, credit,
        source_type, source_id, journal, entry_ref, is_auto, description
      ) VALUES (
        NEW.user_id, v_company_id, CURRENT_DATE,
        v_client_code, 0, COALESCE(NEW.total_ttc, 0),
        'invoice_payment', NEW.id, 'BQ', 'PAY-INV-' || COALESCE(NEW.invoice_number, NEW.id::text), true,
        'Encaissement client - ' || COALESCE(NEW.invoice_number, '')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

UPDATE accounting_chart_of_accounts coa
SET account_category = public.infer_account_category(coa.account_code, coa.account_name, coa.account_type)
WHERE COALESCE(BTRIM(coa.account_category), '') = ''
  AND public.infer_account_category(coa.account_code, coa.account_name, coa.account_type) IS NOT NULL
  AND coa.user_id IN (
    SELECT id
    FROM auth.users
    WHERE email LIKE 'pilotage.%.demo@cashpilot.cloud'
  );

SELECT public.rebuild_auto_invoice_entries();