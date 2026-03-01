CREATE OR REPLACE FUNCTION increment_webhook_failure(endpoint_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE webhook_endpoints
  SET failure_count = failure_count + 1,
      last_triggered_at = now()
  WHERE id = endpoint_id;
$$;;
