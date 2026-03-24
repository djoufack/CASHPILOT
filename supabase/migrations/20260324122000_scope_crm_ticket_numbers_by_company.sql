-- ============================================================================
-- Migration: Scope CRM support ticket numbers by company (ENF-2)
-- Date: 2026-03-24
-- ============================================================================

DO $$
DECLARE
  candidate RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_support_tickets'
      AND column_name = 'company_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_support_tickets'
      AND column_name = 'ticket_number'
  ) THEN
    RETURN;
  END IF;

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
      AND tbl.relname = 'crm_support_tickets'
      AND con.contype = 'u'
    GROUP BY con.conname
  LOOP
    IF candidate.key_columns = ARRAY['ticket_number']::text[]
      OR candidate.key_columns = ARRAY['user_id', 'ticket_number']::text[]
      OR candidate.key_columns = ARRAY['ticket_number', 'user_id']::text[]
    THEN
      EXECUTE 'ALTER TABLE public.crm_support_tickets DROP CONSTRAINT IF EXISTS ' || quote_ident(candidate.conname);
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class tbl ON tbl.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'crm_support_tickets'
      AND con.conname = 'uq_crm_support_tickets_company_ticket_number'
      AND con.contype = 'u'
  ) THEN
    ALTER TABLE public.crm_support_tickets
      ADD CONSTRAINT uq_crm_support_tickets_company_ticket_number
      UNIQUE (company_id, ticket_number);
  END IF;
END
$$;
