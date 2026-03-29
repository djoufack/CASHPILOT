-- ============================================================================
-- FIX: Invoice DELETE CASCADE for payments + accounting_entries cleanup
-- Bug: Deleting an invoice leaves orphan payments (invoice_id SET NULL)
--      and orphan accounting_entries (source_id has no FK constraint).
-- ============================================================================

-- 1. Fix payments.invoice_id → ON DELETE CASCADE
-- Drop whatever FK exists (may be SET NULL or no cascade), then recreate correctly.
DO $$ BEGIN
  -- Drop all existing FKs on payments.invoice_id
  DECLARE
    r RECORD;
  BEGIN
    FOR r IN
      SELECT tc.constraint_name
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_name = tc.table_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'payments'
        AND kcu.column_name = 'invoice_id'
        AND tc.constraint_type = 'FOREIGN KEY'
    LOOP
      EXECUTE 'ALTER TABLE public.payments DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
  END;
END $$;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id)
  ON DELETE CASCADE ON UPDATE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

-- 2. Add a trigger to delete accounting_entries linked to an invoice (source_id)
--    when the invoice is deleted. Since source_id has no FK, we use a trigger.
CREATE OR REPLACE FUNCTION public.cleanup_accounting_on_invoice_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete entries journalized for this invoice (source_type = 'invoice' or 'invoice_reversal')
  DELETE FROM public.accounting_entries
  WHERE source_id = OLD.id
    AND source_type IN ('invoice', 'invoice_reversal');

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_accounting_on_invoice_delete ON public.invoices;
CREATE TRIGGER trg_cleanup_accounting_on_invoice_delete
  BEFORE DELETE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_accounting_on_invoice_delete();

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
