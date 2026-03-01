-- ============================================================================
-- Migration 049: Currency conversion engine
-- ============================================================================
-- Goal:
--   - Formalize the company accounting currency in the database.
--   - Store global and company-specific FX rates in a single canonical table.
--   - Provide SQL functions to resolve an exchange rate and convert an amount.
--   - Keep the engine database-first so all future analytics can rely on it.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Company accounting currency
-- ----------------------------------------------------------------------------

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS accounting_currency VARCHAR(3);

UPDATE public.company
SET accounting_currency = UPPER(COALESCE(accounting_currency, currency, 'EUR'))
WHERE accounting_currency IS NULL
   OR accounting_currency <> UPPER(accounting_currency)
   OR accounting_currency = '';

ALTER TABLE public.company
  ALTER COLUMN accounting_currency SET DEFAULT 'EUR';

ALTER TABLE public.company
  ALTER COLUMN accounting_currency SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_accounting_currency_check'
      AND conrelid = 'public.company'::regclass
  ) THEN
    ALTER TABLE public.company
      ADD CONSTRAINT company_accounting_currency_check
      CHECK (accounting_currency ~ '^[A-Z]{3}$');
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

COMMENT ON COLUMN public.company.currency IS
'Legacy company currency field. Until full migration, it should remain aligned with accounting_currency.';

COMMENT ON COLUMN public.company.accounting_currency IS
'Canonical accounting/reporting currency for analytics, accounting, and steering. ISO 4217 uppercase code.';

-- ----------------------------------------------------------------------------
-- B. Canonical FX rate storage
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  base_currency VARCHAR(3) NOT NULL,
  quote_currency VARCHAR(3) NOT NULL,
  rate_date DATE NOT NULL,
  exchange_rate NUMERIC(20,10) NOT NULL CHECK (exchange_rate > 0),
  source TEXT NOT NULL DEFAULT 'manual',
  is_fixed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fx_rates_currency_code_check CHECK (
    base_currency ~ '^[A-Z]{3}$' AND quote_currency ~ '^[A-Z]{3}$'
  ),
  CONSTRAINT fx_rates_no_identity_pair CHECK (base_currency <> quote_currency)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fx_rates_global_unique
  ON public.fx_rates(rate_date, base_currency, quote_currency)
  WHERE company_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fx_rates_company_unique
  ON public.fx_rates(company_id, rate_date, base_currency, quote_currency)
  WHERE company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup_global
  ON public.fx_rates(base_currency, quote_currency, rate_date DESC)
  WHERE company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_fx_rates_lookup_company
  ON public.fx_rates(company_id, base_currency, quote_currency, rate_date DESC)
  WHERE company_id IS NOT NULL;

COMMENT ON TABLE public.fx_rates IS
'Canonical exchange rate table. Global rows have company_id = NULL. Company-specific overrides take precedence.';

COMMENT ON COLUMN public.fx_rates.exchange_rate IS
'Amount of quote_currency for 1 unit of base_currency on rate_date.';

CREATE OR REPLACE FUNCTION public.touch_fx_rates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  NEW.base_currency = UPPER(NEW.base_currency);
  NEW.quote_currency = UPPER(NEW.quote_currency);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fx_rates_touch_updated_at ON public.fx_rates;
CREATE TRIGGER trg_fx_rates_touch_updated_at
  BEFORE UPDATE OR INSERT ON public.fx_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_fx_rates_updated_at();

-- ----------------------------------------------------------------------------
-- C. Helper functions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.normalize_currency_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(UPPER(TRIM(COALESCE(p_code, ''))), '');
$$;

COMMENT ON FUNCTION public.normalize_currency_code(TEXT) IS
'Normalizes a currency code to uppercase ISO 4217 form.';

CREATE OR REPLACE FUNCTION public.get_exchange_rate(
  p_from_currency TEXT,
  p_to_currency TEXT,
  p_effective_on DATE DEFAULT CURRENT_DATE,
  p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
  exchange_rate NUMERIC,
  rate_date DATE,
  source_scope TEXT,
  is_stale BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_from TEXT := public.normalize_currency_code(p_from_currency);
  v_to TEXT := public.normalize_currency_code(p_to_currency);
  v_rate NUMERIC;
  v_rate_date DATE;
  v_from_to_eur NUMERIC;
  v_eur_to_target NUMERIC;
  v_from_eur_date DATE;
  v_eur_to_date DATE;
  v_from_eur_stale BOOLEAN;
  v_eur_to_stale BOOLEAN;
BEGIN
  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN;
  END IF;

  IF v_from = v_to THEN
    RETURN QUERY
    SELECT 1::NUMERIC, COALESCE(p_effective_on, CURRENT_DATE), 'identity'::TEXT, false;
    RETURN;
  END IF;

  IF p_company_id IS NOT NULL THEN
    SELECT r.exchange_rate, r.rate_date
    INTO v_rate, v_rate_date
    FROM public.fx_rates AS r
    WHERE r.company_id = p_company_id
      AND r.base_currency = v_from
      AND r.quote_currency = v_to
      AND r.rate_date <= COALESCE(p_effective_on, CURRENT_DATE)
    ORDER BY r.rate_date DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT v_rate, v_rate_date, 'company_exact'::TEXT, v_rate_date < COALESCE(p_effective_on, CURRENT_DATE);
      RETURN;
    END IF;
  END IF;

  SELECT r.exchange_rate, r.rate_date
  INTO v_rate, v_rate_date
  FROM public.fx_rates AS r
  WHERE r.company_id IS NULL
    AND r.base_currency = v_from
    AND r.quote_currency = v_to
    AND r.rate_date <= COALESCE(p_effective_on, CURRENT_DATE)
  ORDER BY r.rate_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT v_rate, v_rate_date, 'global_exact'::TEXT, v_rate_date < COALESCE(p_effective_on, CURRENT_DATE);
    RETURN;
  END IF;

  IF p_company_id IS NOT NULL THEN
    SELECT 1 / r.exchange_rate, r.rate_date
    INTO v_rate, v_rate_date
    FROM public.fx_rates AS r
    WHERE r.company_id = p_company_id
      AND r.base_currency = v_to
      AND r.quote_currency = v_from
      AND r.rate_date <= COALESCE(p_effective_on, CURRENT_DATE)
    ORDER BY r.rate_date DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY
      SELECT v_rate, v_rate_date, 'company_inverse'::TEXT, v_rate_date < COALESCE(p_effective_on, CURRENT_DATE);
      RETURN;
    END IF;
  END IF;

  SELECT 1 / r.exchange_rate, r.rate_date
  INTO v_rate, v_rate_date
  FROM public.fx_rates AS r
  WHERE r.company_id IS NULL
    AND r.base_currency = v_to
    AND r.quote_currency = v_from
    AND r.rate_date <= COALESCE(p_effective_on, CURRENT_DATE)
  ORDER BY r.rate_date DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT v_rate, v_rate_date, 'global_inverse'::TEXT, v_rate_date < COALESCE(p_effective_on, CURRENT_DATE);
    RETURN;
  END IF;

  IF v_from <> 'EUR' AND v_to <> 'EUR' THEN
    SELECT g.exchange_rate, g.rate_date, g.is_stale
    INTO v_from_to_eur, v_from_eur_date, v_from_eur_stale
    FROM public.get_exchange_rate(v_from, 'EUR', COALESCE(p_effective_on, CURRENT_DATE), p_company_id) AS g
    LIMIT 1;

    SELECT g.exchange_rate, g.rate_date, g.is_stale
    INTO v_eur_to_target, v_eur_to_date, v_eur_to_stale
    FROM public.get_exchange_rate('EUR', v_to, COALESCE(p_effective_on, CURRENT_DATE), p_company_id) AS g
    LIMIT 1;

    IF v_from_to_eur IS NOT NULL AND v_eur_to_target IS NOT NULL THEN
      RETURN QUERY
      SELECT
        v_from_to_eur * v_eur_to_target,
        LEAST(v_from_eur_date, v_eur_to_date),
        'triangulated_eur'::TEXT,
        COALESCE(v_from_eur_stale, false) OR COALESCE(v_eur_to_stale, false);
      RETURN;
    END IF;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_exchange_rate(TEXT, TEXT, DATE, UUID) IS
'Returns the best available FX rate between two currencies, preferring company overrides, then global rates, then inverse, then EUR triangulation.';

CREATE OR REPLACE FUNCTION public.convert_currency_amount(
  p_amount NUMERIC,
  p_from_currency TEXT,
  p_to_currency TEXT,
  p_effective_on DATE DEFAULT CURRENT_DATE,
  p_company_id UUID DEFAULT NULL,
  p_scale INTEGER DEFAULT 6
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC;
BEGIN
  IF p_amount IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT g.exchange_rate
  INTO v_rate
  FROM public.get_exchange_rate(
    p_from_currency,
    p_to_currency,
    COALESCE(p_effective_on, CURRENT_DATE),
    p_company_id
  ) AS g
  LIMIT 1;

  IF v_rate IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN ROUND(p_amount * v_rate, GREATEST(COALESCE(p_scale, 6), 0));
END;
$$;

COMMENT ON FUNCTION public.convert_currency_amount(NUMERIC, TEXT, TEXT, DATE, UUID, INTEGER) IS
'Converts an amount using the best available database FX rate. Returns NULL when no conversion path exists.';

REVOKE ALL ON FUNCTION public.normalize_currency_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_exchange_rate(TEXT, TEXT, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.convert_currency_amount(NUMERIC, TEXT, TEXT, DATE, UUID, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.normalize_currency_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_exchange_rate(TEXT, TEXT, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_currency_amount(NUMERIC, TEXT, TEXT, DATE, UUID, INTEGER) TO authenticated;

-- ----------------------------------------------------------------------------
-- D. RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read accessible fx rates" ON public.fx_rates;
DROP POLICY IF EXISTS "Users can manage own company fx rates" ON public.fx_rates;

CREATE POLICY "Authenticated users can read accessible fx rates"
ON public.fx_rates
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND (
    company_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.company AS c
      WHERE c.id = fx_rates.company_id
        AND c.user_id = auth.uid()
    )
    OR public.is_admin()
  )
);

CREATE POLICY "Users can manage own company fx rates"
ON public.fx_rates
FOR ALL
USING (
  company_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.company AS c
      WHERE c.id = fx_rates.company_id
        AND c.user_id = auth.uid()
    )
    OR public.is_admin()
  )
)
WITH CHECK (
  company_id IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.company AS c
      WHERE c.id = fx_rates.company_id
        AND c.user_id = auth.uid()
    )
    OR public.is_admin()
  )
);

-- ----------------------------------------------------------------------------
-- E. Seed immutable CFA parity baselines
-- ----------------------------------------------------------------------------

INSERT INTO public.fx_rates (
  company_id,
  base_currency,
  quote_currency,
  rate_date,
  exchange_rate,
  source,
  is_fixed,
  metadata
)
VALUES
  (NULL, 'EUR', 'XAF', DATE '2000-01-01', 655.9570000000, 'fixed_parity', true, '{"note":"CFA parity baseline"}'::jsonb),
  (NULL, 'EUR', 'XOF', DATE '2000-01-01', 655.9570000000, 'fixed_parity', true, '{"note":"CFA parity baseline"}'::jsonb),
  (NULL, 'XAF', 'XOF', DATE '2000-01-01', 1.0000000000, 'fixed_parity', true, '{"note":"CFA parity baseline"}'::jsonb)
ON CONFLICT DO NOTHING;
