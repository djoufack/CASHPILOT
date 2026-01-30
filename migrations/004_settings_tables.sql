
-- ==============================================================================
-- MIGRATION 004: Settings tables for Billing, Team, Notifications
-- ==============================================================================
-- IDEMPOTENT: Safe to re-run
-- ==============================================================================

-- 1. Notification preferences table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email_new_tasks BOOLEAN DEFAULT true,
    email_overdue_tasks BOOLEAN DEFAULT true,
    email_completed_tasks BOOLEAN DEFAULT false,
    email_comments BOOLEAN DEFAULT true,
    email_project_updates BOOLEAN DEFAULT true,
    email_reminders BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    push_new_tasks BOOLEAN DEFAULT true,
    push_comments BOOLEAN DEFAULT true,
    frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'daily', 'weekly')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Team members table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
    joined_at DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own team members" ON public.team_members;
CREATE POLICY "Users can view own team members" ON public.team_members
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own team members" ON public.team_members;
CREATE POLICY "Users can insert own team members" ON public.team_members
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own team members" ON public.team_members;
CREATE POLICY "Users can update own team members" ON public.team_members
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own team members" ON public.team_members;
CREATE POLICY "Users can delete own team members" ON public.team_members
    FOR DELETE USING (auth.uid() = user_id);

-- 3. Billing info table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_info (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    company_name TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT,
    vat_number TEXT,
    siret TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    plan_price NUMERIC(10,2) DEFAULT 0,
    plan_interval TEXT DEFAULT 'month' CHECK (plan_interval IN ('month', 'year')),
    next_billing_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_info_user_id ON public.billing_info(user_id);
ALTER TABLE public.billing_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing info" ON public.billing_info;
CREATE POLICY "Users can view own billing info" ON public.billing_info
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own billing info" ON public.billing_info;
CREATE POLICY "Users can insert own billing info" ON public.billing_info
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own billing info" ON public.billing_info;
CREATE POLICY "Users can update own billing info" ON public.billing_info
    FOR UPDATE USING (auth.uid() = user_id);

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_notification_preferences_modtime ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_modtime BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_team_members_modtime ON public.team_members;
CREATE TRIGGER update_team_members_modtime BEFORE UPDATE ON public.team_members FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_info_modtime ON public.billing_info;
CREATE TRIGGER update_billing_info_modtime BEFORE UPDATE ON public.billing_info FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
