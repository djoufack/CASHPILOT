-- ============================================================================
-- Migration 040: Auto-Accounting — Trigger pour factures fournisseurs
-- ============================================================================
-- ENF-3: Toute opération financière DOIT être journalisée automatiquement.
-- BUG-P001: Aucun trigger auto_journal n'existait pour supplier_invoices.
-- Ce patch crée auto_journal_supplier_invoice() + son déclencheur.
--
-- Logique comptable :
--   À la RÉCEPTION d'une facture fournisseur (INSERT ou passage status→received/validated/approved) :
--     Débit  : Compte de charge achat (601/607 FR, 601 BE, 601/607 OHADA)
--     Débit  : TVA déductible si vat_amount > 0 (44566 FR, 4110 BE, 4452 OHADA)
--     Crédit : Compte fournisseur (401 FR, 440 BE, 401 OHADA)
--
--   Quand la facture est marquée PAID (payment_status → paid) :
--     Débit  : Compte fournisseur (401/440)
--     Crédit : Banque (512/550/521)
--
-- Idempotence : vérification EXISTS avant insertion pour éviter les doublons.
-- ============================================================================

-- ===========================
-- A. Enrichir get_user_account_code avec purchase / supplier_invoice codes
-- ===========================
CREATE OR REPLACE FUNCTION get_user_account_code(
  p_user_id UUID,
  p_mapping_key TEXT,
  p_source_category TEXT DEFAULT 'general'
) RETURNS TEXT AS $$
DECLARE
  v_country TEXT;
  v_custom_code TEXT;
BEGIN
  -- Get user country (uses user_accounting_settings, company country as secondary)
  SELECT COALESCE(uas.country, c.country, 'BE')
  INTO v_country
  FROM user_accounting_settings uas
  LEFT JOIN company c ON c.user_id = uas.user_id
  WHERE uas.user_id = p_user_id
  LIMIT 1;

  IF v_country IS NULL THEN
    -- Fallback: lookup directly from company
    SELECT COALESCE(country, 'BE') INTO v_country
    FROM company
    WHERE user_id = p_user_id
    LIMIT 1;
  END IF;

  IF v_country IS NULL THEN
    v_country := 'BE';
  END IF;

  -- Check custom mapping first
  SELECT debit_account_code INTO v_custom_code
  FROM accounting_mappings
  WHERE user_id = p_user_id
    AND source_type = SPLIT_PART(p_mapping_key, '.', 1)
    AND source_category = CASE
      WHEN POSITION('.' IN p_mapping_key) > 0 THEN SPLIT_PART(p_mapping_key, '.', 2)
      ELSE p_source_category
    END
  LIMIT 1;

  IF v_custom_code IS NOT NULL THEN
    RETURN v_custom_code;
  END IF;

  -- Default account codes by country (PCG France / PCMN Belgique / SYSCOHADA)
  RETURN CASE p_mapping_key
    -- Client accounts (créances clients)
    WHEN 'client' THEN CASE
      WHEN v_country = 'FR' THEN '411'
      WHEN v_country = 'OHADA' THEN '411'
      ELSE '400' END
    -- Revenue accounts
    WHEN 'revenue' THEN CASE
      WHEN v_country = 'FR' THEN '701'
      WHEN v_country = 'OHADA' THEN '701'
      ELSE '700' END
    WHEN 'revenue.service' THEN CASE
      WHEN v_country = 'FR' THEN '706'
      WHEN v_country = 'OHADA' THEN '706'
      ELSE '7061' END
    WHEN 'revenue.product' THEN CASE
      WHEN v_country = 'FR' THEN '701'
      WHEN v_country = 'OHADA' THEN '702'
      ELSE '701' END
    -- Bank accounts
    WHEN 'bank' THEN CASE
      WHEN v_country = 'FR' THEN '512'
      WHEN v_country = 'OHADA' THEN '521'
      ELSE '550' END
    -- Cash accounts
    WHEN 'cash' THEN CASE
      WHEN v_country = 'FR' THEN '530'
      WHEN v_country = 'OHADA' THEN '571'
      ELSE '570' END
    -- VAT accounts
    WHEN 'vat_output' THEN CASE
      WHEN v_country = 'FR' THEN '44571'
      WHEN v_country = 'OHADA' THEN '4431'
      ELSE '4510' END
    WHEN 'vat_input' THEN CASE
      WHEN v_country = 'FR' THEN '44566'
      WHEN v_country = 'OHADA' THEN '4452'
      ELSE '4110' END
    -- Supplier accounts (dettes fournisseurs)
    WHEN 'supplier' THEN CASE
      WHEN v_country = 'FR' THEN '401'
      WHEN v_country = 'OHADA' THEN '401'
      ELSE '440' END
    -- Purchase accounts (achats marchandises/services)
    WHEN 'purchase' THEN CASE
      WHEN v_country = 'FR' THEN '607'
      WHEN v_country = 'OHADA' THEN '607'
      ELSE '604' END
    WHEN 'purchase.goods' THEN CASE
      WHEN v_country = 'FR' THEN '607'
      WHEN v_country = 'OHADA' THEN '601'
      ELSE '604' END
    WHEN 'purchase.services' THEN CASE
      WHEN v_country = 'FR' THEN '604'
      WHEN v_country = 'OHADA' THEN '611'
      ELSE '6100' END
    WHEN 'purchase.supplies' THEN CASE
      WHEN v_country = 'FR' THEN '602'
      WHEN v_country = 'OHADA' THEN '602'
      ELSE '602' END
    -- Expense accounts by category
    WHEN 'expense.general' THEN CASE
      WHEN v_country = 'OHADA' THEN '638'
      WHEN v_country = 'FR' THEN '618'
      ELSE '6180' END
    WHEN 'expense.office' THEN CASE
      WHEN v_country = 'OHADA' THEN '6053'
      WHEN v_country = 'FR' THEN '6064'
      ELSE '6064' END
    WHEN 'expense.travel' THEN CASE
      WHEN v_country = 'OHADA' THEN '6371'
      WHEN v_country = 'FR' THEN '6251'
      ELSE '6251' END
    WHEN 'expense.meals' THEN CASE
      WHEN v_country = 'OHADA' THEN '636'
      WHEN v_country = 'FR' THEN '6257'
      ELSE '6257' END
    WHEN 'expense.transport' THEN CASE
      WHEN v_country = 'OHADA' THEN '618'
      WHEN v_country = 'FR' THEN '6241'
      ELSE '6241' END
    WHEN 'expense.software' THEN CASE
      WHEN v_country = 'OHADA' THEN '634'
      WHEN v_country = 'FR' THEN '6116'
      ELSE '6116' END
    WHEN 'expense.hardware' THEN CASE
      WHEN v_country = 'OHADA' THEN '6054'
      WHEN v_country = 'FR' THEN '6063'
      ELSE '6063' END
    WHEN 'expense.marketing' THEN CASE
      WHEN v_country = 'OHADA' THEN '627'
      WHEN v_country = 'FR' THEN '6231'
      ELSE '6231' END
    WHEN 'expense.legal' THEN CASE
      WHEN v_country = 'OHADA' THEN '6324'
      WHEN v_country = 'FR' THEN '6226'
      ELSE '6226' END
    WHEN 'expense.insurance' THEN CASE
      WHEN v_country = 'OHADA' THEN '625'
      WHEN v_country = 'FR' THEN '616'
      ELSE '616' END
    WHEN 'expense.rent' THEN CASE
      WHEN v_country = 'OHADA' THEN '6222'
      WHEN v_country = 'FR' THEN '6132'
      ELSE '6132' END
    WHEN 'expense.utilities' THEN CASE
      WHEN v_country = 'OHADA' THEN '6051'
      WHEN v_country = 'FR' THEN '6061'
      ELSE '6061' END
    WHEN 'expense.telecom' THEN CASE
      WHEN v_country = 'OHADA' THEN '628'
      WHEN v_country = 'FR' THEN '626'
      ELSE '626' END
    WHEN 'expense.training' THEN CASE
      WHEN v_country = 'OHADA' THEN '633'
      WHEN v_country = 'FR' THEN '6333'
      ELSE '6333' END
    WHEN 'expense.consulting' THEN CASE
      WHEN v_country = 'OHADA' THEN '6324'
      WHEN v_country = 'FR' THEN '6226'
      ELSE '6226' END
    -- BUG-P003 FIX: 'operations' category was in UI but missing from account code lookup
    -- Operations → classe 6 exploitation: FR 615, BE 6150, OHADA 636
    WHEN 'expense.operations' THEN CASE
      WHEN v_country = 'OHADA' THEN '636'
      WHEN v_country = 'FR' THEN '615'
      ELSE '6150' END
    WHEN 'expense.other' THEN CASE
      WHEN v_country = 'OHADA' THEN '658'
      WHEN v_country = 'FR' THEN '658'
      ELSE '658' END
    ELSE '999'
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ===========================
-- B. Trigger function: auto_journal_supplier_invoice
-- ===========================
CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice() RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_enabled BOOLEAN;
  v_purchase_code TEXT;
  v_vat_code TEXT;
  v_supplier_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
  v_txn_date DATE;
BEGIN
  -- Resolve user_id : supplier_invoices may not have user_id directly,
  -- so look it up via the company owning it
  v_user_id := NEW.user_id;
  v_company_id := NEW.company_id;

  IF v_user_id IS NULL AND v_company_id IS NOT NULL THEN
    SELECT user_id INTO v_user_id FROM company WHERE id = v_company_id LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if auto-journaling is enabled for this user
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = v_user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- ===========================================================
  -- PART 1: ACHAT — on INSERT or when status moves to received/validated/approved
  -- Journal entry: Débit Achats + Débit TVA / Crédit Fournisseur
  -- ===========================================================
  IF (TG_OP = 'INSERT')
     OR (TG_OP = 'UPDATE'
         AND (OLD.status IS DISTINCT FROM NEW.status)
         AND NEW.status IN ('received', 'validated', 'approved', 'paid'))
  THEN
    -- Idempotence: skip if purchase entry already exists
    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice'
        AND source_id = NEW.id
        AND journal = 'AC'
        AND debit > 0
        AND user_id = v_user_id
    ) THEN
      v_purchase_code := get_user_account_code(v_user_id, 'purchase');
      v_vat_code      := get_user_account_code(v_user_id, 'vat_input');
      v_supplier_code := get_user_account_code(v_user_id, 'supplier');
      v_ref           := 'SINV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);

      v_amount_ht  := COALESCE(NEW.total_ht, NEW.total_amount, 0);
      v_tva        := COALESCE(NEW.vat_amount, 0);
      v_amount_ttc := COALESCE(NEW.total_ttc, NEW.total_amount, v_amount_ht + v_tva);
      v_txn_date   := COALESCE(NEW.invoice_date, NEW.created_at::date, CURRENT_DATE);

      -- Debit: Purchases account (HT)
      INSERT INTO accounting_entries
        (user_id, company_id, transaction_date, account_code, debit, credit,
         source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES
        (v_user_id, v_company_id, v_txn_date, v_purchase_code, v_amount_ht, 0,
         'supplier_invoice', NEW.id, 'AC', v_ref, true,
         'Achat fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      -- Debit: VAT input (TVA déductible) — only if > 0
      IF v_tva > 0 THEN
        INSERT INTO accounting_entries
          (user_id, company_id, transaction_date, account_code, debit, credit,
           source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES
          (v_user_id, v_company_id, v_txn_date, v_vat_code, v_tva, 0,
           'supplier_invoice', NEW.id, 'AC', v_ref, true,
           'TVA déductible - ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      -- Credit: Supplier account (TTC)
      INSERT INTO accounting_entries
        (user_id, company_id, transaction_date, account_code, debit, credit,
         source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES
        (v_user_id, v_company_id, v_txn_date, v_supplier_code, 0, v_amount_ttc,
         'supplier_invoice', NEW.id, 'AC', v_ref, true,
         'Dette fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      -- Audit log
      INSERT INTO accounting_audit_log (user_id, company_id, action, source_type, source_id, details)
      VALUES (v_user_id, v_company_id, 'auto_journal_supplier_invoice_achat', 'supplier_invoice', NEW.id,
              jsonb_build_object('invoice_number', NEW.invoice_number, 'total_ttc', v_amount_ttc,
                                 'purchase_code', v_purchase_code, 'supplier_code', v_supplier_code));
    END IF;
  END IF;

  -- ===========================================================
  -- PART 2: PAIEMENT — when payment_status moves to 'paid'
  -- Journal entry: Débit Fournisseur / Crédit Banque
  -- ===========================================================
  IF TG_OP = 'UPDATE'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid'
  THEN
    -- Idempotence: skip if payment entry already exists
    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice'
        AND source_id = NEW.id
        AND journal = 'TR'
        AND user_id = v_user_id
    ) THEN
      v_supplier_code := get_user_account_code(v_user_id, 'supplier');
      v_bank_code     := get_user_account_code(v_user_id, 'bank');
      v_ref           := 'PAY-SINV-' || COALESCE(NEW.invoice_number, NEW.id::TEXT);
      v_amount_ttc    := COALESCE(NEW.total_ttc, NEW.total_amount, 0);
      v_txn_date      := CURRENT_DATE;

      -- Debit: Supplier account (apure la dette)
      INSERT INTO accounting_entries
        (user_id, company_id, transaction_date, account_code, debit, credit,
         source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES
        (v_user_id, v_company_id, v_txn_date, v_supplier_code, v_amount_ttc, 0,
         'supplier_invoice', NEW.id, 'TR', v_ref, true,
         'Règlement fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      -- Credit: Bank account
      INSERT INTO accounting_entries
        (user_id, company_id, transaction_date, account_code, debit, credit,
         source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES
        (v_user_id, v_company_id, v_txn_date, v_bank_code, 0, v_amount_ttc,
         'supplier_invoice', NEW.id, 'TR', v_ref, true,
         'Paiement fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      -- Audit log
      INSERT INTO accounting_audit_log (user_id, company_id, action, source_type, source_id, details)
      VALUES (v_user_id, v_company_id, 'auto_journal_supplier_invoice_paiement', 'supplier_invoice', NEW.id,
              jsonb_build_object('invoice_number', NEW.invoice_number, 'total_ttc', v_amount_ttc,
                                 'bank_code', v_bank_code, 'supplier_code', v_supplier_code));
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================
-- C. Create the trigger
-- ===========================
DROP TRIGGER IF EXISTS trg_auto_journal_supplier_invoice ON supplier_invoices;
CREATE TRIGGER trg_auto_journal_supplier_invoice
  AFTER INSERT OR UPDATE ON supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_supplier_invoice();

-- ===========================
-- D. Add company_id to accounting_entries if not present
--    (needed for multi-company portfolio support)
-- ===========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_entries' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE accounting_entries ADD COLUMN company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_accounting_entries_company_id ON accounting_entries(company_id);
  END IF;
END $$;

-- ===========================
-- E. Add company_id to accounting_audit_log if not present
-- ===========================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounting_audit_log' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE accounting_audit_log ADD COLUMN company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON FUNCTION auto_journal_supplier_invoice() IS
  'ENF-3: Journalisation comptable automatique des factures fournisseurs.
   ACHAT: Débit Achats (601/607) + TVA déductible / Crédit Fournisseur (401/440).
   PAIEMENT: Débit Fournisseur / Crédit Banque (512/521/550).
   Idempotent via vérification EXISTS. Supporte PCG France, PCMN Belgique, SYSCOHADA.';
