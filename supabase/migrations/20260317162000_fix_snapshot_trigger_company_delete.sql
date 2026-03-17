-- Ensure snapshot trigger does not block company cascade deletes.
-- When parent company is already being deleted, snapshots must be inserted
-- with company_id = NULL.

CREATE OR REPLACE FUNCTION public.snapshot_before_client_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_exists BOOLEAN := FALSE;
  v_snapshot_company_id UUID := NULL;
BEGIN
  IF OLD.company_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1
      FROM public.company c
      WHERE c.id = OLD.company_id
    )
    INTO v_company_exists;

    IF v_company_exists THEN
      v_snapshot_company_id := OLD.company_id;
    END IF;
  END IF;

  INSERT INTO public.deleted_data_snapshots (
    user_id,
    company_id,
    entity_type,
    entity_id,
    snapshot_data,
    deleted_by
  )
  VALUES (
    OLD.user_id,
    v_snapshot_company_id,
    'client',
    OLD.id,
    to_jsonb(OLD),
    auth.uid()
  );

  INSERT INTO public.deleted_data_snapshots (
    user_id,
    company_id,
    entity_type,
    entity_id,
    snapshot_data,
    deleted_by
  )
  SELECT
    i.user_id,
    CASE WHEN v_company_exists THEN i.company_id ELSE NULL END,
    'invoice',
    i.id,
    to_jsonb(i),
    auth.uid()
  FROM public.invoices i
  WHERE i.client_id = OLD.id;

  INSERT INTO public.deleted_data_snapshots (
    user_id,
    company_id,
    entity_type,
    entity_id,
    snapshot_data,
    deleted_by
  )
  SELECT
    q.user_id,
    CASE WHEN v_company_exists THEN q.company_id ELSE NULL END,
    'quote',
    q.id,
    to_jsonb(q),
    auth.uid()
  FROM public.quotes q
  WHERE q.client_id = OLD.id;

  INSERT INTO public.deleted_data_snapshots (
    user_id,
    company_id,
    entity_type,
    entity_id,
    snapshot_data,
    deleted_by
  )
  SELECT
    e.user_id,
    CASE WHEN v_company_exists THEN e.company_id ELSE NULL END,
    'expense',
    e.id,
    to_jsonb(e),
    auth.uid()
  FROM public.expenses e
  WHERE e.client_id = OLD.id;

  RETURN OLD;
END;
$$;
