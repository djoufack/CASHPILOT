-- Migration 012: Invoice Customization (Templates, Colors, Labels)
-- Adds invoice_settings table for per-user invoice customization

-- ============================================
-- 1. Create invoice_settings table
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoice_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id TEXT DEFAULT 'classic',
    color_theme TEXT DEFAULT 'default',
    custom_labels JSONB DEFAULT '{}',
    show_logo BOOLEAN DEFAULT true,
    show_bank_details BOOLEAN DEFAULT true,
    show_payment_terms BOOLEAN DEFAULT true,
    footer_text TEXT DEFAULT '',
    font_family TEXT DEFAULT 'Inter',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_invoice_settings UNIQUE (user_id)
);

-- ============================================
-- 2. Enable RLS
-- ============================================
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. RLS Policies
-- ============================================
DROP POLICY IF EXISTS "Users can view own invoice settings" ON public.invoice_settings;
CREATE POLICY "Users can view own invoice settings" ON public.invoice_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own invoice settings" ON public.invoice_settings;
CREATE POLICY "Users can create own invoice settings" ON public.invoice_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own invoice settings" ON public.invoice_settings;
CREATE POLICY "Users can update own invoice settings" ON public.invoice_settings
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own invoice settings" ON public.invoice_settings;
CREATE POLICY "Users can delete own invoice settings" ON public.invoice_settings
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. Index
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoice_settings_user_id ON public.invoice_settings(user_id);
