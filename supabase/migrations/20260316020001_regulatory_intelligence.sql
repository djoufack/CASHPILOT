-- ============================================================
-- Migration: Regulatory Intelligence
-- Feature 13: Automated regulatory monitoring per country.
-- Tracks regulatory updates, compliance checklists, and
-- subscription preferences per company/country.
-- ============================================================

-- ===========================================
-- 1. Table regulatory_updates
-- ===========================================
CREATE TABLE IF NOT EXISTS public.regulatory_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL,
    domain TEXT NOT NULL CHECK (domain IN ('tax', 'labor', 'accounting', 'corporate')),
    title TEXT NOT NULL,
    summary TEXT,
    source_url TEXT,
    effective_date DATE,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'actioned', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- 2. Table compliance_checklists
-- ===========================================
CREATE TABLE IF NOT EXISTS public.compliance_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    update_id UUID NOT NULL REFERENCES public.regulatory_updates(id) ON DELETE CASCADE,
    action_text TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    assigned_to TEXT,
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- 3. Table regulatory_subscriptions
-- ===========================================
CREATE TABLE IF NOT EXISTS public.regulatory_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL,
    domains TEXT[] DEFAULT '{tax,labor,accounting,corporate}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (company_id, country_code)
);

-- ===========================================
-- 4. Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_regulatory_updates_lookup
    ON public.regulatory_updates (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_regulatory_updates_country
    ON public.regulatory_updates (company_id, country_code);

CREATE INDEX IF NOT EXISTS idx_regulatory_updates_severity
    ON public.regulatory_updates (company_id, severity) WHERE severity = 'critical';

CREATE INDEX IF NOT EXISTS idx_regulatory_updates_status
    ON public.regulatory_updates (company_id, status) WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_regulatory_updates_effective_date
    ON public.regulatory_updates (effective_date DESC);

CREATE INDEX IF NOT EXISTS idx_compliance_checklists_lookup
    ON public.compliance_checklists (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_compliance_checklists_update
    ON public.compliance_checklists (update_id);

CREATE INDEX IF NOT EXISTS idx_compliance_checklists_pending
    ON public.compliance_checklists (company_id, is_completed) WHERE is_completed = false;

CREATE INDEX IF NOT EXISTS idx_regulatory_subscriptions_lookup
    ON public.regulatory_subscriptions (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_regulatory_subscriptions_country
    ON public.regulatory_subscriptions (company_id, country_code);

CREATE INDEX IF NOT EXISTS idx_regulatory_subscriptions_active
    ON public.regulatory_subscriptions (company_id, is_active) WHERE is_active = true;

-- ===========================================
-- 5. RLS Policies — regulatory_updates
-- ===========================================
ALTER TABLE public.regulatory_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_updates' AND policyname = 'regulatory_updates_select_own') THEN
        CREATE POLICY "regulatory_updates_select_own" ON public.regulatory_updates
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_updates' AND policyname = 'regulatory_updates_insert_own') THEN
        CREATE POLICY "regulatory_updates_insert_own" ON public.regulatory_updates
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_updates' AND policyname = 'regulatory_updates_update_own') THEN
        CREATE POLICY "regulatory_updates_update_own" ON public.regulatory_updates
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_updates' AND policyname = 'regulatory_updates_delete_own') THEN
        CREATE POLICY "regulatory_updates_delete_own" ON public.regulatory_updates
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ===========================================
-- 6. RLS Policies — compliance_checklists
-- ===========================================
ALTER TABLE public.compliance_checklists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_checklists' AND policyname = 'compliance_checklists_select_own') THEN
        CREATE POLICY "compliance_checklists_select_own" ON public.compliance_checklists
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_checklists' AND policyname = 'compliance_checklists_insert_own') THEN
        CREATE POLICY "compliance_checklists_insert_own" ON public.compliance_checklists
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_checklists' AND policyname = 'compliance_checklists_update_own') THEN
        CREATE POLICY "compliance_checklists_update_own" ON public.compliance_checklists
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'compliance_checklists' AND policyname = 'compliance_checklists_delete_own') THEN
        CREATE POLICY "compliance_checklists_delete_own" ON public.compliance_checklists
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ===========================================
-- 7. RLS Policies — regulatory_subscriptions
-- ===========================================
ALTER TABLE public.regulatory_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_subscriptions' AND policyname = 'regulatory_subscriptions_select_own') THEN
        CREATE POLICY "regulatory_subscriptions_select_own" ON public.regulatory_subscriptions
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_subscriptions' AND policyname = 'regulatory_subscriptions_insert_own') THEN
        CREATE POLICY "regulatory_subscriptions_insert_own" ON public.regulatory_subscriptions
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_subscriptions' AND policyname = 'regulatory_subscriptions_update_own') THEN
        CREATE POLICY "regulatory_subscriptions_update_own" ON public.regulatory_subscriptions
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'regulatory_subscriptions' AND policyname = 'regulatory_subscriptions_delete_own') THEN
        CREATE POLICY "regulatory_subscriptions_delete_own" ON public.regulatory_subscriptions
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
