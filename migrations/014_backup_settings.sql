-- Migration 014: Auto-Backup Settings (Google Drive / Dropbox)
-- Allows users to configure automatic backups of their data

-- ============================================
-- 1. Backup settings table
-- ============================================
CREATE TABLE IF NOT EXISTS public.backup_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT DEFAULT 'none' CHECK (provider IN ('none', 'google_drive', 'dropbox')),
    is_enabled BOOLEAN DEFAULT false,
    frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    last_backup_at TIMESTAMPTZ,
    next_backup_at TIMESTAMPTZ,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    folder_id TEXT,
    folder_name TEXT DEFAULT 'CashPilot Backups',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_backup UNIQUE (user_id)
);

-- ============================================
-- 2. Backup logs table
-- ============================================
CREATE TABLE IF NOT EXISTS public.backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'in_progress')),
    file_name TEXT,
    file_size_bytes INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- ============================================
-- 3. Enable RLS
-- ============================================
ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS Policies
-- ============================================
-- backup_settings
DROP POLICY IF EXISTS "Users can view own backup settings" ON public.backup_settings;
CREATE POLICY "Users can view own backup settings" ON public.backup_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own backup settings" ON public.backup_settings;
CREATE POLICY "Users can create own backup settings" ON public.backup_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own backup settings" ON public.backup_settings;
CREATE POLICY "Users can update own backup settings" ON public.backup_settings FOR UPDATE USING (auth.uid() = user_id);

-- backup_logs
DROP POLICY IF EXISTS "Users can view own backup logs" ON public.backup_logs;
CREATE POLICY "Users can view own backup logs" ON public.backup_logs FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own backup logs" ON public.backup_logs;
CREATE POLICY "Users can create own backup logs" ON public.backup_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_backup_settings_user_id ON public.backup_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_logs_user_id ON public.backup_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_logs_status ON public.backup_logs(status);
