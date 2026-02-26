# Accounting Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 gaps in the auto-accounting system: supplier_invoices trigger, salary category, payment method split, audit table, balance check, and retroactive backfill.

**Architecture:** 6 incremental SQL migrations (040-045) + 1 MCP tool addition. Migrations 040-043 are independent and can be parallelized. 044 depends on 043, 045 depends on 040+041+042.

**Tech Stack:** PostgreSQL (triggers/functions), TypeScript (MCP tool in mcp-server/src/tools/accounting.ts)

---

### Task 1: Migration 040 — Supplier Invoice Auto-Journal Trigger

**Files:**
- Create: `migrations/040_supplier_invoice_trigger.sql`

**Step 1: Create the migration file**

```sql
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
  -- Check if auto-journaling is enabled
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

  -- === PURCHASE ENTRY: When status becomes received/processed ===
  IF (TG_OP = 'INSERT' AND NEW.status IN ('received', 'processed'))
     OR (TG_OP = 'UPDATE' AND OLD.status IN ('draft') AND NEW.status IN ('received', 'processed')) THEN

    -- Check idempotency
    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'supplier_invoice' AND source_id = NEW.id AND journal = 'AC'
      AND user_id = NEW.user_id
    ) THEN
      v_expense_code := get_user_account_code(NEW.user_id, 'expense.general');
      v_vat_code := get_user_account_code(NEW.user_id, 'vat_input');
      v_supplier_code := get_user_account_code(NEW.user_id, 'supplier');

      -- Debit: Expense account (HT)
      IF v_amount_ht > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Facture fournisseur - ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      -- Debit: VAT input (TVA deductible) — only if > 0
      IF v_tva > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'TVA deductible - SINV ' || COALESCE(NEW.invoice_number, ''));
      END IF;

      -- Credit: Supplier account (TTC)
      IF v_total_ttc > 0 THEN
        INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
        VALUES (NEW.user_id, COALESCE(NEW.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_total_ttc, 'supplier_invoice', NEW.id, 'AC', v_ref, true,
          'Dette fournisseur - ' || COALESCE(NEW.invoice_number, ''));
      END IF;
    END IF;
  END IF;

  -- === PAYMENT ENTRY: When payment_status becomes paid ===
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

      -- Debit: Supplier (solde la dette)
      INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
      VALUES (NEW.user_id, CURRENT_DATE, v_supplier_code, v_total_ttc, 0, 'supplier_invoice_payment', NEW.id, 'BQ', 'SINV-PAY-' || COALESCE(NEW.invoice_number, NEW.id::TEXT), true,
        'Reglement fournisseur - ' || COALESCE(NEW.invoice_number, ''));

      -- Credit: Bank
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

-- B. Reversal function for supplier_invoices
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

  -- On DELETE: reverse all entries
  IF TG_OP = 'DELETE' THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, description, is_auto)
    SELECT OLD.user_id, CURRENT_DATE, account_code, credit AS debit, debit AS credit,
      'supplier_invoice_reversal', OLD.id, 'OD', 'ANN-SINV-' || OLD.id,
      'Annulation facture fournisseur #' || COALESCE(OLD.invoice_number, OLD.id::TEXT), true
    FROM accounting_entries
    WHERE source_type = 'supplier_invoice' AND source_id = OLD.id AND user_id = OLD.user_id;

    RETURN OLD;
  END IF;

  -- On UPDATE to draft/rejected: reverse purchase entries only
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

COMMENT ON FUNCTION auto_journal_supplier_invoice() IS
'Auto-creates accounting entries when a supplier invoice is received/processed or paid';

COMMENT ON FUNCTION reverse_journal_supplier_invoice() IS
'Reverses accounting entries when a supplier invoice is deleted or reverted to draft/rejected';
```

**Step 2: Apply migration to Supabase**

Run via Supabase MCP tool `apply_migration`:
- name: `040_supplier_invoice_trigger`
- project_id: (from list_projects)
- query: contents of the file above

**Step 3: Verify trigger exists**

Run via `execute_sql`:
```sql
SELECT tgname, tgtype FROM pg_trigger WHERE tgrelid = 'supplier_invoices'::regclass;
```
Expected: `trg_auto_journal_supplier_invoice`, `trg_reverse_supplier_invoice_on_delete`, `trg_reverse_supplier_invoice_on_cancel`

**Step 4: Commit**

```bash
git add migrations/040_supplier_invoice_trigger.sql
git commit -m "feat(accounting): add auto-journal trigger for supplier_invoices"
```

---

### Task 2: Migration 041 — Salary Category Mappings

**Files:**
- Create: `migrations/041_salary_category.sql`

**Step 1: Create the migration file**

This migration adds salary.brut, salary.charges_sociales, salary.net to `get_user_account_code()`. We must preserve ALL existing mappings from migration 020 (the latest version) and add the new salary entries.

```sql
-- ============================================================================
-- Migration 041: Add salary category to get_user_account_code
-- ============================================================================
-- Adds: salary.brut (621x), salary.charges_sociales (645x/431x),
--        salary.net (453x/421/422)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_account_code(
  p_user_id UUID,
  p_mapping_key TEXT,
  p_source_category TEXT DEFAULT 'general'
) RETURNS TEXT AS $$
DECLARE
  v_country TEXT;
  v_custom_code TEXT;
BEGIN
  SELECT country INTO v_country
  FROM user_accounting_settings
  WHERE user_id = p_user_id;

  IF v_country IS NULL THEN
    v_country := 'BE';
  END IF;

  -- Check custom mapping first (fix from migration 020)
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

  RETURN CASE p_mapping_key
    -- Client accounts
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
    -- Check accounts (NEW)
    WHEN 'check' THEN CASE
      WHEN v_country = 'FR' THEN '5112'
      WHEN v_country = 'OHADA' THEN '513'
      ELSE '511' END
    -- VAT accounts
    WHEN 'vat_output' THEN CASE
      WHEN v_country = 'FR' THEN '44571'
      WHEN v_country = 'OHADA' THEN '4431'
      ELSE '4510' END
    WHEN 'vat_input' THEN CASE
      WHEN v_country = 'FR' THEN '44566'
      WHEN v_country = 'OHADA' THEN '4452'
      ELSE '4110' END
    -- Supplier accounts
    WHEN 'supplier' THEN CASE
      WHEN v_country = 'FR' THEN '401'
      WHEN v_country = 'OHADA' THEN '401'
      ELSE '440' END
    -- ==================== SALARY (NEW) ====================
    WHEN 'salary.brut' THEN CASE
      WHEN v_country = 'FR' THEN '6411'
      WHEN v_country = 'OHADA' THEN '661'
      ELSE '6210' END
    WHEN 'salary.charges_sociales' THEN CASE
      WHEN v_country = 'FR' THEN '6451'
      WHEN v_country = 'OHADA' THEN '664'
      ELSE '6211' END
    WHEN 'salary.net' THEN CASE
      WHEN v_country = 'FR' THEN '421'
      WHEN v_country = 'OHADA' THEN '422'
      ELSE '4530' END
    -- ==================== EXPENSE BY CATEGORY ====================
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
    WHEN 'expense.salary' THEN CASE
      WHEN v_country = 'OHADA' THEN '661'
      WHEN v_country = 'FR' THEN '6411'
      ELSE '6210' END
    WHEN 'expense.other' THEN CASE
      WHEN v_country = 'OHADA' THEN '658'
      WHEN v_country = 'FR' THEN '658'
      ELSE '658' END
    ELSE '999'
  END;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Step 2: Apply migration to Supabase**

Run via `apply_migration`: name `041_salary_category`

**Step 3: Verify salary mappings work**

Run via `execute_sql`:
```sql
SELECT
  get_user_account_code('00000000-0000-0000-0000-000000000000'::uuid, 'salary.brut') AS brut,
  get_user_account_code('00000000-0000-0000-0000-000000000000'::uuid, 'salary.charges_sociales') AS charges,
  get_user_account_code('00000000-0000-0000-0000-000000000000'::uuid, 'salary.net') AS net,
  get_user_account_code('00000000-0000-0000-0000-000000000000'::uuid, 'check') AS chk;
```
Expected: brut=6210, charges=6211, net=4530, chk=511 (BE defaults)

**Step 4: Commit**

```bash
git add migrations/041_salary_category.sql
git commit -m "feat(accounting): add salary.brut/charges_sociales/net + check account mappings"
```

---

### Task 3: Migration 042 — Payment Method Split

**Files:**
- Create: `migrations/042_payment_method_split.sql`

**Step 1: Create the migration file**

Replaces `auto_journal_payment()` to route debit account based on `payment_method`. Also updates the payment portion of `auto_journal_invoice()` (from migration 035).

```sql
-- ============================================================================
-- Migration 042: Payment Method Split — Route cash/check/bank accounts
-- ============================================================================

-- A. Helper to resolve payment account based on method
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

-- B. Replace auto_journal_payment to use payment method routing
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

  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'payment' AND source_id = NEW.id
    AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Route to correct account based on payment method
  v_payment_code := get_payment_account_code(NEW.user_id, COALESCE(NEW.payment_method, 'bank_transfer'));
  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(NEW.receipt_number, NEW.id::TEXT);

  -- Debit: Payment account (cash/check/bank)
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_payment_code, COALESCE(NEW.amount, 0), 0, 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement recu (' || COALESCE(NEW.payment_method, 'bank_transfer') || ') - ' || COALESCE(NEW.reference, ''));

  -- Credit: Client
  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (NEW.user_id, COALESCE(NEW.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(NEW.amount, 0), 'payment', NEW.id, 'BQ', v_ref, true,
    'Paiement client - ' || COALESCE(NEW.reference, ''));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- C. Update auto_journal_invoice (payment portion only) to use method routing
-- We must redefine the full function (from migration 035) with the payment fix
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

  -- === SALE ENTRY (unchanged from 035) ===
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

  -- === PAYMENT ENTRY: Now uses get_payment_account_code ===
  IF TG_OP = 'UPDATE'
     AND (OLD.payment_status IS DISTINCT FROM NEW.payment_status)
     AND NEW.payment_status = 'paid' THEN

    IF NOT EXISTS (
      SELECT 1 FROM accounting_entries
      WHERE source_type = 'invoice_payment' AND source_id = NEW.id AND journal = 'BQ'
      AND user_id = NEW.user_id
    ) THEN
      -- Try to find the payment method from the latest payment on this invoice
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
$$ LANGUAGE plpgsql;
```

**Step 2: Apply migration**

Run via `apply_migration`: name `042_payment_method_split`

**Step 3: Verify helper function**

Run via `execute_sql`:
```sql
SELECT
  get_payment_account_code('00000000-0000-0000-0000-000000000000'::uuid, 'cash') AS cash_acct,
  get_payment_account_code('00000000-0000-0000-0000-000000000000'::uuid, 'check') AS check_acct,
  get_payment_account_code('00000000-0000-0000-0000-000000000000'::uuid, 'bank_transfer') AS bank_acct;
```
Expected: cash_acct=570, check_acct=511, bank_acct=550 (BE defaults)

**Step 4: Commit**

```bash
git add migrations/042_payment_method_split.sql
git commit -m "feat(accounting): route payments to cash/check/bank accounts by payment_method"
```

---

### Task 4: Migration 043 — Accounting Audit Table

**Files:**
- Create: `migrations/043_accounting_audit_table.sql`

**Step 1: Create the migration file**

```sql
-- ============================================================================
-- Migration 043: Accounting Balance Checks (Audit Table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounting_balance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_balanced BOOLEAN NOT NULL DEFAULT false,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_balance_checks_user ON accounting_balance_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_checks_source ON accounting_balance_checks(source_id);
CREATE INDEX IF NOT EXISTS idx_balance_checks_unbalanced ON accounting_balance_checks(is_balanced) WHERE is_balanced = false;

ALTER TABLE accounting_balance_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_balance_checks' AND policyname = 'abc_select_own') THEN
    CREATE POLICY abc_select_own ON accounting_balance_checks FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_balance_checks' AND policyname = 'abc_insert_own') THEN
    CREATE POLICY abc_insert_own ON accounting_balance_checks FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
```

**Step 2: Apply migration**

Run via `apply_migration`: name `043_accounting_audit_table`

**Step 3: Verify table exists**

Run via `execute_sql`:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'accounting_balance_checks' ORDER BY ordinal_position;
```

**Step 4: Commit**

```bash
git add migrations/043_accounting_audit_table.sql
git commit -m "feat(accounting): add accounting_balance_checks audit table"
```

---

### Task 5: Migration 044 — Auto Balance Check Trigger

**Files:**
- Create: `migrations/044_auto_balance_check.sql`

**Depends on:** Task 4 (migration 043)

**Step 1: Create the migration file**

```sql
-- ============================================================================
-- Migration 044: Auto Balance Check Trigger
-- ============================================================================
-- Fires AFTER INSERT on accounting_entries.
-- For each new source_id, verifies SUM(debit) = SUM(credit).
-- Upserts result into accounting_balance_checks.
-- RAISE WARNING (not EXCEPTION) if unbalanced.
-- ============================================================================

CREATE OR REPLACE FUNCTION check_accounting_balance() RETURNS TRIGGER AS $$
DECLARE
  v_total_debit NUMERIC;
  v_total_credit NUMERIC;
  v_balanced BOOLEAN;
BEGIN
  -- Skip entries without a source_id (manual entries)
  IF NEW.source_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate totals for this source document
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
  INTO v_total_debit, v_total_credit
  FROM accounting_entries
  WHERE source_type = NEW.source_type
    AND source_id = NEW.source_id
    AND user_id = NEW.user_id;

  v_balanced := ABS(v_total_debit - v_total_credit) < 0.01;

  -- Upsert balance check record
  INSERT INTO accounting_balance_checks (user_id, source_type, source_id, total_debit, total_credit, is_balanced, checked_at, details)
  VALUES (
    NEW.user_id, NEW.source_type, NEW.source_id,
    ROUND(v_total_debit, 2), ROUND(v_total_credit, 2),
    v_balanced, now(),
    jsonb_build_object('entry_ref', NEW.entry_ref, 'last_entry_id', NEW.id)
  )
  ON CONFLICT (source_id) DO UPDATE SET
    total_debit = EXCLUDED.total_debit,
    total_credit = EXCLUDED.total_credit,
    is_balanced = EXCLUDED.is_balanced,
    checked_at = EXCLUDED.checked_at,
    details = EXCLUDED.details;

  -- Warn but don't block if unbalanced
  IF NOT v_balanced THEN
    RAISE WARNING 'Desequilibre comptable: source_type=%, source_id=%, debit=%, credit=%',
      NEW.source_type, NEW.source_id, v_total_debit, v_total_credit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Need a unique constraint on source_id for the ON CONFLICT clause
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_balance_check_source'
  ) THEN
    ALTER TABLE accounting_balance_checks
      ADD CONSTRAINT uq_balance_check_source UNIQUE (source_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_check_balance ON accounting_entries;
CREATE TRIGGER trg_check_balance
  AFTER INSERT ON accounting_entries
  FOR EACH ROW
  EXECUTE FUNCTION check_accounting_balance();

COMMENT ON FUNCTION check_accounting_balance() IS
'Verifies debit/credit balance for each source document after entry insertion';
```

**Step 2: Apply migration**

Run via `apply_migration`: name `044_auto_balance_check`

**Step 3: Verify trigger exists**

Run via `execute_sql`:
```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = 'accounting_entries'::regclass;
```
Expected: `trg_check_balance` in the list

**Step 4: Commit**

```bash
git add migrations/044_auto_balance_check.sql
git commit -m "feat(accounting): add auto balance check trigger on accounting_entries"
```

---

### Task 6: Migration 045 — Backfill Function

**Files:**
- Create: `migrations/045_backfill_entries.sql`

**Depends on:** Tasks 1, 2, 3 (migrations 040, 041, 042)

**Step 1: Create the migration file**

```sql
-- ============================================================================
-- Migration 045: Backfill Accounting Entries
-- ============================================================================
-- Function to retroactively create journal entries for documents that
-- were created before auto-journaling was enabled or before triggers existed.
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_accounting_entries(
  p_user_id UUID,
  p_dry_run BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  v_invoices_count INT := 0;
  v_expenses_count INT := 0;
  v_payments_count INT := 0;
  v_credit_notes_count INT := 0;
  v_supplier_invoices_count INT := 0;
  v_total_entries INT := 0;
  rec RECORD;
BEGIN
  -- Count documents missing journal entries

  -- 1. Invoices (non-draft, no VE entry)
  FOR rec IN
    SELECT i.* FROM invoices i
    WHERE i.user_id = p_user_id
      AND i.status NOT IN ('draft', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'invoice' AND ae.source_id = i.id AND ae.journal = 'VE' AND ae.user_id = p_user_id
      )
  LOOP
    v_invoices_count := v_invoices_count + 1;
    IF NOT p_dry_run THEN
      -- Simulate INSERT trigger by calling the function logic inline
      -- We use a temp update trick: set status to draft then back to trigger the AFTER UPDATE
      UPDATE invoices SET status = 'draft' WHERE id = rec.id AND user_id = p_user_id;
      UPDATE invoices SET status = rec.status WHERE id = rec.id AND user_id = p_user_id;
    END IF;
  END LOOP;

  -- 2. Expenses (no AC entry)
  FOR rec IN
    SELECT e.* FROM expenses e
    WHERE e.user_id = p_user_id
      AND e.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'expense' AND ae.source_id = e.id AND ae.user_id = p_user_id
      )
  LOOP
    v_expenses_count := v_expenses_count + 1;
    IF NOT p_dry_run THEN
      -- Directly insert entries mimicking the trigger logic
      PERFORM auto_journal_expense_backfill(e.*) FROM expenses e WHERE e.id = rec.id;
    END IF;
  END LOOP;

  -- 3. Payments (no BQ entry)
  FOR rec IN
    SELECT p.* FROM payments p
    WHERE p.user_id = p_user_id
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'payment' AND ae.source_id = p.id AND ae.user_id = p_user_id
      )
  LOOP
    v_payments_count := v_payments_count + 1;
    IF NOT p_dry_run THEN
      PERFORM auto_journal_payment_backfill(p.*) FROM payments p WHERE p.id = rec.id;
    END IF;
  END LOOP;

  -- 4. Credit notes (issued, no VE entry)
  FOR rec IN
    SELECT cn.* FROM credit_notes cn
    WHERE cn.user_id = p_user_id
      AND cn.status = 'issued'
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'credit_note' AND ae.source_id = cn.id AND ae.user_id = p_user_id
      )
  LOOP
    v_credit_notes_count := v_credit_notes_count + 1;
    IF NOT p_dry_run THEN
      PERFORM auto_journal_credit_note_backfill(cn.*) FROM credit_notes cn WHERE cn.id = rec.id;
    END IF;
  END LOOP;

  -- 5. Supplier invoices (received/processed, no AC entry)
  FOR rec IN
    SELECT si.* FROM supplier_invoices si
    WHERE si.user_id = p_user_id
      AND si.status IN ('received', 'processed')
      AND NOT EXISTS (
        SELECT 1 FROM accounting_entries ae
        WHERE ae.source_type = 'supplier_invoice' AND ae.source_id = si.id AND ae.user_id = p_user_id
      )
  LOOP
    v_supplier_invoices_count := v_supplier_invoices_count + 1;
    IF NOT p_dry_run THEN
      PERFORM auto_journal_supplier_invoice_backfill(si.*) FROM supplier_invoices si WHERE si.id = rec.id;
    END IF;
  END LOOP;

  v_total_entries := v_invoices_count + v_expenses_count + v_payments_count + v_credit_notes_count + v_supplier_invoices_count;

  RETURN jsonb_build_object(
    'dry_run', p_dry_run,
    'user_id', p_user_id,
    'documents_missing_entries', jsonb_build_object(
      'invoices', v_invoices_count,
      'expenses', v_expenses_count,
      'payments', v_payments_count,
      'credit_notes', v_credit_notes_count,
      'supplier_invoices', v_supplier_invoices_count,
      'total', v_total_entries
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Backfill helper: expense (since expense trigger is AFTER INSERT only, we need direct inserts)
CREATE OR REPLACE FUNCTION auto_journal_expense_backfill(p_expense expenses) RETURNS void AS $$
DECLARE
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_bank_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_amount_ttc NUMERIC;
  v_txn_date DATE;
BEGIN
  v_expense_code := get_user_account_code(p_expense.user_id, 'expense.' || COALESCE(p_expense.category, 'general'));
  v_vat_code := get_user_account_code(p_expense.user_id, 'vat_input');
  v_bank_code := get_user_account_code(p_expense.user_id, 'bank');
  v_ref := 'EXP-' || p_expense.id::TEXT;
  v_amount_ht := COALESCE(p_expense.amount_ht, p_expense.amount, 0);
  v_tva := COALESCE(p_expense.tax_amount, 0);
  v_amount_ttc := v_amount_ht + v_tva;
  v_txn_date := COALESCE(p_expense.expense_date, p_expense.created_at::date, CURRENT_DATE);

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_expense.user_id, v_txn_date, v_expense_code, v_amount_ht, 0, 'expense', p_expense.id, 'AC', v_ref, true, 'Backfill - Depense ' || COALESCE(p_expense.category, 'divers'));

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_expense.user_id, v_txn_date, v_vat_code, v_tva, 0, 'expense', p_expense.id, 'AC', v_ref, true, 'Backfill - TVA deductible');
  END IF;

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_expense.user_id, v_txn_date, v_bank_code, 0, v_amount_ttc, 'expense', p_expense.id, 'AC', v_ref, true, 'Backfill - Reglement depense');
END;
$$ LANGUAGE plpgsql;

-- Backfill helper: payment
CREATE OR REPLACE FUNCTION auto_journal_payment_backfill(p_payment payments) RETURNS void AS $$
DECLARE
  v_payment_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
BEGIN
  v_payment_code := get_payment_account_code(p_payment.user_id, COALESCE(p_payment.payment_method, 'bank_transfer'));
  v_client_code := get_user_account_code(p_payment.user_id, 'client');
  v_ref := 'PAY-' || COALESCE(p_payment.receipt_number, p_payment.id::TEXT);

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_payment.user_id, COALESCE(p_payment.payment_date, CURRENT_DATE), v_payment_code, COALESCE(p_payment.amount, 0), 0, 'payment', p_payment.id, 'BQ', v_ref, true, 'Backfill - Paiement (' || COALESCE(p_payment.payment_method, 'bank') || ')');

  INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
  VALUES (p_payment.user_id, COALESCE(p_payment.payment_date, CURRENT_DATE), v_client_code, 0, COALESCE(p_payment.amount, 0), 'payment', p_payment.id, 'BQ', v_ref, true, 'Backfill - Client');
END;
$$ LANGUAGE plpgsql;

-- Backfill helper: credit note
CREATE OR REPLACE FUNCTION auto_journal_credit_note_backfill(p_cn credit_notes) RETURNS void AS $$
DECLARE
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
  v_total_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  v_total_ht := COALESCE(p_cn.total_ht, 0);
  v_tva := COALESCE(p_cn.tax_amount, 0);
  v_total_ttc := COALESCE(p_cn.total_ttc, v_total_ht + v_tva);

  IF v_total_ttc = 0 AND v_total_ht = 0 AND v_tva = 0 THEN RETURN; END IF;

  v_revenue_code := get_user_account_code(p_cn.user_id, 'revenue');
  v_vat_code := get_user_account_code(p_cn.user_id, 'vat_output');
  v_client_code := get_user_account_code(p_cn.user_id, 'client');
  v_ref := 'CN-' || COALESCE(p_cn.credit_note_number, p_cn.id::TEXT);

  IF v_total_ht > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_cn.user_id, COALESCE(p_cn.date, CURRENT_DATE), v_revenue_code, v_total_ht, 0, 'credit_note', p_cn.id, 'VE', v_ref, true, 'Backfill - Extourne vente');
  END IF;

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_cn.user_id, COALESCE(p_cn.date, CURRENT_DATE), v_vat_code, v_tva, 0, 'credit_note', p_cn.id, 'VE', v_ref, true, 'Backfill - Extourne TVA');
  END IF;

  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_cn.user_id, COALESCE(p_cn.date, CURRENT_DATE), v_client_code, 0, v_total_ttc, 'credit_note', p_cn.id, 'VE', v_ref, true, 'Backfill - Avoir client');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Backfill helper: supplier invoice
CREATE OR REPLACE FUNCTION auto_journal_supplier_invoice_backfill(p_si supplier_invoices) RETURNS void AS $$
DECLARE
  v_expense_code TEXT;
  v_vat_code TEXT;
  v_supplier_code TEXT;
  v_ref TEXT;
  v_amount_ht NUMERIC;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
BEGIN
  v_amount_ht := COALESCE(p_si.amount_ht, 0);
  v_tva := COALESCE(p_si.tax_amount, 0);
  v_total_ttc := COALESCE(p_si.total_ttc, v_amount_ht + v_tva);
  v_expense_code := get_user_account_code(p_si.user_id, 'expense.general');
  v_vat_code := get_user_account_code(p_si.user_id, 'vat_input');
  v_supplier_code := get_user_account_code(p_si.user_id, 'supplier');
  v_ref := 'SINV-' || COALESCE(p_si.invoice_number, p_si.id::TEXT);

  IF v_amount_ht > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_si.user_id, COALESCE(p_si.invoice_date, CURRENT_DATE), v_expense_code, v_amount_ht, 0, 'supplier_invoice', p_si.id, 'AC', v_ref, true, 'Backfill - Facture fournisseur');
  END IF;

  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_si.user_id, COALESCE(p_si.invoice_date, CURRENT_DATE), v_vat_code, v_tva, 0, 'supplier_invoice', p_si.id, 'AC', v_ref, true, 'Backfill - TVA deductible SINV');
  END IF;

  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (p_si.user_id, COALESCE(p_si.invoice_date, CURRENT_DATE), v_supplier_code, 0, v_total_ttc, 'supplier_invoice', p_si.id, 'AC', v_ref, true, 'Backfill - Dette fournisseur');
  END IF;
END;
$$ LANGUAGE plpgsql;
```

**Step 2: Apply migration**

Run via `apply_migration`: name `045_backfill_entries`

**Step 3: Verify function exists**

Run via `execute_sql`:
```sql
SELECT proname FROM pg_proc WHERE proname LIKE 'backfill%' OR proname LIKE '%_backfill';
```
Expected: `backfill_accounting_entries`, `auto_journal_expense_backfill`, `auto_journal_payment_backfill`, `auto_journal_credit_note_backfill`, `auto_journal_supplier_invoice_backfill`

**Step 4: Commit**

```bash
git add migrations/045_backfill_entries.sql
git commit -m "feat(accounting): add backfill function for retroactive journal entries"
```

---

### Task 7: MCP Tool — backfill_journal_entries

**Files:**
- Modify: `mcp-server/src/tools/accounting.ts` (add tool at end of registerAccountingTools)

**Step 1: Add the backfill tool**

Add this tool registration at the end of `registerAccountingTools()`, before the closing `}`:

```typescript
  server.tool(
    'backfill_journal_entries',
    'Retroactively create missing journal entries for existing documents (invoices, expenses, payments, credit notes, supplier invoices). Run with dry_run=true first to preview.',
    {
      dry_run: z.boolean().default(true).describe('If true, only count missing entries without creating them. Default: true.'),
    },
    async ({ dry_run }) => {
      const userId = getUserId();

      const { data, error } = await supabase.rpc('backfill_accounting_entries', {
        p_user_id: userId,
        p_dry_run: dry_run
      });

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      const result = data as any;
      const counts = result.documents_missing_entries;

      if (dry_run) {
        return {
          content: [{
            type: 'text' as const,
            text: `[DRY RUN] Documents missing journal entries:\n` +
              `  Invoices: ${counts.invoices}\n` +
              `  Expenses: ${counts.expenses}\n` +
              `  Payments: ${counts.payments}\n` +
              `  Credit notes: ${counts.credit_notes}\n` +
              `  Supplier invoices: ${counts.supplier_invoices}\n` +
              `  Total: ${counts.total}\n\n` +
              `Run again with dry_run=false to create the entries.`
          }]
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `Backfill complete. Created entries for:\n` +
            `  Invoices: ${counts.invoices}\n` +
            `  Expenses: ${counts.expenses}\n` +
            `  Payments: ${counts.payments}\n` +
            `  Credit notes: ${counts.credit_notes}\n` +
            `  Supplier invoices: ${counts.supplier_invoices}\n` +
            `  Total: ${counts.total}`
        }]
      };
    }
  );
```

**Step 2: Update tool count in CLAUDE.md**

Update `169 outils` to `170 outils` (54+1 hand-written + 115 CRUD = 170) in both CLAUDE.md files.

**Step 3: Commit**

```bash
git add mcp-server/src/tools/accounting.ts CLAUDE.md
git commit -m "feat(mcp): add backfill_journal_entries tool"
```

---

### Task 8: Final Verification

**Step 1: Run Supabase security advisors**

Run `get_advisors` with type `security` to check for missing RLS policies on new tables.

**Step 2: Run Supabase performance advisors**

Run `get_advisors` with type `performance` to check for missing indexes.

**Step 3: Verify all triggers**

Run via `execute_sql`:
```sql
SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('invoices', 'payments', 'expenses', 'credit_notes', 'supplier_invoices', 'accounting_entries')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;
```

Expected triggers:
- `invoices`: trg_auto_journal_invoice, trg_reverse_invoice_on_cancel
- `payments`: trg_auto_journal_payment, trg_reverse_payment_on_delete
- `expenses`: trg_auto_journal_expense, trg_reverse_expense_on_delete
- `credit_notes`: trg_auto_journal_credit_note
- `supplier_invoices`: trg_auto_journal_supplier_invoice, trg_reverse_supplier_invoice_on_delete, trg_reverse_supplier_invoice_on_cancel
- `accounting_entries`: trg_check_balance

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: accounting fixes verification complete"
```

---

## Dependency Graph

```
Task 1 (040 supplier_invoice) ─────┐
Task 2 (041 salary)           ─────┤
Task 3 (042 payment_method)   ─────┼──→ Task 6 (045 backfill) → Task 7 (MCP tool) → Task 8 (verify)
Task 4 (043 audit_table)      ─┐   │
                                └──→ Task 5 (044 balance_check)
```

**Parallel groups:**
- Group A (independent): Tasks 1, 2, 3, 4 — can run in parallel
- Group B (depends on 4): Task 5
- Group C (depends on 1+2+3): Task 6
- Group D (depends on 6): Task 7
- Group E (depends on all): Task 8
