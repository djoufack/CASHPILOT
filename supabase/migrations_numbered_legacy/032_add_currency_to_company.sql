-- Add currency column to company table
-- This allows users to set their preferred working currency (EUR, USD, XAF, etc.)

-- Add currency column with default value EUR
ALTER TABLE company
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'EUR';

-- Add comment to document the column
COMMENT ON COLUMN company.currency IS 'ISO 4217 currency code (e.g., EUR, USD, XAF, GBP)';

-- Update existing rows to have EUR as default currency if null
UPDATE company
SET currency = 'EUR'
WHERE currency IS NULL;
