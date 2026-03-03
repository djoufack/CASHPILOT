-- =====================================================================
-- S1-F1 : Amortissements / Immobilisations
-- Date : 2026-03-03
-- =====================================================================

-- Table principale des immobilisations
CREATE TABLE IF NOT EXISTS public.accounting_fixed_assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_name               TEXT NOT NULL,
  asset_code               TEXT,
  acquisition_date         DATE NOT NULL,
  acquisition_cost         NUMERIC(15,2) NOT NULL CHECK (acquisition_cost > 0),
  residual_value           NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (residual_value >= 0),
  useful_life_years        INTEGER NOT NULL CHECK (useful_life_years > 0),
  depreciation_method      TEXT NOT NULL DEFAULT 'linear'
    CHECK (depreciation_method IN ('linear', 'declining')),
  asset_type               TEXT NOT NULL DEFAULT 'tangible'
    CHECK (asset_type IN ('tangible', 'intangible', 'financial')),
  category                 TEXT,
  description              TEXT,
  status                   TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disposed', 'fully_depreciated')),
  disposal_date            DATE,
  disposal_value           NUMERIC(15,2),
  account_code_asset       TEXT DEFAULT '2154',
  account_code_depreciation TEXT DEFAULT '2815',
  account_code_expense     TEXT DEFAULT '6811',
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.accounting_fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_assets_user_policy"
  ON public.accounting_fixed_assets
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_user_id
  ON public.accounting_fixed_assets(user_id);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_status
  ON public.accounting_fixed_assets(user_id, status);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_fixed_assets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fixed_assets_updated_at ON public.accounting_fixed_assets;
CREATE TRIGGER trg_fixed_assets_updated_at
  BEFORE UPDATE ON public.accounting_fixed_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_fixed_assets_updated_at();

-- Table du plan d'amortissement (lignes calculées)
CREATE TABLE IF NOT EXISTS public.accounting_depreciation_schedule (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_id                 UUID NOT NULL REFERENCES public.accounting_fixed_assets(id) ON DELETE CASCADE,
  period_year              INTEGER NOT NULL,
  period_month             INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  depreciation_amount      NUMERIC(15,2) NOT NULL CHECK (depreciation_amount >= 0),
  accumulated_depreciation NUMERIC(15,2) NOT NULL CHECK (accumulated_depreciation >= 0),
  net_book_value           NUMERIC(15,2) NOT NULL,
  is_posted                BOOLEAN NOT NULL DEFAULT false,
  entry_ref                TEXT,
  posted_at                TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT now(),
  UNIQUE (asset_id, period_year, period_month)
);

ALTER TABLE public.accounting_depreciation_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "depreciation_schedule_user_policy"
  ON public.accounting_depreciation_schedule
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_depreciation_schedule_asset
  ON public.accounting_depreciation_schedule(asset_id);

CREATE INDEX IF NOT EXISTS idx_depreciation_schedule_period
  ON public.accounting_depreciation_schedule(user_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_depreciation_schedule_unposted
  ON public.accounting_depreciation_schedule(asset_id, is_posted)
  WHERE is_posted = false;
