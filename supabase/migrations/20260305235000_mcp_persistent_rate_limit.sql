-- =====================================================================
-- Persistent rate limiting for Edge functions (MCP and related APIs)
-- Date: 2026-03-05
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.api_rate_limit_counters (
  scope TEXT NOT NULL,
  rate_key TEXT NOT NULL,
  window_seconds INTEGER NOT NULL CHECK (window_seconds > 0),
  bucket_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, rate_key, window_seconds, bucket_start)
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limit_counters_updated_at
  ON public.api_rate_limit_counters (updated_at);
ALTER TABLE public.api_rate_limit_counters ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_rate_limit_counters'
      AND policyname = 'api_rate_limit_counters_no_client_access'
  ) THEN
    CREATE POLICY api_rate_limit_counters_no_client_access
      ON public.api_rate_limit_counters
      FOR ALL
      USING (FALSE)
      WITH CHECK (FALSE);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.enforce_rate_limit(
  p_scope TEXT,
  p_rate_key TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_bucket_start TIMESTAMPTZ;
  v_request_count INTEGER;
BEGIN
  IF p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'p_scope is required';
  END IF;

  IF p_rate_key IS NULL OR btrim(p_rate_key) = '' THEN
    RAISE EXCEPTION 'p_rate_key is required';
  END IF;

  IF p_max_requests < 1 THEN
    RAISE EXCEPTION 'p_max_requests must be >= 1';
  END IF;

  IF p_window_seconds < 1 THEN
    RAISE EXCEPTION 'p_window_seconds must be >= 1';
  END IF;

  v_bucket_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.api_rate_limit_counters (
    scope,
    rate_key,
    window_seconds,
    bucket_start,
    request_count,
    updated_at
  )
  VALUES (
    p_scope,
    p_rate_key,
    p_window_seconds,
    v_bucket_start,
    1,
    v_now
  )
  ON CONFLICT (scope, rate_key, window_seconds, bucket_start)
  DO UPDATE
    SET request_count = public.api_rate_limit_counters.request_count + 1,
        updated_at = EXCLUDED.updated_at
  RETURNING request_count
  INTO v_request_count;

  -- Keep only recent windows.
  DELETE FROM public.api_rate_limit_counters
  WHERE updated_at < (v_now - make_interval(secs => GREATEST(p_window_seconds * 5, 300)));

  RETURN QUERY
  SELECT
    v_request_count <= p_max_requests AS allowed,
    GREATEST(p_max_requests - v_request_count, 0) AS remaining,
    v_bucket_start + make_interval(secs => p_window_seconds) AS reset_at;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
