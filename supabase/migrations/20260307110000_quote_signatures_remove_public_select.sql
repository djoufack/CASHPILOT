-- Remove anonymous direct SELECT access to quotes via broad token policy.
-- Public quote signature pages must fetch quote data only through the
-- dedicated edge function `quote-sign-get`.

DROP POLICY IF EXISTS "quotes_public_read_by_token" ON public.quotes;
