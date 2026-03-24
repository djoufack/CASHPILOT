-- ============================================================================
-- Migration: Scope document numbers by company (ENF-2)
-- Date: 2026-03-24
-- Description:
--   Replace global/user-scoped unique constraints on business document numbers
--   with company-scoped uniqueness: UNIQUE(company_id, <number_column>).
--   This prevents cross-company collisions for multi-tenant portfolios.
-- ============================================================================

DO $$
DECLARE
  target RECORD;
  candidate RECORD;
BEGIN
  FOR target IN
    SELECT *
    FROM (
      VALUES
        ('quotes', 'quote_number', 'uq_quotes_company_quote_number'),
        ('invoices', 'invoice_number', 'uq_invoices_company_invoice_number'),
        ('purchase_orders', 'po_number', 'uq_purchase_orders_company_po_number'),
        ('supplier_orders', 'order_number', 'uq_supplier_orders_company_order_number'),
        ('supplier_invoices', 'invoice_number', 'uq_supplier_invoices_company_invoice_number'),
        ('credit_notes', 'credit_note_number', 'uq_credit_notes_company_credit_note_number'),
        ('delivery_notes', 'delivery_note_number', 'uq_delivery_notes_company_delivery_note_number')
    ) AS t(table_name, number_column, target_constraint_name)
  LOOP
    -- Skip if table or required columns do not exist in this environment.
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target.table_name
        AND column_name = 'company_id'
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = target.table_name
        AND column_name = target.number_column
    ) THEN
      CONTINUE;
    END IF;

    -- Drop obsolete global/user-level uniqueness constraints.
    FOR candidate IN
      SELECT
        con.conname,
        array_agg(att.attname ORDER BY cols.ord)::text[] AS key_columns
      FROM pg_constraint con
      JOIN pg_class tbl ON tbl.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
      JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = cols.attnum
      WHERE ns.nspname = 'public'
        AND tbl.relname = target.table_name
        AND con.contype = 'u'
      GROUP BY con.conname
    LOOP
      IF candidate.key_columns = ARRAY[target.number_column]::text[]
        OR candidate.key_columns = ARRAY['user_id', target.number_column]::text[]
        OR candidate.key_columns = ARRAY[target.number_column, 'user_id']::text[]
      THEN
        EXECUTE format(
          'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
          target.table_name,
          candidate.conname
        );
      END IF;
    END LOOP;

    -- Enforce company-scoped uniqueness.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class tbl ON tbl.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      WHERE ns.nspname = 'public'
        AND tbl.relname = target.table_name
        AND con.conname = target.target_constraint_name
        AND con.contype = 'u'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (company_id, %I)',
        target.table_name,
        target.target_constraint_name,
        target.number_column
      );
    END IF;
  END LOOP;
END
$$;
