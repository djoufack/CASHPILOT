-- Analytical Accounting Full Activation (company-scoped, DB-first, audited)

BEGIN;
-- ============================================================================
-- 0) Ensure accounting audit log supports data_access events
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'accounting_audit_log'
      AND constraint_name = 'accounting_audit_log_event_type_check'
  ) THEN
    ALTER TABLE public.accounting_audit_log
      DROP CONSTRAINT accounting_audit_log_event_type_check;
  END IF;

  ALTER TABLE public.accounting_audit_log
    ADD CONSTRAINT accounting_audit_log_event_type_check
    CHECK (
      event_type IN (
        'auto_journal', 'reversal', 'balance_check', 'validation_error',
        'manual_correction', 'retroactive_journal', 'supplier_journal',
        'bank_journal', 'receivable_journal', 'payable_journal',
        'extourne', 'data_access'
      )
    );
END $$;
-- ============================================================================
-- 1) Upgrade existing analytical axes table to strict company scope
-- ============================================================================
ALTER TABLE public.accounting_analytical_axes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE RESTRICT;
UPDATE public.accounting_analytical_axes ax
SET company_id = c.id
FROM (
  SELECT DISTINCT ON (c.user_id)
    c.user_id,
    c.id
  FROM public.company c
  ORDER BY c.user_id, c.created_at ASC
) c
WHERE ax.company_id IS NULL
  AND c.user_id = ax.user_id;
DELETE FROM public.accounting_analytical_axes ax
WHERE ax.company_id IS NULL;
ALTER TABLE public.accounting_analytical_axes
  ALTER COLUMN company_id SET NOT NULL;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounting_analytical_axes_user_id_axis_type_axis_code_key'
      AND conrelid = 'public.accounting_analytical_axes'::regclass
  ) THEN
    ALTER TABLE public.accounting_analytical_axes
      DROP CONSTRAINT accounting_analytical_axes_user_id_axis_type_axis_code_key;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_accounting_analytical_axes_scope_code'
      AND conrelid = 'public.accounting_analytical_axes'::regclass
  ) THEN
    ALTER TABLE public.accounting_analytical_axes
      ADD CONSTRAINT uq_accounting_analytical_axes_scope_code
      UNIQUE (company_id, user_id, axis_type, axis_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_accounting_analytical_axes_scope_id'
      AND conrelid = 'public.accounting_analytical_axes'::regclass
  ) THEN
    ALTER TABLE public.accounting_analytical_axes
      ADD CONSTRAINT uq_accounting_analytical_axes_scope_id
      UNIQUE (id, company_id, user_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_accounting_analytical_axes_scope
  ON public.accounting_analytical_axes(company_id, user_id, axis_type, is_active);
DROP POLICY IF EXISTS "analytical_axes_user_policy" ON public.accounting_analytical_axes;
CREATE POLICY "analytical_axes_scope_policy"
  ON public.accounting_analytical_axes
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  );
COMMENT ON TABLE public.accounting_analytical_axes IS
  'ACTIVE: Company-scoped analytical axis catalog (single source of truth).';
CREATE OR REPLACE VIEW public.analytical_axes AS
SELECT
  id,
  user_id,
  company_id,
  axis_type,
  axis_code,
  axis_name,
  color,
  is_active,
  created_at,
  updated_at
FROM public.accounting_analytical_axes;
-- ============================================================================
-- 2) Analytical dimensions / master data
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytical_axis_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  axis_id UUID NOT NULL REFERENCES public.accounting_analytical_axes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  value_code TEXT NOT NULL,
  value_name TEXT NOT NULL,
  color TEXT DEFAULT '#22c55e',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (axis_id, value_code),
  UNIQUE (id, company_id, user_id)
);
ALTER TABLE public.analytical_axis_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_axis_values_scope_policy" ON public.analytical_axis_values;
CREATE POLICY "analytical_axis_values_scope_policy"
  ON public.analytical_axis_values
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_analytical_axis_values_scope
  ON public.analytical_axis_values(company_id, user_id, axis_id, is_active);
CREATE TABLE IF NOT EXISTS public.analytical_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  object_type TEXT NOT NULL CHECK (
    object_type IN ('product', 'service', 'project', 'client', 'channel', 'geography', 'business_unit', 'custom')
  ),
  object_code TEXT NOT NULL,
  object_name TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, object_type, object_code),
  UNIQUE (id, company_id, user_id)
);
ALTER TABLE public.analytical_objects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_objects_scope_policy" ON public.analytical_objects;
CREATE POLICY "analytical_objects_scope_policy"
  ON public.analytical_objects
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_analytical_objects_scope
  ON public.analytical_objects(company_id, user_id, object_type, is_active);
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  axis_id UUID REFERENCES public.accounting_analytical_axes(id) ON DELETE SET NULL,
  parent_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  center_code TEXT NOT NULL,
  center_name TEXT NOT NULL,
  center_type TEXT NOT NULL CHECK (center_type IN ('principal', 'auxiliary', 'structure')),
  allocation_base TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, center_code),
  UNIQUE (id, company_id, user_id)
);
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cost_centers_scope_policy" ON public.cost_centers;
CREATE POLICY "cost_centers_scope_policy"
  ON public.cost_centers
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_scope
  ON public.cost_centers(company_id, user_id, center_type, is_active);
CREATE TABLE IF NOT EXISTS public.center_redistribution_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  from_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  to_center_id UUID NOT NULL REFERENCES public.cost_centers(id) ON DELETE CASCADE,
  allocation_percent NUMERIC(9,4) NOT NULL CHECK (allocation_percent > 0 AND allocation_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, from_center_id, to_center_id)
);
ALTER TABLE public.center_redistribution_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "center_redistribution_rules_scope_policy" ON public.center_redistribution_rules;
CREATE POLICY "center_redistribution_rules_scope_policy"
  ON public.center_redistribution_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_center_redistribution_rules_scope
  ON public.center_redistribution_rules(company_id, user_id, from_center_id, is_active);
-- ============================================================================
-- 3) Classification metadata on accounting entries (direct/indirect, behavior)
-- ============================================================================
ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS analytical_is_direct BOOLEAN,
  ADD COLUMN IF NOT EXISTS analytical_cost_behavior TEXT,
  ADD COLUMN IF NOT EXISTS analytical_destination TEXT,
  ADD COLUMN IF NOT EXISTS analytical_method TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_accounting_entries_analytical_cost_behavior'
      AND conrelid = 'public.accounting_entries'::regclass
  ) THEN
    ALTER TABLE public.accounting_entries
      ADD CONSTRAINT ck_accounting_entries_analytical_cost_behavior
      CHECK (analytical_cost_behavior IS NULL OR analytical_cost_behavior IN ('fixed', 'variable', 'semi_variable'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_accounting_entries_analytical_destination'
      AND conrelid = 'public.accounting_entries'::regclass
  ) THEN
    ALTER TABLE public.accounting_entries
      ADD CONSTRAINT ck_accounting_entries_analytical_destination
      CHECK (analytical_destination IS NULL OR analytical_destination IN ('production', 'commercial', 'administratif', 'rd'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_accounting_entries_analytical_method'
      AND conrelid = 'public.accounting_entries'::regclass
  ) THEN
    ALTER TABLE public.accounting_entries
      ADD CONSTRAINT ck_accounting_entries_analytical_method
      CHECK (analytical_method IS NULL OR analytical_method IN ('full_costing', 'direct_costing', 'standard_costing', 'abc_costing', 'manual'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_accounting_entries_analytical_classification
  ON public.accounting_entries(company_id, user_id, analytical_cost_behavior, analytical_destination);
-- ============================================================================
-- 4) Allocation rules and allocation lines with hard validation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytical_allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  rule_name TEXT NOT NULL,
  source_type TEXT,
  source_category TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  object_id UUID REFERENCES public.analytical_objects(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  axis_value_id UUID REFERENCES public.analytical_axis_values(id) ON DELETE SET NULL,
  allocation_percent NUMERIC(9,4) NOT NULL DEFAULT 100 CHECK (allocation_percent > 0 AND allocation_percent <= 100),
  default_is_direct BOOLEAN,
  default_cost_behavior TEXT CHECK (default_cost_behavior IS NULL OR default_cost_behavior IN ('fixed', 'variable', 'semi_variable')),
  default_destination TEXT CHECK (default_destination IS NULL OR default_destination IN ('production', 'commercial', 'administratif', 'rd')),
  default_method TEXT CHECK (default_method IS NULL OR default_method IN ('full_costing', 'direct_costing', 'standard_costing', 'abc_costing', 'manual')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, rule_name)
);
ALTER TABLE public.analytical_allocation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_allocation_rules_scope_policy" ON public.analytical_allocation_rules;
CREATE POLICY "analytical_allocation_rules_scope_policy"
  ON public.analytical_allocation_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TABLE IF NOT EXISTS public.analytical_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  entry_id UUID NOT NULL REFERENCES public.accounting_entries(id) ON DELETE CASCADE,
  object_id UUID REFERENCES public.analytical_objects(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  axis_value_id UUID REFERENCES public.analytical_axis_values(id) ON DELETE SET NULL,
  redistribution_rule_id UUID REFERENCES public.center_redistribution_rules(id) ON DELETE SET NULL,
  redistributed_from_allocation_id UUID REFERENCES public.analytical_allocations(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  allocation_percent NUMERIC(9,4),
  is_direct BOOLEAN,
  cost_behavior TEXT CHECK (cost_behavior IS NULL OR cost_behavior IN ('fixed', 'variable', 'semi_variable')),
  destination TEXT CHECK (destination IS NULL OR destination IN ('production', 'commercial', 'administratif', 'rd')),
  method TEXT CHECK (method IS NULL OR method IN ('full_costing', 'direct_costing', 'standard_costing', 'abc_costing', 'manual')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (object_id IS NOT NULL OR cost_center_id IS NOT NULL OR axis_value_id IS NOT NULL),
  CHECK (allocation_percent IS NULL OR (allocation_percent >= 0 AND allocation_percent <= 100))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_analytical_allocations_redistribution_once
  ON public.analytical_allocations(redistributed_from_allocation_id, redistribution_rule_id)
  WHERE redistributed_from_allocation_id IS NOT NULL AND redistribution_rule_id IS NOT NULL;
ALTER TABLE public.analytical_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_allocations_scope_policy" ON public.analytical_allocations;
CREATE POLICY "analytical_allocations_scope_policy"
  ON public.analytical_allocations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_analytical_allocations_scope
  ON public.analytical_allocations(company_id, user_id, entry_id);
CREATE INDEX IF NOT EXISTS idx_analytical_allocations_dimensions
  ON public.analytical_allocations(company_id, object_id, cost_center_id, axis_value_id);
CREATE TABLE IF NOT EXISTS public.analytical_inclusion_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('non_incorporable', 'suppletive')),
  source_type TEXT,
  source_category TEXT,
  account_code_pattern TEXT,
  supplementive_amount NUMERIC(14,2),
  supplementive_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, rule_name)
);
ALTER TABLE public.analytical_inclusion_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_inclusion_rules_scope_policy" ON public.analytical_inclusion_rules;
CREATE POLICY "analytical_inclusion_rules_scope_policy"
  ON public.analytical_inclusion_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
-- ============================================================================
-- 5) Budgets + budget lines + variances
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.analytical_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  budget_name TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  method TEXT NOT NULL DEFAULT 'full_costing' CHECK (method IN ('full_costing', 'direct_costing', 'standard_costing', 'abc_costing')),
  object_id UUID REFERENCES public.analytical_objects(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
  axis_value_id UUID REFERENCES public.analytical_axis_values(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start),
  UNIQUE (company_id, user_id, budget_name)
);
ALTER TABLE public.analytical_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_budgets_scope_policy" ON public.analytical_budgets;
CREATE POLICY "analytical_budgets_scope_policy"
  ON public.analytical_budgets
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TABLE IF NOT EXISTS public.analytical_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.analytical_budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  period_month DATE NOT NULL,
  planned_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  planned_volume NUMERIC(14,3),
  planned_unit_cost NUMERIC(14,4),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (budget_id, period_month)
);
ALTER TABLE public.analytical_budget_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "analytical_budget_lines_scope_policy" ON public.analytical_budget_lines;
CREATE POLICY "analytical_budget_lines_scope_policy"
  ON public.analytical_budget_lines
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_analytical_budget_lines_scope
  ON public.analytical_budget_lines(company_id, user_id, period_month);
-- ============================================================================
-- 6) Generic updated_at function for analytical entities
-- ============================================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_analytical_axis_values_touch ON public.analytical_axis_values;
CREATE TRIGGER trg_analytical_axis_values_touch
  BEFORE UPDATE ON public.analytical_axis_values
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_analytical_objects_touch ON public.analytical_objects;
CREATE TRIGGER trg_analytical_objects_touch
  BEFORE UPDATE ON public.analytical_objects
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_cost_centers_touch ON public.cost_centers;
CREATE TRIGGER trg_cost_centers_touch
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_center_redistribution_rules_touch ON public.center_redistribution_rules;
CREATE TRIGGER trg_center_redistribution_rules_touch
  BEFORE UPDATE ON public.center_redistribution_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_analytical_allocation_rules_touch ON public.analytical_allocation_rules;
CREATE TRIGGER trg_analytical_allocation_rules_touch
  BEFORE UPDATE ON public.analytical_allocation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_analytical_allocations_touch ON public.analytical_allocations;
CREATE TRIGGER trg_analytical_allocations_touch
  BEFORE UPDATE ON public.analytical_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_analytical_inclusion_rules_touch ON public.analytical_inclusion_rules;
CREATE TRIGGER trg_analytical_inclusion_rules_touch
  BEFORE UPDATE ON public.analytical_inclusion_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_analytical_budgets_touch ON public.analytical_budgets;
CREATE TRIGGER trg_analytical_budgets_touch
  BEFORE UPDATE ON public.analytical_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS trg_analytical_budget_lines_touch ON public.analytical_budget_lines;
CREATE TRIGGER trg_analytical_budget_lines_touch
  BEFORE UPDATE ON public.analytical_budget_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
-- ============================================================================
-- 7) Hard integrity checks for allocation scope and 100% balancing
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_analytical_allocation_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_company UUID;
  v_entry_user UUID;
  v_company UUID;
  v_user UUID;
BEGIN
  SELECT e.company_id, e.user_id
  INTO v_entry_company, v_entry_user
  FROM public.accounting_entries e
  WHERE e.id = NEW.entry_id;

  IF v_entry_company IS NULL OR v_entry_user IS NULL THEN
    RAISE EXCEPTION 'Analytical allocation references unknown accounting entry %', NEW.entry_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM v_entry_company OR NEW.user_id IS DISTINCT FROM v_entry_user THEN
    RAISE EXCEPTION 'Scope mismatch between allocation and accounting entry (entry %, company %, user %)',
      NEW.entry_id, v_entry_company, v_entry_user;
  END IF;

  IF NEW.object_id IS NOT NULL THEN
    SELECT company_id, user_id INTO v_company, v_user FROM public.analytical_objects WHERE id = NEW.object_id;
    IF v_company IS NULL OR v_user IS NULL OR v_company IS DISTINCT FROM NEW.company_id OR v_user IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Scope mismatch for analytical object %', NEW.object_id;
    END IF;
  END IF;

  IF NEW.cost_center_id IS NOT NULL THEN
    SELECT company_id, user_id INTO v_company, v_user FROM public.cost_centers WHERE id = NEW.cost_center_id;
    IF v_company IS NULL OR v_user IS NULL OR v_company IS DISTINCT FROM NEW.company_id OR v_user IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Scope mismatch for cost center %', NEW.cost_center_id;
    END IF;
  END IF;

  IF NEW.axis_value_id IS NOT NULL THEN
    SELECT company_id, user_id INTO v_company, v_user FROM public.analytical_axis_values WHERE id = NEW.axis_value_id;
    IF v_company IS NULL OR v_user IS NULL OR v_company IS DISTINCT FROM NEW.company_id OR v_user IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'Scope mismatch for analytical axis value %', NEW.axis_value_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_analytical_allocation_scope ON public.analytical_allocations;
CREATE TRIGGER trg_validate_analytical_allocation_scope
  BEFORE INSERT OR UPDATE ON public.analytical_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_analytical_allocation_scope();
CREATE OR REPLACE FUNCTION public.enforce_entry_allocation_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id UUID;
  v_entry_amount NUMERIC(14,2);
  v_total_amount NUMERIC(14,2);
  v_total_percent NUMERIC(14,4);
  v_has_percent BOOLEAN;
  v_count INTEGER;
BEGIN
  v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);
  IF v_entry_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT GREATEST(ABS(COALESCE(e.debit, 0)), ABS(COALESCE(e.credit, 0)))
  INTO v_entry_amount
  FROM public.accounting_entries e
  WHERE e.id = v_entry_id;

  IF v_entry_amount IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT
    COALESCE(SUM(a.amount), 0),
    COALESCE(SUM(COALESCE(a.allocation_percent, 0)), 0),
    BOOL_OR(a.allocation_percent IS NOT NULL),
    COUNT(*)
  INTO v_total_amount, v_total_percent, v_has_percent, v_count
  FROM public.analytical_allocations a
  WHERE a.entry_id = v_entry_id;

  IF v_count = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF ABS(v_total_amount - v_entry_amount) > 0.02 THEN
    RAISE EXCEPTION 'Allocation amount mismatch for entry %: expected %, got %', v_entry_id, v_entry_amount, v_total_amount;
  END IF;

  IF v_has_percent AND ABS(v_total_percent - 100) > 0.01 THEN
    RAISE EXCEPTION 'Allocation percent mismatch for entry %: expected 100, got %', v_entry_id, v_total_percent;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_enforce_entry_allocation_balance ON public.analytical_allocations;
CREATE CONSTRAINT TRIGGER trg_enforce_entry_allocation_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_allocations
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_entry_allocation_balance();
-- ============================================================================
-- 8) DB-first analytical RPCs and views
-- ============================================================================
CREATE OR REPLACE FUNCTION public.f_analytical_kpis(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_fixed_costs NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_revenue NUMERIC(14,2) := 0;
  v_variable_costs NUMERIC(14,2) := 0;
  v_fixed_costs NUMERIC(14,2) := 0;
  v_mcv NUMERIC(14,2) := 0;
  v_taux_marge NUMERIC(14,6) := 0;
  v_seuil NUMERIC(14,2) := 0;
  v_marge_securite NUMERIC(14,2) := 0;
  v_resultat NUMERIC(14,2) := 0;
  v_levier NUMERIC(14,6) := 0;
  v_cout_revient NUMERIC(14,2) := 0;
BEGIN
  SELECT COALESCE(SUM(COALESCE(e.credit, 0) - COALESCE(e.debit, 0)), 0)
  INTO v_revenue
  FROM public.accounting_entries e
  WHERE e.user_id = p_user_id
    AND e.company_id = p_company_id
    AND e.transaction_date BETWEEN p_start_date AND p_end_date
    AND e.account_code LIKE '7%';

  SELECT COALESCE(SUM(COALESCE(e.debit, 0) - COALESCE(e.credit, 0)), 0)
  INTO v_variable_costs
  FROM public.accounting_entries e
  WHERE e.user_id = p_user_id
    AND e.company_id = p_company_id
    AND e.transaction_date BETWEEN p_start_date AND p_end_date
    AND e.account_code LIKE '6%'
    AND COALESCE(e.analytical_cost_behavior, 'variable') = 'variable';

  IF p_fixed_costs IS NOT NULL THEN
    v_fixed_costs := p_fixed_costs;
  ELSE
    SELECT COALESCE(SUM(COALESCE(e.debit, 0) - COALESCE(e.credit, 0)), 0)
    INTO v_fixed_costs
    FROM public.accounting_entries e
    WHERE e.user_id = p_user_id
      AND e.company_id = p_company_id
      AND e.transaction_date BETWEEN p_start_date AND p_end_date
      AND e.account_code LIKE '6%'
      AND COALESCE(e.analytical_cost_behavior, 'fixed') = 'fixed';
  END IF;

  v_mcv := v_revenue - v_variable_costs;
  v_cout_revient := v_variable_costs + v_fixed_costs;
  v_resultat := v_revenue - v_cout_revient;

  IF v_revenue <> 0 THEN
    v_taux_marge := (v_mcv / v_revenue) * 100;
  END IF;

  IF v_taux_marge > 0 THEN
    v_seuil := v_fixed_costs / (v_taux_marge / 100);
  END IF;

  v_marge_securite := v_revenue - v_seuil;

  IF v_resultat <> 0 THEN
    v_levier := v_mcv / v_resultat;
  END IF;

  RETURN jsonb_build_object(
    'revenue', ROUND(v_revenue, 2),
    'variable_costs', ROUND(v_variable_costs, 2),
    'fixed_costs', ROUND(v_fixed_costs, 2),
    'mcv', ROUND(v_mcv, 2),
    'taux_marge', ROUND(v_taux_marge, 4),
    'seuil_rentabilite', ROUND(v_seuil, 2),
    'marge_securite', ROUND(v_marge_securite, 2),
    'levier_operationnel', ROUND(v_levier, 4),
    'cout_revient', ROUND(v_cout_revient, 2),
    'resultat_analytique', ROUND(v_resultat, 2)
  );
END;
$$;
CREATE OR REPLACE FUNCTION public.f_analytical_budget_variances(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  budget_id UUID,
  budget_name TEXT,
  dimension TEXT,
  planned_amount NUMERIC,
  actual_amount NUMERIC,
  variance_amount NUMERIC,
  variance_percent NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
WITH planned AS (
  SELECT
    b.id AS budget_id,
    b.budget_name,
    COALESCE(o.object_name, cc.center_name, av.value_name, 'Global') AS dimension,
    COALESCE(SUM(bl.planned_amount), 0)::NUMERIC AS planned_amount
  FROM public.analytical_budgets b
  LEFT JOIN public.analytical_budget_lines bl ON bl.budget_id = b.id
  LEFT JOIN public.analytical_objects o ON o.id = b.object_id
  LEFT JOIN public.cost_centers cc ON cc.id = b.cost_center_id
  LEFT JOIN public.analytical_axis_values av ON av.id = b.axis_value_id
  WHERE b.user_id = p_user_id
    AND b.company_id = p_company_id
    AND b.period_start <= p_end_date
    AND b.period_end >= p_start_date
  GROUP BY b.id, b.budget_name, dimension
),
actual AS (
  SELECT
    b.id AS budget_id,
    COALESCE(SUM(a.amount), 0)::NUMERIC AS actual_amount
  FROM public.analytical_budgets b
  LEFT JOIN public.analytical_allocations a
    ON a.user_id = b.user_id
    AND a.company_id = b.company_id
    AND (b.object_id IS NULL OR a.object_id = b.object_id)
    AND (b.cost_center_id IS NULL OR a.cost_center_id = b.cost_center_id)
    AND (b.axis_value_id IS NULL OR a.axis_value_id = b.axis_value_id)
  LEFT JOIN public.accounting_entries e ON e.id = a.entry_id
  WHERE b.user_id = p_user_id
    AND b.company_id = p_company_id
    AND e.transaction_date BETWEEN p_start_date AND p_end_date
  GROUP BY b.id
)
SELECT
  p.budget_id,
  p.budget_name,
  p.dimension,
  ROUND(p.planned_amount, 2) AS planned_amount,
  ROUND(COALESCE(a.actual_amount, 0), 2) AS actual_amount,
  ROUND(COALESCE(a.actual_amount, 0) - p.planned_amount, 2) AS variance_amount,
  CASE
    WHEN p.planned_amount = 0 THEN NULL
    ELSE ROUND(((COALESCE(a.actual_amount, 0) - p.planned_amount) / p.planned_amount) * 100, 4)
  END AS variance_percent
FROM planned p
LEFT JOIN actual a ON a.budget_id = p.budget_id
ORDER BY p.budget_name;
$$;
CREATE OR REPLACE FUNCTION public.f_redistribute_auxiliary_centers(
  p_user_id UUID,
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  INSERT INTO public.analytical_allocations (
    user_id,
    company_id,
    entry_id,
    object_id,
    cost_center_id,
    axis_value_id,
    redistribution_rule_id,
    redistributed_from_allocation_id,
    amount,
    allocation_percent,
    is_direct,
    cost_behavior,
    destination,
    method,
    notes
  )
  SELECT
    a.user_id,
    a.company_id,
    a.entry_id,
    a.object_id,
    r.to_center_id,
    a.axis_value_id,
    r.id,
    a.id,
    ROUND(a.amount * (r.allocation_percent / 100), 2),
    r.allocation_percent,
    false,
    COALESCE(a.cost_behavior, 'fixed'),
    COALESCE(a.destination, 'administratif'),
    'full_costing',
    'Redistribution auxiliaire -> principal'
  FROM public.analytical_allocations a
  JOIN public.accounting_entries e ON e.id = a.entry_id
  JOIN public.center_redistribution_rules r
    ON r.from_center_id = a.cost_center_id
   AND r.user_id = a.user_id
   AND r.company_id = a.company_id
   AND r.is_active = true
  JOIN public.cost_centers c_from ON c_from.id = r.from_center_id
  JOIN public.cost_centers c_to ON c_to.id = r.to_center_id
  WHERE a.user_id = p_user_id
    AND a.company_id = p_company_id
    AND e.transaction_date BETWEEN p_start_date AND p_end_date
    AND c_from.center_type = 'auxiliary'
    AND c_to.center_type = 'principal'
    AND a.redistribution_rule_id IS NULL
  ON CONFLICT (redistributed_from_allocation_id, redistribution_rule_id)
  DO UPDATE SET
    amount = EXCLUDED.amount,
    allocation_percent = EXCLUDED.allocation_percent,
    updated_at = now();

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;
CREATE OR REPLACE VIEW public.breakeven_view AS
SELECT
  a.object_id,
  MIN(o.object_name) AS object_name,
  ROUND(SUM(CASE WHEN e.account_code LIKE '7%' THEN a.amount ELSE 0 END), 2) AS revenue,
  ROUND(SUM(CASE WHEN COALESCE(a.cost_behavior, e.analytical_cost_behavior) = 'fixed' THEN a.amount ELSE 0 END), 2) AS fixed_costs,
  ROUND(SUM(CASE WHEN COALESCE(a.cost_behavior, e.analytical_cost_behavior) = 'variable' THEN a.amount ELSE 0 END), 2) AS variable_costs,
  ROUND(
    CASE
      WHEN SUM(CASE WHEN e.account_code LIKE '7%' THEN a.amount ELSE 0 END) = 0 THEN 0
      ELSE (
        SUM(CASE WHEN e.account_code LIKE '7%' THEN a.amount ELSE 0 END)
        - SUM(CASE WHEN COALESCE(a.cost_behavior, e.analytical_cost_behavior) = 'variable' THEN a.amount ELSE 0 END)
      )
      / SUM(CASE WHEN e.account_code LIKE '7%' THEN a.amount ELSE 0 END)
    END
  , 6) AS variable_margin_rate,
  ROUND(
    CASE
      WHEN (
        SUM(CASE WHEN e.account_code LIKE '7%' THEN a.amount ELSE 0 END)
        - SUM(CASE WHEN COALESCE(a.cost_behavior, e.analytical_cost_behavior) = 'variable' THEN a.amount ELSE 0 END)
      ) <= 0 THEN 0
      ELSE SUM(CASE WHEN COALESCE(a.cost_behavior, e.analytical_cost_behavior) = 'fixed' THEN a.amount ELSE 0 END)
      /
      (
        (
          SUM(CASE WHEN e.account_code LIKE '7%' THEN a.amount ELSE 0 END)
          - SUM(CASE WHEN COALESCE(a.cost_behavior, e.analytical_cost_behavior) = 'variable' THEN a.amount ELSE 0 END)
        )
        / NULLIF(SUM(CASE WHEN e.account_code LIKE '7%' THEN a.amount ELSE 0 END), 0)
      )
    END
  , 2) AS sr
FROM public.analytical_allocations a
JOIN public.accounting_entries e ON e.id = a.entry_id
LEFT JOIN public.analytical_objects o ON o.id = a.object_id
GROUP BY a.object_id;
-- ============================================================================
-- 9) Real-time CRUD audit logging (analytical + financial scope)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_analytical_financial_crud_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_company_id UUID;
  v_source_id UUID;
  v_operation TEXT;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_company_id := COALESCE(NEW.company_id, OLD.company_id);
  v_source_id := COALESCE(NEW.id, OLD.id);
  v_operation := lower(TG_OP);

  IF v_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.accounting_audit_log (
    user_id,
    event_type,
    source_table,
    source_id,
    entry_count,
    total_debit,
    total_credit,
    balance_ok,
    details
  ) VALUES (
    v_user_id,
    'data_access',
    TG_TABLE_NAME,
    v_source_id,
    0,
    0,
    0,
    true,
    jsonb_build_object(
      'operation', v_operation,
      'company_id', v_company_id,
      'at', now()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_audit_accounting_analytical_axes_crud ON public.accounting_analytical_axes;
CREATE TRIGGER trg_audit_accounting_analytical_axes_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.accounting_analytical_axes
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_analytical_axis_values_crud ON public.analytical_axis_values;
CREATE TRIGGER trg_audit_analytical_axis_values_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_axis_values
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_analytical_objects_crud ON public.analytical_objects;
CREATE TRIGGER trg_audit_analytical_objects_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_objects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_cost_centers_crud ON public.cost_centers;
CREATE TRIGGER trg_audit_cost_centers_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_center_redistribution_rules_crud ON public.center_redistribution_rules;
CREATE TRIGGER trg_audit_center_redistribution_rules_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.center_redistribution_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_analytical_allocation_rules_crud ON public.analytical_allocation_rules;
CREATE TRIGGER trg_audit_analytical_allocation_rules_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_allocation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_analytical_allocations_crud ON public.analytical_allocations;
CREATE TRIGGER trg_audit_analytical_allocations_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_analytical_inclusion_rules_crud ON public.analytical_inclusion_rules;
CREATE TRIGGER trg_audit_analytical_inclusion_rules_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_inclusion_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_analytical_budgets_crud ON public.analytical_budgets;
CREATE TRIGGER trg_audit_analytical_budgets_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
DROP TRIGGER IF EXISTS trg_audit_analytical_budget_lines_crud ON public.analytical_budget_lines;
CREATE TRIGGER trg_audit_analytical_budget_lines_crud
  AFTER INSERT OR UPDATE OR DELETE ON public.analytical_budget_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.log_analytical_financial_crud_audit();
COMMENT ON TABLE public.cost_centers IS 'ACTIVE: Analytical accounting cost centers with principal/auxiliary/structure split.';
COMMENT ON TABLE public.analytical_budgets IS 'ACTIVE: Analytical budgets by object/cost center/axis with monthly lines.';
COMMENT ON TABLE public.analytical_allocations IS 'ACTIVE: Analytical allocations per accounting entry with hard balancing constraints.';
COMMIT;
