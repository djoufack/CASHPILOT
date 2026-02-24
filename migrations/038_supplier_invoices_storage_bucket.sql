-- Migration 038: Create supplier-invoices storage bucket + RLS policies
-- Already applied via Supabase migration tool, kept here for reference

-- 1. Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-invoices',
  'supplier-invoices',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS policies: users can only access files in their own folder (user_id/)
CREATE POLICY IF NOT EXISTS "supplier_invoices_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "supplier_invoices_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY IF NOT EXISTS "supplier_invoices_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'supplier-invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
