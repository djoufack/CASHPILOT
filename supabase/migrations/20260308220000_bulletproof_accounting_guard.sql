-- ============================================================================
-- BULLETPROOF ACCOUNTING INFRASTRUCTURE
-- 1. ensure_account_exists() — auto-create missing accounts on demand
-- 2. validate_accounting_entry() — auto-create instead of RAISE WARNING
-- 3. Fix auto_journal_supplier_invoice() column name mismatches
-- 4. Pre-seed comprehensive chart of accounts for ALL companies
-- ============================================================================

-- ============================================================================
-- 1. ensure_account_exists() — create account if missing
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_account_exists(
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

  INSERT INTO accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type)
  VALUES (gen_random_uuid(), p_user_id, p_account_code, v_name, v_type);
END;
$fn$;
-- ============================================================================
-- 2. Replace validate_accounting_entry — auto-create instead of WARNING
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_accounting_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.debit, 0) < 0 OR COALESCE(NEW.credit, 0) < 0 THEN
    RAISE EXCEPTION 'Montants negatifs interdits (debit: %, credit: %)', NEW.debit, NEW.credit;
  END IF;

  IF COALESCE(NEW.debit, 0) > 0 AND COALESCE(NEW.credit, 0) > 0 THEN
    RAISE EXCEPTION 'Une ligne ne peut pas avoir a la fois un debit (%) et un credit (%) > 0', NEW.debit, NEW.credit;
  END IF;

  IF NEW.entry_ref IS NOT NULL AND EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE user_id = NEW.user_id
      AND entry_ref = NEW.entry_ref
      AND account_code = NEW.account_code
      AND transaction_date = NEW.transaction_date
      AND COALESCE(debit, 0) = COALESCE(NEW.debit, 0)
      AND COALESCE(credit, 0) = COALESCE(NEW.credit, 0)
  ) THEN
    RAISE EXCEPTION 'Ecriture doublon detectee (ref: %, compte: %, date: %)',
      NEW.entry_ref, NEW.account_code, NEW.transaction_date;
  END IF;

  -- AUTO-CREATE missing accounts instead of just warning
  IF NEW.account_code IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM accounting_chart_of_accounts
    WHERE user_id = NEW.user_id AND account_code = NEW.account_code
  ) THEN
    PERFORM ensure_account_exists(NEW.user_id, NEW.company_id, NEW.account_code);
  END IF;

  RETURN NEW;
END;
$$;
-- ============================================================================
-- 3. Fix auto_journal_supplier_invoice — use correct column names
--    Table has: total_ht, vat_amount, total_ttc (not amount_ht, tax_amount)
--    Table may not have user_id — resolve from supplier
-- ============================================================================

-- MUST replace trigger function FIRST (before any UPDATE on supplier_invoices
-- which would fire the old trigger referencing non-existent 'amount_ht' column)
CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  -- Resolve user_id: direct column or via supplier
  v_user_id := COALESCE(NEW.user_id, (SELECT user_id FROM suppliers WHERE id = NEW.supplier_id));
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

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
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Facture fournisseur - ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'TVA deductible - SINV ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      IF v_total_ttc > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (v_user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_total_ttc, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Dette fournisseur - ' || COALESCE(NEW.invoice_number, ''));
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

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (v_user_id, CURRENT_DATE, v_supplier_code, v_total_ttc, 0, 'supplier_invoice_payment', NEW.id, 'BQ', 'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Reglement fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (v_user_id, CURRENT_DATE, v_bank_code, 0, v_total_ttc, 'supplier_invoice_payment', NEW.id, 'BQ', 'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Paiement fournisseur - ' || COALESCE(NEW.invoice_number, ''));
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- Now safe to modify supplier_invoices table (trigger function is updated)
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE supplier_invoices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
-- Backfill user_id from suppliers if NULL
UPDATE supplier_invoices si
SET user_id = s.user_id
FROM suppliers s
WHERE s.id = si.supplier_id AND si.user_id IS NULL;
-- Trigger to auto-set user_id on INSERT
CREATE OR REPLACE FUNCTION assign_supplier_invoice_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id FROM suppliers WHERE id = NEW.supplier_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_supplier_invoice_user_id ON supplier_invoices;
CREATE TRIGGER trg_assign_supplier_invoice_user_id
  BEFORE INSERT ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION assign_supplier_invoice_user_id();
-- ============================================================================
-- 4. Pre-seed chart of accounts for ALL companies (FR / BE / OHADA)
-- ============================================================================

-- FR companies: PCG accounts
INSERT INTO accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type)
SELECT gen_random_uuid(), c.user_id, v.code, v.name, v.atype
FROM company c
CROSS JOIN (VALUES
  ('411','Clients','asset'),('401','Fournisseurs','liability'),
  ('512','Banque','asset'),('530','Caisse','asset'),('5112','Cheques a encaisser','asset'),
  ('44571','TVA collectee','liability'),('44566','TVA deductible sur ABS','asset'),
  ('701','Ventes de produits finis','revenue'),('706','Prestations de services','revenue'),
  ('601','Achats de matieres premieres','expense'),
  ('618','Divers services exterieurs','expense'),('641','Remunerations du personnel','expense'),
  ('6064','Fournitures de bureau','expense'),('6251','Voyages et deplacements','expense'),
  ('6257','Frais de reception','expense'),('6241','Transports de biens','expense'),
  ('6116','Sous-traitance logicielle','expense'),('6063','Fournitures informatiques','expense'),
  ('6231','Publicite et marketing','expense'),('6226','Honoraires','expense'),
  ('616','Assurances','expense'),('6132','Locations immobilieres','expense'),
  ('6061','Fournitures non stockables','expense'),('626','Telecommunications','expense'),
  ('6333','Formation du personnel','expense'),('635','Impots et taxes','expense'),
  ('615','Entretien et reparations','expense'),('627','Frais bancaires','expense'),
  ('681','Dotations aux amortissements','expense'),('658','Charges diverses de gestion','expense')
) AS v(code, name, atype)
WHERE c.user_id = 'a6985aad-8ae5-21d1-a773-511d32b71b24'
ON CONFLICT (user_id, account_code) DO NOTHING;
-- BE companies: PCMN accounts
INSERT INTO accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type)
SELECT gen_random_uuid(), c.user_id, v.code, v.name, v.atype
FROM company c
CROSS JOIN (VALUES
  ('400','Clients','asset'),('440','Fournisseurs','liability'),
  ('550','Banque','asset'),('570','Caisse','asset'),
  ('4510','TVA a payer','liability'),('4110','TVA deductible','asset'),
  ('700','Ventes de marchandises','revenue'),('701','Ventes de produits','revenue'),
  ('7061','Prestations de services','revenue'),
  ('601','Achats de matieres premieres','expense'),
  ('6180','Divers services exterieurs','expense'),('620','Remunerations','expense'),
  ('6064','Fournitures de bureau','expense'),('6251','Voyages et deplacements','expense'),
  ('6257','Frais de reception','expense'),('6241','Transports de biens','expense'),
  ('6116','Sous-traitance logicielle','expense'),('6063','Fournitures informatiques','expense'),
  ('6231','Publicite et marketing','expense'),('6226','Honoraires','expense'),
  ('616','Assurances','expense'),('6132','Locations immobilieres','expense'),
  ('6061','Fournitures non stockables','expense'),('626','Telecommunications','expense'),
  ('6333','Formation du personnel','expense'),('635','Impots et taxes','expense'),
  ('615','Entretien et reparations','expense'),('627','Frais bancaires','expense'),
  ('630','Amortissements','expense'),('658','Charges diverses de gestion','expense')
) AS v(code, name, atype)
WHERE c.user_id = 'e3b36145-b3ab-bab9-4101-68b5fe900811'
ON CONFLICT (user_id, account_code) DO NOTHING;
-- OHADA companies: SYSCOHADA accounts
INSERT INTO accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type)
SELECT gen_random_uuid(), c.user_id, v.code, v.name, v.atype
FROM company c
CROSS JOIN (VALUES
  ('411','Clients','asset'),('401','Fournisseurs','liability'),
  ('521','Banque','asset'),('571','Caisse','asset'),('513','Cheques','asset'),
  ('4431','TVA facturee','liability'),('4452','TVA recuperable','asset'),
  ('701','Ventes de produits finis','revenue'),('702','Ventes produits intermediaires','revenue'),
  ('706','Prestations de services','revenue'),
  ('601','Achats de matieres premieres','expense'),
  ('638','Charges diverses','expense'),('661','Remunerations','expense'),
  ('6053','Fournitures de bureau','expense'),('6371','Voyages et deplacements','expense'),
  ('636','Frais de restauration','expense'),('618','Divers services exterieurs','expense'),
  ('634','Logiciels et licences','expense'),('6054','Fournitures informatiques','expense'),
  ('627','Publicite','expense'),('6324','Honoraires','expense'),
  ('625','Assurances','expense'),('6222','Loyers','expense'),
  ('6051','Fournitures non stockables','expense'),('628','Telecommunications','expense'),
  ('633','Formation','expense'),('646','Impots et taxes','expense'),
  ('6155','Entretien materiel','expense'),('631','Frais bancaires','expense'),
  ('681','Dotations aux amortissements','expense'),('658','Charges diverses de gestion','expense')
) AS v(code, name, atype)
WHERE c.user_id = 'eb70d17b-9562-59ed-f783-89327e65a7c1'
ON CONFLICT (user_id, account_code) DO NOTHING;
