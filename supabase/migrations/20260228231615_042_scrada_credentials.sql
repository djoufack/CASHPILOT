-- 042_scrada_credentials.sql
-- Add Scrada AP credentials to company table and inbound documents table

-- === Scrada credentials on company table ===
ALTER TABLE company ADD COLUMN IF NOT EXISTS scrada_company_id TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS scrada_api_key TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS scrada_password TEXT;

COMMENT ON COLUMN company.scrada_company_id IS 'Scrada company UUID (from Scrada portal)';
COMMENT ON COLUMN company.scrada_api_key IS 'Scrada API key (from Scrada Settings > API Keys)';
COMMENT ON COLUMN company.scrada_password IS 'Scrada API password (from Scrada Settings > API Keys)';

-- Update default AP provider to scrada
ALTER TABLE company ALTER COLUMN peppol_ap_provider SET DEFAULT 'scrada';

-- Extend peppol_status CHECK to include 'created' for Scrada compatibility
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_peppol_status_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_peppol_status_check
  CHECK (peppol_status IN ('none', 'pending', 'created', 'sent', 'delivered', 'accepted', 'rejected', 'error'));

-- === peppol_inbound_documents table (for received invoices) ===
CREATE TABLE IF NOT EXISTS peppol_inbound_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scrada_document_id TEXT NOT NULL,
  sender_peppol_id TEXT,
  sender_name TEXT,
  document_type TEXT DEFAULT 'invoice',
  invoice_number TEXT,
  invoice_date DATE,
  total_excl_vat NUMERIC(12,2),
  total_vat NUMERIC(12,2),
  total_incl_vat NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  ubl_xml TEXT,
  pdf_url TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'processed', 'archived')),
  metadata JSONB DEFAULT '{}',
  received_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peppol_inbound_user ON peppol_inbound_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_peppol_inbound_scrada_id ON peppol_inbound_documents(scrada_document_id);

ALTER TABLE peppol_inbound_documents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'peppol_inbound_documents' AND policyname = 'Users see own inbound documents'
  ) THEN
    CREATE POLICY "Users see own inbound documents"
      ON peppol_inbound_documents FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;;
