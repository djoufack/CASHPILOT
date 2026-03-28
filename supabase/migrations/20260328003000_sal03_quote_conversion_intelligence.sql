-- SAL-03: Conversion intelligence for quotes/contracts
-- Adds loss-reason capture and DB-driven next-best-action recommendations.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS loss_reason_category TEXT
    CHECK (loss_reason_category IN ('budget', 'timing', 'competition', 'scope', 'no_response', 'other')),
  ADD COLUMN IF NOT EXISTS loss_reason_details TEXT,
  ADD COLUMN IF NOT EXISTS next_best_action TEXT;

CREATE OR REPLACE FUNCTION public.compute_quote_next_best_action(
  p_status TEXT,
  p_signature_status TEXT,
  p_document_type TEXT,
  p_valid_until DATE,
  p_loss_reason_category TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_status = 'draft' THEN
    RETURN 'send_quote';
  END IF;

  IF p_status = 'sent' THEN
    IF p_valid_until IS NOT NULL AND p_valid_until < CURRENT_DATE THEN
      RETURN 'extend_validity';
    END IF;

    IF COALESCE(p_signature_status, 'unsigned') IN ('unsigned', 'rejected', 'expired') THEN
      RETURN 'request_signature';
    END IF;

    RETURN 'monitor_quote';
  END IF;

  IF p_status = 'accepted' THEN
    IF COALESCE(p_document_type, 'quote') = 'quote' THEN
      RETURN 'convert_to_contract';
    END IF;

    RETURN 'monitor_quote';
  END IF;

  IF p_status IN ('rejected', 'expired') THEN
    CASE p_loss_reason_category
      WHEN 'budget' THEN RETURN 'offer_discount';
      WHEN 'timing' THEN RETURN 'schedule_follow_up';
      WHEN 'competition' THEN RETURN 'differentiate_offer';
      WHEN 'scope' THEN RETURN 'revise_scope';
      WHEN 'no_response' THEN RETURN 'multi_channel_relaunch';
      WHEN 'other' THEN RETURN 'capture_loss_reason';
      ELSE RETURN 'capture_loss_reason';
    END CASE;
  END IF;

  RETURN 'monitor_quote';
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_quotes_set_conversion_intelligence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('rejected', 'expired') THEN
    NEW.loss_reason_category := NULL;
    NEW.loss_reason_details := NULL;
  END IF;

  NEW.next_best_action := public.compute_quote_next_best_action(
    NEW.status,
    NEW.signature_status,
    NEW.document_type,
    NEW.valid_until,
    NEW.loss_reason_category
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_set_conversion_intelligence ON public.quotes;
CREATE TRIGGER trg_quotes_set_conversion_intelligence
  BEFORE INSERT OR UPDATE OF status, signature_status, document_type, valid_until, loss_reason_category, loss_reason_details
  ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_quotes_set_conversion_intelligence();

UPDATE public.quotes
SET next_best_action = public.compute_quote_next_best_action(
  status,
  signature_status,
  document_type,
  valid_until,
  loss_reason_category
)
WHERE TRUE;

ALTER TABLE public.quotes
  ALTER COLUMN next_best_action SET DEFAULT 'monitor_quote';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotes_next_best_action_check'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_next_best_action_check
      CHECK (
        next_best_action IN (
          'send_quote',
          'request_signature',
          'extend_validity',
          'convert_to_contract',
          'offer_discount',
          'schedule_follow_up',
          'differentiate_offer',
          'revise_scope',
          'multi_channel_relaunch',
          'capture_loss_reason',
          'monitor_quote'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_company_conversion_intelligence
  ON public.quotes(company_id, status, loss_reason_category, next_best_action);
