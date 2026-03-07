-- Add expiration column to account_access_overrides
ALTER TABLE IF EXISTS account_access_overrides
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Set expiration on existing demo accounts (90 days from now)
UPDATE account_access_overrides
SET expires_at = now() + INTERVAL '90 days',
    description = 'Demo account - auto-expires'
WHERE override_type = 'demo_full_access'
  AND expires_at IS NULL;

-- Set expiration on admin overrides (180 days, must be renewed)
UPDATE account_access_overrides
SET expires_at = now() + INTERVAL '180 days',
    description = 'Admin override - must be renewed periodically'
WHERE override_type = 'admin_full_access'
  AND expires_at IS NULL;

-- Update function to check expiration
CREATE OR REPLACE FUNCTION public.get_account_access_override(p_email TEXT)
RETURNS TABLE(override_type TEXT, full_access BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    aao.override_type,
    true AS full_access
  FROM account_access_overrides aao
  WHERE aao.normalized_email = lower(trim(p_email))
    AND (aao.expires_at IS NULL OR aao.expires_at > now());
$$;
