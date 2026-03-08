-- =============================================================================
-- Migration: Document Storage Buckets, RLS Policies & file_url Columns
-- Description: Creates private storage buckets for all document types,
--              adds RLS policies per bucket (SELECT/INSERT/UPDATE/DELETE),
--              and adds file_url + file_generated_at columns to document tables.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 1: Create Storage Buckets
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf','text/xml','application/xml','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quotes',
  'quotes',
  false,
  10485760,
  ARRAY['application/pdf','text/xml','application/xml','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credit-notes',
  'credit-notes',
  false,
  10485760,
  ARRAY['application/pdf','text/xml','application/xml','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-notes',
  'delivery-notes',
  false,
  10485760,
  ARRAY['application/pdf','text/xml','application/xml','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'purchase-orders',
  'purchase-orders',
  false,
  10485760,
  ARRAY['application/pdf','text/xml','application/xml','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accounting-exports',
  'accounting-exports',
  false,
  10485760,
  ARRAY['application/pdf','text/xml','application/xml','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
) ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 2: RLS Policies on storage.objects
-- Pattern: (storage.foldername(name))[1] = auth.uid()::text
-- Each bucket gets SELECT, INSERT, UPDATE, DELETE policies.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── invoices ─────────────────────────────────────────────────────────────────

CREATE POLICY "invoices_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "invoices_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "invoices_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "invoices_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── quotes ───────────────────────────────────────────────────────────────────

CREATE POLICY "quotes_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'quotes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "quotes_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'quotes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "quotes_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'quotes'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'quotes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "quotes_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'quotes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── credit-notes ─────────────────────────────────────────────────────────────

CREATE POLICY "credit_notes_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'credit-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "credit_notes_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'credit-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "credit_notes_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'credit-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'credit-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "credit_notes_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'credit-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── delivery-notes ───────────────────────────────────────────────────────────

CREATE POLICY "delivery_notes_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "delivery_notes_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "delivery_notes_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'delivery-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'delivery-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "delivery_notes_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'delivery-notes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── purchase-orders ──────────────────────────────────────────────────────────

CREATE POLICY "purchase_orders_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'purchase-orders'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "purchase_orders_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'purchase-orders'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "purchase_orders_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'purchase-orders'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'purchase-orders'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "purchase_orders_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'purchase-orders'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ── accounting-exports ───────────────────────────────────────────────────────

CREATE POLICY "accounting_exports_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'accounting-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "accounting_exports_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'accounting-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "accounting_exports_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'accounting-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'accounting-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "accounting_exports_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'accounting-exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART 3: Add file_url and file_generated_at columns to document tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_generated_at TIMESTAMPTZ;

ALTER TABLE quotes ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS file_generated_at TIMESTAMPTZ;

ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS file_generated_at TIMESTAMPTZ;

ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS file_generated_at TIMESTAMPTZ;

ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS file_generated_at TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────────
-- Partial indexes on file_url (only index non-null rows)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_file_url
  ON invoices (file_url) WHERE file_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_file_url
  ON quotes (file_url) WHERE file_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_notes_file_url
  ON credit_notes (file_url) WHERE file_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_notes_file_url
  ON delivery_notes (file_url) WHERE file_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_orders_file_url
  ON purchase_orders (file_url) WHERE file_url IS NOT NULL;
