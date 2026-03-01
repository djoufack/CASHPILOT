
-- Policy: Users can upload files to their own folder (user_id/filename)
CREATE POLICY "supplier_invoices_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can read their own files
CREATE POLICY "supplier_invoices_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own files
CREATE POLICY "supplier_invoices_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'supplier-invoices'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
;
