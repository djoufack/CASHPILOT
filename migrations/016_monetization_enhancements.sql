-- Migration 016: Monetization Enhancements
-- Updates credit packages to final pricing, adds referral system, welcome credits trigger

-- ============================================
-- 1. Update credit packages to final pricing
-- ============================================
DELETE FROM public.credit_packages;
INSERT INTO public.credit_packages (name, credits, price_cents, currency, stripe_price_id, sort_order) VALUES
    ('Starter',    100,   499,  'EUR', NULL, 1),
    ('Pro',        500,   1999, 'EUR', NULL, 2),
    ('Business',   1500,  4999, 'EUR', NULL, 3),
    ('Enterprise', 5000,  12999,'EUR', NULL, 4);

-- ============================================
-- 2. Update default free credits to 50
-- ============================================
ALTER TABLE public.user_credits ALTER COLUMN free_credits SET DEFAULT 50;

-- Update existing users who still have the old default of 10 (unused)
UPDATE public.user_credits SET free_credits = 50 WHERE free_credits = 10 AND total_used = 0;

-- ============================================
-- 3. Referrals table
-- ============================================
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referral_code TEXT NOT NULL UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
    bonus_credited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id);
DROP POLICY IF EXISTS "Users can create own referrals" ON public.referrals;
CREATE POLICY "Users can create own referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_user_id);
DROP POLICY IF EXISTS "Users can update own referrals" ON public.referrals;
CREATE POLICY "Users can update own referrals" ON public.referrals FOR UPDATE USING (auth.uid() = referrer_user_id);
-- Allow referred users to update their referral (to complete it)
DROP POLICY IF EXISTS "Referred users can update referral" ON public.referrals;
CREATE POLICY "Referred users can update referral" ON public.referrals FOR UPDATE USING (auth.uid() = referred_user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_user_id);

-- ============================================
-- 4. Add referral_code to user_credits for easy lookup
-- ============================================
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- ============================================
-- 5. Function: generate referral code on user_credits creation
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.referral_code IS NULL THEN
        NEW.referral_code := 'CP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_referral_code ON public.user_credits;
CREATE TRIGGER trigger_generate_referral_code
    BEFORE INSERT ON public.user_credits
    FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- ============================================
-- 6. Function: auto-create user_credits with 50 free credits on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_credits (user_id, free_credits, paid_credits, total_used)
    VALUES (NEW.id, 50, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Log the welcome bonus
    INSERT INTO public.credit_transactions (user_id, type, amount, description)
    VALUES (NEW.id, 'bonus', 50, 'Welcome bonus — 50 free credits');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_credits();

-- ============================================
-- 7. Generate referral codes for existing users
-- ============================================
UPDATE public.user_credits
SET referral_code = 'CP-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;
