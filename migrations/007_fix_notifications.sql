-- ==============================================================================
-- MIGRATION 007: Fix notifications table — add missing columns & RLS
-- ==============================================================================
-- The code uses is_read, title, read_at but the original schema only has
-- read, message, type. This migration aligns the DB with the frontend code.
-- ==============================================================================

-- Add missing columns
DO $$
BEGIN
    -- Add 'title' column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'title') THEN
        ALTER TABLE public.notifications ADD COLUMN title TEXT;
    END IF;

    -- Add 'is_read' column (the code uses is_read, not read)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'is_read') THEN
        ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
    END IF;

    -- Add 'read_at' column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'read_at') THEN
        ALTER TABLE public.notifications ADD COLUMN read_at TIMESTAMPTZ;
    END IF;

    -- Add 'updated_at' column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'updated_at') THEN
        ALTER TABLE public.notifications ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Migrate data: copy 'read' → 'is_read' for any existing rows
UPDATE public.notifications SET is_read = read WHERE is_read IS NULL AND read IS NOT NULL;

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_notifications_modtime ON public.notifications;
CREATE TRIGGER update_notifications_modtime BEFORE UPDATE ON public.notifications
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Create index
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
