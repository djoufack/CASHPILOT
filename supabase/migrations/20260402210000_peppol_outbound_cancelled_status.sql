-- Allow cancelled status for Peppol outbound lifecycle

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_peppol_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_peppol_status_check
  CHECK (
    peppol_status IN (
      'none',
      'pending',
      'created',
      'sent',
      'delivered',
      'accepted',
      'rejected',
      'error',
      'cancelled'
    )
  );

ALTER TABLE public.peppol_transmission_log
  DROP CONSTRAINT IF EXISTS peppol_transmission_log_status_check;

ALTER TABLE public.peppol_transmission_log
  ADD CONSTRAINT peppol_transmission_log_status_check
  CHECK (
    status IN (
      'pending',
      'sent',
      'delivered',
      'accepted',
      'rejected',
      'error',
      'cancelled'
    )
  );
