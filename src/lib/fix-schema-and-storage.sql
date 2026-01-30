
-- ==========================================
-- RUN THIS SCRIPT IN SUPABASE SQL EDITOR
-- ==========================================

-- 1. Create the 'avatars' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Create the 'signatures' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Add policy to allow public viewing of avatars
DROP POLICY IF EXISTS "Public Access Avatars" ON storage.objects;
CREATE POLICY "Public Access Avatars" ON storage.objects
  FOR SELECT USING ( bucket_id = 'avatars' );

-- 4. Add policy to allow authenticated uploads to avatars
DROP POLICY IF EXISTS "Auth Upload Avatars" ON storage.objects;
CREATE POLICY "Auth Upload Avatars" ON storage.objects
  FOR INSERT WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 5. Add policy to allow users to update their own avatars
DROP POLICY IF EXISTS "Auth Update Avatars" ON storage.objects;
CREATE POLICY "Auth Update Avatars" ON storage.objects
  FOR UPDATE WITH CHECK ( bucket_id = 'avatars' AND auth.role() = 'authenticated' );

-- 6. Add missing columns to profiles table safely
DO $$
BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS postal_code text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signature_url text;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'Column already exists, skipping.';
END $$;

-- 7. Force schema cache reload (helps with "Could not find column" errors)
NOTIFY pgrst, 'reload schema';
