-- ==============================================================================
-- MIGRATION 032: Add currency column to company table
-- ==============================================================================
-- This migration adds support for multi-currency by allowing companies to
-- specify their working currency. All amounts in the onboarding balances
-- will be stored with conversion rates to EUR.
-- ==============================================================================

DO $$
BEGIN
    -- Add currency column with default value EUR
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company' AND column_name = 'currency') THEN
        ALTER TABLE public.company ADD COLUMN currency TEXT DEFAULT 'EUR' NOT NULL;
    END IF;

    -- Add comment to document the column
    COMMENT ON COLUMN public.company.currency IS 'ISO 4217 currency code (EUR, USD, GBP, etc.)';
END $$;

-- Update existing rows to have EUR as default currency if NULL
UPDATE public.company SET currency = 'EUR' WHERE currency IS NULL;
