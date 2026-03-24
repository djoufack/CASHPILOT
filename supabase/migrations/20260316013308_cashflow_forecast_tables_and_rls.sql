-- ===========================================
-- 1. Table cashflow_forecasts
-- ===========================================
CREATE TABLE IF NOT EXISTS public.cashflow_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    forecast_date DATE NOT NULL,
    period_days INTEGER NOT NULL DEFAULT 30,
    scenario TEXT DEFAULT 'baseline' CHECK (scenario IN ('optimistic', 'baseline', 'pessimistic')),
    starting_balance NUMERIC(15,2),
    projected_inflows NUMERIC(15,2),
    projected_outflows NUMERIC(15,2),
    projected_balance NUMERIC(15,2),
    alert_type TEXT CHECK (alert_type IN ('overdraft_risk', 'low_balance', 'growth_opportunity') OR alert_type IS NULL),
    alert_message TEXT,
    data_points JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- 2. Table cashflow_scenarios
-- ===========================================
CREATE TABLE IF NOT EXISTS public.cashflow_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    assumptions JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- 3. Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_cashflow_forecasts_lookup
    ON public.cashflow_forecasts (user_id, company_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_cashflow_forecasts_scenario
    ON public.cashflow_forecasts (company_id, scenario);

CREATE INDEX IF NOT EXISTS idx_cashflow_scenarios_lookup
    ON public.cashflow_scenarios (user_id, company_id);

-- ===========================================
-- 4. RLS Policies -- cashflow_forecasts
-- ===========================================
ALTER TABLE public.cashflow_forecasts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_forecasts' AND policyname = 'cashflow_forecasts_select_own') THEN
        CREATE POLICY "cashflow_forecasts_select_own" ON public.cashflow_forecasts
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_forecasts' AND policyname = 'cashflow_forecasts_insert_own') THEN
        CREATE POLICY "cashflow_forecasts_insert_own" ON public.cashflow_forecasts
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_forecasts' AND policyname = 'cashflow_forecasts_update_own') THEN
        CREATE POLICY "cashflow_forecasts_update_own" ON public.cashflow_forecasts
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_forecasts' AND policyname = 'cashflow_forecasts_delete_own') THEN
        CREATE POLICY "cashflow_forecasts_delete_own" ON public.cashflow_forecasts
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ===========================================
-- 5. RLS Policies -- cashflow_scenarios
-- ===========================================
ALTER TABLE public.cashflow_scenarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_scenarios' AND policyname = 'cashflow_scenarios_select_own') THEN
        CREATE POLICY "cashflow_scenarios_select_own" ON public.cashflow_scenarios
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_scenarios' AND policyname = 'cashflow_scenarios_insert_own') THEN
        CREATE POLICY "cashflow_scenarios_insert_own" ON public.cashflow_scenarios
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_scenarios' AND policyname = 'cashflow_scenarios_update_own') THEN
        CREATE POLICY "cashflow_scenarios_update_own" ON public.cashflow_scenarios
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cashflow_scenarios' AND policyname = 'cashflow_scenarios_delete_own') THEN
        CREATE POLICY "cashflow_scenarios_delete_own" ON public.cashflow_scenarios
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;;
