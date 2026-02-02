-- Migration 013: Stripe Integration & Credits System
-- Adds credits system for monetization (visualizations & exports cost credits)

-- ============================================
-- 1. User credits table
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    free_credits INTEGER DEFAULT 10,
    paid_credits INTEGER DEFAULT 0,
    total_used INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_credits UNIQUE (user_id)
);

-- ============================================
-- 2. Credit transactions log
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'bonus', 'refund')),
    amount INTEGER NOT NULL,
    description TEXT,
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Stripe settings per user
-- ============================================
CREATE TABLE IF NOT EXISTS public.stripe_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_customer_id TEXT,
    stripe_enabled BOOLEAN DEFAULT false,
    stripe_publishable_key TEXT,
    stripe_mode TEXT DEFAULT 'test' CHECK (stripe_mode IN ('test', 'live')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_stripe UNIQUE (user_id)
);

-- ============================================
-- 4. Credit packages (admin-configurable)
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'EUR',
    is_active BOOLEAN DEFAULT true,
    stripe_price_id TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default packages
INSERT INTO public.credit_packages (name, credits, price_cents, currency, sort_order) VALUES
    ('Starter', 10, 499, 'EUR', 1),
    ('Standard', 50, 1999, 'EUR', 2),
    ('Premium', 200, 5999, 'EUR', 3),
    ('Enterprise', 1000, 19999, 'EUR', 4)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Enable RLS
-- ============================================
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies
-- ============================================
-- user_credits
DROP POLICY IF EXISTS "Users can view own credits" ON public.user_credits;
CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own credits" ON public.user_credits;
CREATE POLICY "Users can create own credits" ON public.user_credits FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own credits" ON public.user_credits;
CREATE POLICY "Users can update own credits" ON public.user_credits FOR UPDATE USING (auth.uid() = user_id);

-- credit_transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.credit_transactions;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own transactions" ON public.credit_transactions;
CREATE POLICY "Users can create own transactions" ON public.credit_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- stripe_settings
DROP POLICY IF EXISTS "Users can view own stripe settings" ON public.stripe_settings;
CREATE POLICY "Users can view own stripe settings" ON public.stripe_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert own stripe settings" ON public.stripe_settings;
CREATE POLICY "Users can upsert own stripe settings" ON public.stripe_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own stripe settings" ON public.stripe_settings;
CREATE POLICY "Users can update own stripe settings" ON public.stripe_settings FOR UPDATE USING (auth.uid() = user_id);

-- credit_packages (readable by all authenticated users)
DROP POLICY IF EXISTS "Anyone can view active packages" ON public.credit_packages;
CREATE POLICY "Anyone can view active packages" ON public.credit_packages FOR SELECT USING (true);

-- ============================================
-- 7. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(type);
CREATE INDEX IF NOT EXISTS idx_stripe_settings_user_id ON public.stripe_settings(user_id);

-- ============================================
-- 8. Initialize credits for existing users
-- ============================================
INSERT INTO public.user_credits (user_id, free_credits, paid_credits, total_used)
SELECT id, 10, 0, 0 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
