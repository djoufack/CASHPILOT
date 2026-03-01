-- 041_peppol_support.sql
-- Add Peppol e-invoicing support columns

-- === clients table ===
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0208';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS electronic_invoicing_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN clients.peppol_endpoint_id IS 'Peppol participant ID (e.g. BCE/KBO number for Belgium)';
COMMENT ON COLUMN clients.peppol_scheme_id IS 'Peppol identifier scheme (0208=BE BCE/KBO, 0009=FR SIRET, 0088=EAN)';

-- === invoices table ===
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_status TEXT DEFAULT 'none'
  CHECK (peppol_status IN ('none', 'pending', 'sent', 'delivered', 'accepted', 'rejected', 'error'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_document_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_error_message TEXT;

COMMENT ON COLUMN invoices.peppol_status IS 'Peppol transmission status';

-- === company table ===
ALTER TABLE company ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE company ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0208';
ALTER TABLE company ADD COLUMN IF NOT EXISTS peppol_ap_provider TEXT DEFAULT 'storecove';

COMMENT ON COLUMN company.peppol_endpoint_id IS 'Company Peppol participant ID';

-- === peppol_transmission_log table ===
CREATE TABLE IF NOT EXISTS peppol_transmission_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'accepted', 'rejected', 'error')),
  ap_provider TEXT,
  ap_document_id TEXT,
  sender_endpoint TEXT,
  receiver_endpoint TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_peppol_log_invoice ON peppol_transmission_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_peppol_log_user ON peppol_transmission_log(user_id);

ALTER TABLE peppol_transmission_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'peppol_transmission_log' AND policyname = 'Users see own peppol logs'
  ) THEN
    CREATE POLICY "Users see own peppol logs"
      ON peppol_transmission_log FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;;
