
-- ==============================================================================
-- MIGRATION 005: Add missing columns to profiles table
-- ==============================================================================
-- The ProfileSettings form sends city, postal_code, country, currency,
-- timezone, and signature_url but these columns don't exist in the table.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'city') THEN
        ALTER TABLE public.profiles ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'postal_code') THEN
        ALTER TABLE public.profiles ADD COLUMN postal_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'country') THEN
        ALTER TABLE public.profiles ADD COLUMN country TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'currency') THEN
        ALTER TABLE public.profiles ADD COLUMN currency TEXT DEFAULT 'EUR';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'timezone') THEN
        ALTER TABLE public.profiles ADD COLUMN timezone TEXT DEFAULT 'CET';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'signature_url') THEN
        ALTER TABLE public.profiles ADD COLUMN signature_url TEXT;
    END IF;
END $$;
