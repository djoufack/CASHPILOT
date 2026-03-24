-- Create archive table for deleted client data snapshots
CREATE TABLE IF NOT EXISTS public.deleted_data_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  snapshot_data JSONB NOT NULL,
  deleted_at TIMESTAMPTZ DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS idx_deleted_snapshots_user ON deleted_data_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_snapshots_entity ON deleted_data_snapshots(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_deleted_snapshots_date ON deleted_data_snapshots(deleted_at DESC);
ALTER TABLE deleted_data_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "snapshot_select_own" ON deleted_data_snapshots
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "snapshot_insert_own" ON deleted_data_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE OR REPLACE FUNCTION public.snapshot_before_client_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO deleted_data_snapshots (user_id, company_id, entity_type, entity_id, snapshot_data, deleted_by)
  VALUES (OLD.user_id, OLD.company_id, 'client', OLD.id, to_jsonb(OLD), auth.uid());

  INSERT INTO deleted_data_snapshots (user_id, company_id, entity_type, entity_id, snapshot_data, deleted_by)
  SELECT i.user_id, i.company_id, 'invoice', i.id, to_jsonb(i), auth.uid()
  FROM invoices i WHERE i.client_id = OLD.id;

  INSERT INTO deleted_data_snapshots (user_id, company_id, entity_type, entity_id, snapshot_data, deleted_by)
  SELECT q.user_id, q.company_id, 'quote', q.id, to_jsonb(q), auth.uid()
  FROM quotes q WHERE q.client_id = OLD.id;

  INSERT INTO deleted_data_snapshots (user_id, company_id, entity_type, entity_id, snapshot_data, deleted_by)
  SELECT e.user_id, e.company_id, 'expense', e.id, to_jsonb(e), auth.uid()
  FROM expenses e WHERE e.client_id = OLD.id;

  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS trg_snapshot_before_client_delete ON clients;
CREATE TRIGGER trg_snapshot_before_client_delete
  BEFORE DELETE ON clients FOR EACH ROW
  EXECUTE FUNCTION snapshot_before_client_delete();
