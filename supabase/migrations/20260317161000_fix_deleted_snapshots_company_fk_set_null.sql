-- Fix company deletion cascade being blocked by deleted_data_snapshots trigger inserts.
-- Snapshot rows are audit records and must survive company deletion.

ALTER TABLE public.deleted_data_snapshots
  DROP CONSTRAINT IF EXISTS fk_deleted_data_snapshots_company;

ALTER TABLE public.deleted_data_snapshots
  DROP CONSTRAINT IF EXISTS deleted_data_snapshots_company_id_fkey;

ALTER TABLE public.deleted_data_snapshots
  ADD CONSTRAINT fk_deleted_data_snapshots_company
  FOREIGN KEY (company_id)
  REFERENCES public.company(id)
  ON DELETE SET NULL;
