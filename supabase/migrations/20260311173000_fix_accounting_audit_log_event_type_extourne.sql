-- Align accounting_audit_log event_type CHECK with trigger-emitted values.
-- supplier_orders / purchase_orders auto-journal triggers emit "extourne".
-- Without this value, real-time posting can fail at runtime.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'accounting_audit_log'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'accounting_audit_log_event_type_check'
  ) THEN
    ALTER TABLE public.accounting_audit_log
      DROP CONSTRAINT accounting_audit_log_event_type_check;
  END IF;

  ALTER TABLE public.accounting_audit_log
    ADD CONSTRAINT accounting_audit_log_event_type_check
    CHECK (
      event_type IN (
        'auto_journal',
        'reversal',
        'extourne',
        'balance_check',
        'validation_error',
        'manual_correction',
        'retroactive_journal',
        'supplier_journal',
        'bank_journal',
        'receivable_journal',
        'payable_journal',
        'data_access'
      )
    );
END $$;

