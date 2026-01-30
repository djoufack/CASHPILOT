-- ==============================================================================
-- MIGRATION 006: Enrich company table with missing columns
-- ==============================================================================
-- The CompanySettings form sends city, postal_code, bank_name, bank_account,
-- iban, swift, phone, email, website, registration_number, tax_id
-- but some of these columns may not exist if the table was created before
-- the full migration was run.
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'city') THEN
        ALTER TABLE public.company ADD COLUMN city TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'postal_code') THEN
        ALTER TABLE public.company ADD COLUMN postal_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'country') THEN
        ALTER TABLE public.company ADD COLUMN country TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'phone') THEN
        ALTER TABLE public.company ADD COLUMN phone TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'email') THEN
        ALTER TABLE public.company ADD COLUMN email TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'website') THEN
        ALTER TABLE public.company ADD COLUMN website TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'registration_number') THEN
        ALTER TABLE public.company ADD COLUMN registration_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'tax_id') THEN
        ALTER TABLE public.company ADD COLUMN tax_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'bank_name') THEN
        ALTER TABLE public.company ADD COLUMN bank_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'bank_account') THEN
        ALTER TABLE public.company ADD COLUMN bank_account TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'iban') THEN
        ALTER TABLE public.company ADD COLUMN iban TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'swift') THEN
        ALTER TABLE public.company ADD COLUMN swift TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'logo_url') THEN
        ALTER TABLE public.company ADD COLUMN logo_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'company_type') THEN
        ALTER TABLE public.company ADD COLUMN company_type TEXT DEFAULT 'freelance' CHECK (company_type IN ('freelance', 'company'));
    END IF;
END $$;

-- Step 1: Drop the existing CHECK constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'company_company_type_check'
        AND table_name = 'company'
    ) THEN
        ALTER TABLE public.company DROP CONSTRAINT company_company_type_check;
    END IF;
END $$;

-- Step 2: Clean up data FIRST (before re-adding constraint)
UPDATE public.company SET company_type = 'freelance'
WHERE company_type IS NULL OR company_type NOT IN ('freelance', 'company');

-- Step 3: Re-add the CHECK constraint (now all data is clean)
ALTER TABLE public.company ADD CONSTRAINT company_company_type_check
    CHECK (company_type IN ('freelance', 'company'));
