-- FIN-01: finalize embedded banking transfers against active bank_connections
-- Adds a dedicated source reference aligned with the current Open Banking connection model.

ALTER TABLE public.bank_transfers
  ADD COLUMN IF NOT EXISTS source_bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_transfers_source_bank_connection
  ON public.bank_transfers(source_bank_connection_id);

COMMENT ON COLUMN public.bank_transfers.source_bank_connection_id IS
'FIN-01 source account reference in the current bank_connections table used by embedded banking transfers.';
