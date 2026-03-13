-- ============================================================================
-- Debt referential hardening + UI reference catalogs
-- - NNG-1: DB single source of truth for DebtManager + AccountingMappings options
-- - NNG-1: Replace polymorphic debt_payments relation with explicit FK columns
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1) Debt reference catalogs (UI-driven values moved to DB)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reference_debt_statuses (
  code TEXT PRIMARY KEY,
  label_key TEXT NOT NULL,
  display_color TEXT NOT NULL DEFAULT 'text-gray-400',
  display_bg TEXT NOT NULL DEFAULT 'bg-gray-500/20',
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  is_terminal BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reference_debt_categories (
  code TEXT PRIMARY KEY,
  label_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reference_debt_payment_methods (
  code TEXT PRIMARY KEY,
  label_key TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reference_debt_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_debt_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_debt_payment_methods ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reference_debt_statuses'
      AND policyname = 'reference_debt_statuses_read_all'
  ) THEN
    CREATE POLICY reference_debt_statuses_read_all
      ON public.reference_debt_statuses FOR SELECT USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reference_debt_categories'
      AND policyname = 'reference_debt_categories_read_all'
  ) THEN
    CREATE POLICY reference_debt_categories_read_all
      ON public.reference_debt_categories FOR SELECT USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reference_debt_payment_methods'
      AND policyname = 'reference_debt_payment_methods_read_all'
  ) THEN
    CREATE POLICY reference_debt_payment_methods_read_all
      ON public.reference_debt_payment_methods FOR SELECT USING (TRUE);
  END IF;
END $$;

INSERT INTO public.reference_debt_statuses
  (code, label_key, display_color, display_bg, is_open, is_terminal, sort_order, is_active)
VALUES
  ('pending',   'debtManager.status.pending',   'text-yellow-400', 'bg-yellow-500/20', TRUE,  FALSE, 1, TRUE),
  ('partial',   'debtManager.status.partial',   'text-blue-400',   'bg-blue-500/20',   TRUE,  FALSE, 2, TRUE),
  ('overdue',   'debtManager.status.overdue',   'text-red-400',    'bg-red-500/20',    TRUE,  FALSE, 3, TRUE),
  ('paid',      'debtManager.status.paid',      'text-green-400',  'bg-green-500/20',  FALSE, TRUE,  4, TRUE),
  ('cancelled', 'debtManager.status.cancelled', 'text-gray-400',   'bg-gray-500/20',   FALSE, TRUE,  5, TRUE)
ON CONFLICT (code) DO UPDATE SET
  label_key = EXCLUDED.label_key,
  display_color = EXCLUDED.display_color,
  display_bg = EXCLUDED.display_bg,
  is_open = EXCLUDED.is_open,
  is_terminal = EXCLUDED.is_terminal,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

INSERT INTO public.reference_debt_categories
  (code, label_key, sort_order, is_active)
VALUES
  ('personal', 'debtManager.categories.personal', 1, TRUE),
  ('business', 'debtManager.categories.business', 2, TRUE),
  ('family',   'debtManager.categories.family',   3, TRUE),
  ('friend',   'debtManager.categories.friend',   4, TRUE),
  ('other',    'debtManager.categories.other',    5, TRUE)
ON CONFLICT (code) DO UPDATE SET
  label_key = EXCLUDED.label_key,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

INSERT INTO public.reference_debt_payment_methods
  (code, label_key, sort_order, is_active)
VALUES
  ('cash',          'debtManager.methods.cash',          1, TRUE),
  ('bank_transfer', 'debtManager.methods.bank_transfer', 2, TRUE),
  ('mobile_money',  'debtManager.methods.mobile_money',  3, TRUE),
  ('cheque',        'debtManager.methods.cheque',        4, TRUE),
  ('other',         'debtManager.methods.other',         5, TRUE)
ON CONFLICT (code) DO UPDATE SET
  label_key = EXCLUDED.label_key,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- 2) AccountingMappings reference catalogs (UI-driven values moved to DB)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reference_accounting_source_types (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reference_accounting_source_categories (
  source_type TEXT NOT NULL REFERENCES public.reference_accounting_source_types(code) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_type, code)
);

ALTER TABLE public.reference_accounting_source_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_accounting_source_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reference_accounting_source_types'
      AND policyname = 'reference_accounting_source_types_read_all'
  ) THEN
    CREATE POLICY reference_accounting_source_types_read_all
      ON public.reference_accounting_source_types FOR SELECT USING (TRUE);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reference_accounting_source_categories'
      AND policyname = 'reference_accounting_source_categories_read_all'
  ) THEN
    CREATE POLICY reference_accounting_source_categories_read_all
      ON public.reference_accounting_source_categories FOR SELECT USING (TRUE);
  END IF;
END $$;

INSERT INTO public.reference_accounting_source_types (code, label, sort_order, is_active) VALUES
  ('invoice',          'Facture client (vente)',            1, TRUE),
  ('expense',          'Dépense',                           2, TRUE),
  ('supplier_invoice', 'Facture fournisseur (achat)',       3, TRUE),
  ('payment',          'Paiement client',                   4, TRUE),
  ('credit_note',      'Note de crédit',                    5, TRUE),
  ('supplier_payment', 'Paiement fournisseur',              6, TRUE)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

INSERT INTO public.reference_accounting_source_categories (source_type, code, label, sort_order, is_active) VALUES
  ('invoice', 'revenue', 'revenue', 1, TRUE),
  ('invoice', 'service', 'service', 2, TRUE),
  ('invoice', 'product', 'product', 3, TRUE),

  ('expense', 'general', 'general', 1, TRUE),
  ('expense', 'office', 'office', 2, TRUE),
  ('expense', 'travel', 'travel', 3, TRUE),
  ('expense', 'meals', 'meals', 4, TRUE),
  ('expense', 'transport', 'transport', 5, TRUE),
  ('expense', 'software', 'software', 6, TRUE),
  ('expense', 'hardware', 'hardware', 7, TRUE),
  ('expense', 'marketing', 'marketing', 8, TRUE),
  ('expense', 'legal', 'legal', 9, TRUE),
  ('expense', 'insurance', 'insurance', 10, TRUE),
  ('expense', 'rent', 'rent', 11, TRUE),
  ('expense', 'utilities', 'utilities', 12, TRUE),
  ('expense', 'telecom', 'telecom', 13, TRUE),
  ('expense', 'training', 'training', 14, TRUE),
  ('expense', 'consulting', 'consulting', 15, TRUE),
  ('expense', 'other', 'other', 16, TRUE),

  ('supplier_invoice', 'purchase', 'purchase', 1, TRUE),
  ('supplier_invoice', 'service', 'service', 2, TRUE),
  ('supplier_invoice', 'supply', 'supply', 3, TRUE),

  ('payment', 'cash', 'cash', 1, TRUE),
  ('payment', 'bank_transfer', 'bank_transfer', 2, TRUE),
  ('payment', 'card', 'card', 3, TRUE),
  ('payment', 'check', 'check', 4, TRUE),
  ('payment', 'paypal', 'paypal', 5, TRUE),
  ('payment', 'other', 'other', 6, TRUE),

  ('credit_note', 'general', 'general', 1, TRUE),

  ('supplier_payment', 'cash', 'cash', 1, TRUE),
  ('supplier_payment', 'bank_transfer', 'bank_transfer', 2, TRUE),
  ('supplier_payment', 'card', 'card', 3, TRUE),
  ('supplier_payment', 'check', 'check', 4, TRUE),
  ('supplier_payment', 'paypal', 'paypal', 5, TRUE),
  ('supplier_payment', 'other', 'other', 6, TRUE)
ON CONFLICT (source_type, code) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- ============================================================================
-- 3) debt_payments referential hardening (explicit FK columns)
-- ============================================================================

ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS receivable_id UUID,
  ADD COLUMN IF NOT EXISTS payable_id UUID;

UPDATE public.debt_payments
SET receivable_id = COALESCE(receivable_id, CASE WHEN record_type = 'receivable' THEN record_id ELSE NULL END),
    payable_id = COALESCE(payable_id, CASE WHEN record_type = 'payable' THEN record_id ELSE NULL END);

-- Remove legacy orphan rows before adding FK constraints
DELETE FROM public.debt_payments dp
WHERE dp.receivable_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.receivables r WHERE r.id = dp.receivable_id);

DELETE FROM public.debt_payments dp
WHERE dp.payable_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.payables p WHERE p.id = dp.payable_id);

-- Remove invalid rows with no parent linkage
DELETE FROM public.debt_payments
WHERE receivable_id IS NULL AND payable_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'debt_payments'
      AND constraint_name = 'debt_payments_receivable_id_fkey'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT debt_payments_receivable_id_fkey
      FOREIGN KEY (receivable_id) REFERENCES public.receivables(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'debt_payments'
      AND constraint_name = 'debt_payments_payable_id_fkey'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT debt_payments_payable_id_fkey
      FOREIGN KEY (payable_id) REFERENCES public.payables(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_debt_payments_exactly_one_parent'
  ) THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT chk_debt_payments_exactly_one_parent
      CHECK (
        (receivable_id IS NOT NULL AND payable_id IS NULL)
        OR
        (receivable_id IS NULL AND payable_id IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.debt_payments
  VALIDATE CONSTRAINT chk_debt_payments_exactly_one_parent;

CREATE INDEX IF NOT EXISTS idx_debt_payments_receivable_id ON public.debt_payments(receivable_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_payable_id ON public.debt_payments(payable_id);

-- Keep legacy columns synchronized during transition.
CREATE OR REPLACE FUNCTION public.assign_debt_payment_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Legacy -> explicit FK
  IF NEW.receivable_id IS NULL AND NEW.payable_id IS NULL THEN
    IF NEW.record_type = 'receivable' THEN
      NEW.receivable_id := NEW.record_id;
    ELSIF NEW.record_type = 'payable' THEN
      NEW.payable_id := NEW.record_id;
    END IF;
  END IF;

  -- Explicit FK -> legacy
  IF NEW.receivable_id IS NOT NULL THEN
    NEW.record_type := 'receivable';
    NEW.record_id := NEW.receivable_id;
    NEW.payable_id := NULL;
  ELSIF NEW.payable_id IS NOT NULL THEN
    NEW.record_type := 'payable';
    NEW.record_id := NEW.payable_id;
    NEW.receivable_id := NULL;
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      CASE
        WHEN NEW.receivable_id IS NOT NULL THEN public.resolve_company_id_from_receivable(NEW.receivable_id)
        WHEN NEW.payable_id IS NOT NULL THEN public.resolve_company_id_from_payable(NEW.payable_id)
        WHEN NEW.record_type = 'receivable' THEN public.resolve_company_id_from_receivable(NEW.record_id)
        WHEN NEW.record_type = 'payable' THEN public.resolve_company_id_from_payable(NEW.record_id)
        ELSE NULL
      END,
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_debt_payment_company_id ON public.debt_payments;
CREATE TRIGGER trg_assign_debt_payment_company_id
  BEFORE INSERT OR UPDATE ON public.debt_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_debt_payment_company_id();

COMMIT;
