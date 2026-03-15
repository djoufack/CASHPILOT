-- ============================================================
-- Migration: Smart Dunning IA
-- Feature 9: Relances personnalisées par canal avec timing
-- optimisé par IA. Taux de recouvrement +30%.
-- ============================================================

-- ===========================================
-- 1. Table dunning_campaigns
-- ===========================================
CREATE TABLE IF NOT EXISTS public.dunning_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL DEFAULT 'standard' CHECK (strategy IN ('gentle', 'standard', 'aggressive', 'custom')),
    channels TEXT[] DEFAULT '{email}',
    max_steps INTEGER NOT NULL DEFAULT 3,
    auto_escalate BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- 2. Table dunning_executions
-- ===========================================
CREATE TABLE IF NOT EXISTS public.dunning_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.dunning_campaigns(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL DEFAULT 1,
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'whatsapp', 'letter')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'responded', 'paid', 'failed')),
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    response_at TIMESTAMPTZ,
    message_content TEXT,
    ai_score NUMERIC(5,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- 3. Table dunning_templates
-- ===========================================
CREATE TABLE IF NOT EXISTS public.dunning_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.dunning_campaigns(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL DEFAULT 1,
    channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'whatsapp', 'letter')),
    subject TEXT,
    body TEXT NOT NULL,
    tone TEXT NOT NULL DEFAULT 'professional' CHECK (tone IN ('friendly', 'professional', 'firm', 'urgent')),
    language TEXT NOT NULL DEFAULT 'fr',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ===========================================
-- 4. Indexes
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_dunning_campaigns_lookup
    ON public.dunning_campaigns (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_dunning_campaigns_active
    ON public.dunning_campaigns (company_id, is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_dunning_executions_lookup
    ON public.dunning_executions (user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_dunning_executions_campaign
    ON public.dunning_executions (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_dunning_executions_invoice
    ON public.dunning_executions (invoice_id, step_number);

CREATE INDEX IF NOT EXISTS idx_dunning_executions_client
    ON public.dunning_executions (client_id, status);

CREATE INDEX IF NOT EXISTS idx_dunning_executions_scheduled
    ON public.dunning_executions (scheduled_at) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_dunning_templates_campaign
    ON public.dunning_templates (campaign_id, step_number);

CREATE INDEX IF NOT EXISTS idx_dunning_templates_lookup
    ON public.dunning_templates (user_id, company_id);

-- ===========================================
-- 5. RLS Policies — dunning_campaigns
-- ===========================================
ALTER TABLE public.dunning_campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_campaigns' AND policyname = 'dunning_campaigns_select_own') THEN
        CREATE POLICY "dunning_campaigns_select_own" ON public.dunning_campaigns
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_campaigns' AND policyname = 'dunning_campaigns_insert_own') THEN
        CREATE POLICY "dunning_campaigns_insert_own" ON public.dunning_campaigns
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_campaigns' AND policyname = 'dunning_campaigns_update_own') THEN
        CREATE POLICY "dunning_campaigns_update_own" ON public.dunning_campaigns
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_campaigns' AND policyname = 'dunning_campaigns_delete_own') THEN
        CREATE POLICY "dunning_campaigns_delete_own" ON public.dunning_campaigns
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ===========================================
-- 6. RLS Policies — dunning_executions
-- ===========================================
ALTER TABLE public.dunning_executions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_executions' AND policyname = 'dunning_executions_select_own') THEN
        CREATE POLICY "dunning_executions_select_own" ON public.dunning_executions
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_executions' AND policyname = 'dunning_executions_insert_own') THEN
        CREATE POLICY "dunning_executions_insert_own" ON public.dunning_executions
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_executions' AND policyname = 'dunning_executions_update_own') THEN
        CREATE POLICY "dunning_executions_update_own" ON public.dunning_executions
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_executions' AND policyname = 'dunning_executions_delete_own') THEN
        CREATE POLICY "dunning_executions_delete_own" ON public.dunning_executions
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ===========================================
-- 7. RLS Policies — dunning_templates
-- ===========================================
ALTER TABLE public.dunning_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_templates' AND policyname = 'dunning_templates_select_own') THEN
        CREATE POLICY "dunning_templates_select_own" ON public.dunning_templates
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_templates' AND policyname = 'dunning_templates_insert_own') THEN
        CREATE POLICY "dunning_templates_insert_own" ON public.dunning_templates
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_templates' AND policyname = 'dunning_templates_update_own') THEN
        CREATE POLICY "dunning_templates_update_own" ON public.dunning_templates
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'dunning_templates' AND policyname = 'dunning_templates_delete_own') THEN
        CREATE POLICY "dunning_templates_delete_own" ON public.dunning_templates
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ===========================================
-- 8. RPC: get_smart_dunning_suggestions
-- Analyses overdue invoices, scores each client
-- (payment history, amount, age), recommends
-- optimal timing and channel
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_smart_dunning_suggestions(
    p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_suggestions JSONB := '[]'::JSONB;
    v_stats JSONB;
    v_rec RECORD;
    v_payment_count INTEGER;
    v_paid_on_time INTEGER;
    v_avg_delay NUMERIC;
    v_total_overdue NUMERIC := 0;
    v_total_clients INTEGER := 0;
    v_ai_score NUMERIC(5,2);
    v_recommended_channel TEXT;
    v_recommended_tone TEXT;
    v_urgency TEXT;
    v_days_overdue INTEGER;
    v_last_dunning TIMESTAMPTZ;
    v_dunning_count INTEGER;
BEGIN
    -- Verify authentication
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify company ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.company
        WHERE id = p_company_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Company not found or access denied';
    END IF;

    -- Iterate over overdue invoices
    FOR v_rec IN
        SELECT
            i.id AS invoice_id,
            i.invoice_number,
            i.total_ttc,
            COALESCE(i.balance_due, i.total_ttc) AS balance_due,
            i.due_date,
            i.client_id,
            c.company_name AS client_name,
            c.email AS client_email,
            c.phone AS client_phone,
            (CURRENT_DATE - i.due_date)::INTEGER AS days_overdue
        FROM public.invoices i
        LEFT JOIN public.clients c ON c.id = i.client_id
        WHERE i.company_id = p_company_id
          AND i.user_id = v_user_id
          AND i.payment_status IN ('unpaid', 'partial')
          AND i.due_date < CURRENT_DATE
          AND i.status IN ('sent', 'overdue', 'accepted')
        ORDER BY (CURRENT_DATE - i.due_date) DESC
    LOOP
        v_days_overdue := v_rec.days_overdue;
        v_total_overdue := v_total_overdue + COALESCE(v_rec.balance_due, v_rec.total_ttc);
        v_total_clients := v_total_clients + 1;

        -- Analyse client payment history
        SELECT COUNT(*), COUNT(*) FILTER (WHERE payment_date <= i.due_date)
        INTO v_payment_count, v_paid_on_time
        FROM public.payments p
        JOIN public.invoices i ON i.id = p.invoice_id
        WHERE p.company_id = p_company_id
          AND p.user_id = v_user_id
          AND i.client_id = v_rec.client_id;

        -- Average payment delay for this client
        SELECT COALESCE(AVG(
            EXTRACT(DAY FROM (p.payment_date::TIMESTAMP - i.due_date::TIMESTAMP))
        ), 0)
        INTO v_avg_delay
        FROM public.payments p
        JOIN public.invoices i ON i.id = p.invoice_id
        WHERE p.company_id = p_company_id
          AND p.user_id = v_user_id
          AND i.client_id = v_rec.client_id;

        -- Previous dunning for this invoice
        SELECT COUNT(*), MAX(sent_at)
        INTO v_dunning_count, v_last_dunning
        FROM public.dunning_history
        WHERE invoice_id = v_rec.invoice_id;

        -- Also check smart dunning executions
        SELECT COUNT(*) + COALESCE(v_dunning_count, 0), GREATEST(MAX(sent_at), v_last_dunning)
        INTO v_dunning_count, v_last_dunning
        FROM public.dunning_executions
        WHERE invoice_id = v_rec.invoice_id
          AND status NOT IN ('pending', 'failed');

        -- ===========================================
        -- AI Scoring Algorithm
        -- Score 0-100: higher = higher recovery probability
        -- Factors: days overdue, amount, payment history, dunning count
        -- ===========================================
        v_ai_score := 50; -- baseline

        -- Days overdue factor (more overdue = lower score)
        IF v_days_overdue <= 7 THEN
            v_ai_score := v_ai_score + 30;
        ELSIF v_days_overdue <= 15 THEN
            v_ai_score := v_ai_score + 20;
        ELSIF v_days_overdue <= 30 THEN
            v_ai_score := v_ai_score + 10;
        ELSIF v_days_overdue <= 60 THEN
            v_ai_score := v_ai_score + 0;
        ELSE
            v_ai_score := v_ai_score - 15;
        END IF;

        -- Payment history factor
        IF v_payment_count > 0 THEN
            v_ai_score := v_ai_score + (v_paid_on_time::NUMERIC / v_payment_count * 20);
        END IF;

        -- Dunning fatigue (more dunning attempts = lower score)
        v_ai_score := v_ai_score - LEAST(v_dunning_count * 5, 20);

        -- Clamp to 0-100
        v_ai_score := GREATEST(LEAST(v_ai_score, 99.99), 0.01);

        -- ===========================================
        -- Channel recommendation
        -- ===========================================
        IF v_days_overdue <= 7 THEN
            v_recommended_channel := 'email';
            v_recommended_tone := 'friendly';
            v_urgency := 'low';
        ELSIF v_days_overdue <= 15 THEN
            v_recommended_channel := 'email';
            v_recommended_tone := 'professional';
            v_urgency := 'medium';
        ELSIF v_days_overdue <= 30 THEN
            -- If client has a phone, use SMS/WhatsApp for better engagement
            IF v_rec.client_phone IS NOT NULL AND v_rec.client_phone != '' THEN
                v_recommended_channel := 'sms';
            ELSE
                v_recommended_channel := 'email';
            END IF;
            v_recommended_tone := 'firm';
            v_urgency := 'high';
        ELSE
            -- Very overdue: escalate to letter or WhatsApp
            IF v_rec.client_phone IS NOT NULL AND v_rec.client_phone != '' THEN
                v_recommended_channel := 'whatsapp';
            ELSE
                v_recommended_channel := 'letter';
            END IF;
            v_recommended_tone := 'urgent';
            v_urgency := 'critical';
        END IF;

        -- Build suggestion
        v_suggestions := v_suggestions || jsonb_build_object(
            'invoice_id', v_rec.invoice_id,
            'invoice_number', v_rec.invoice_number,
            'client_id', v_rec.client_id,
            'client_name', COALESCE(v_rec.client_name, 'Client inconnu'),
            'client_email', v_rec.client_email,
            'client_phone', v_rec.client_phone,
            'total_ttc', ROUND(v_rec.total_ttc, 2),
            'balance_due', ROUND(COALESCE(v_rec.balance_due, v_rec.total_ttc), 2),
            'due_date', v_rec.due_date::TEXT,
            'days_overdue', v_days_overdue,
            'ai_score', ROUND(v_ai_score, 2),
            'recommended_channel', v_recommended_channel,
            'recommended_tone', v_recommended_tone,
            'urgency', v_urgency,
            'payment_history', jsonb_build_object(
                'total_payments', v_payment_count,
                'paid_on_time', v_paid_on_time,
                'avg_delay_days', ROUND(v_avg_delay, 1)
            ),
            'dunning_history', jsonb_build_object(
                'count', v_dunning_count,
                'last_sent', v_last_dunning
            ),
            'recommended_step', LEAST(COALESCE(v_dunning_count, 0) + 1, 5)
        );
    END LOOP;

    -- Build summary stats
    v_stats := jsonb_build_object(
        'total_overdue_amount', ROUND(v_total_overdue, 2),
        'total_overdue_invoices', v_total_clients,
        'avg_ai_score', CASE
            WHEN v_total_clients > 0 THEN ROUND((
                SELECT AVG((s->>'ai_score')::NUMERIC)
                FROM jsonb_array_elements(v_suggestions) AS s
            ), 2)
            ELSE 0
        END,
        'urgency_breakdown', jsonb_build_object(
            'critical', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'urgency' = 'critical'),
            'high', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'urgency' = 'high'),
            'medium', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'urgency' = 'medium'),
            'low', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'urgency' = 'low')
        ),
        'channel_breakdown', jsonb_build_object(
            'email', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'recommended_channel' = 'email'),
            'sms', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'recommended_channel' = 'sms'),
            'whatsapp', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'recommended_channel' = 'whatsapp'),
            'letter', (SELECT COUNT(*) FROM jsonb_array_elements(v_suggestions) s WHERE s->>'recommended_channel' = 'letter')
        ),
        'computed_at', now()::TEXT
    );

    RETURN jsonb_build_object(
        'suggestions', v_suggestions,
        'stats', v_stats
    );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_smart_dunning_suggestions(UUID) TO authenticated;
