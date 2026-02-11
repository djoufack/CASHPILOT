-- ==============================================================================
-- MIGRATION 033: Fix mapping_name constraint in accounting_mappings
-- ==============================================================================
-- The mapping_name column has a NOT NULL constraint, but preset mappings don't
-- provide this value. This migration makes the column nullable since it's not
-- used in the application logic.
-- ==============================================================================

DO $$
BEGIN
    -- Make mapping_name nullable if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounting_mappings'
        AND column_name = 'mapping_name'
    ) THEN
        -- Drop NOT NULL constraint
        ALTER TABLE public.accounting_mappings
        ALTER COLUMN mapping_name DROP NOT NULL;

        -- Update comment to clarify it's optional
        COMMENT ON COLUMN public.accounting_mappings.mapping_name IS
        'Optional user-friendly name for the mapping';
    END IF;
END $$;

-- Set NULL for any existing empty strings or update with a generated name
UPDATE public.accounting_mappings
SET mapping_name = NULL
WHERE mapping_name = '' OR mapping_name IS NULL;
