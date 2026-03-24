-- Add expiration metadata to account access overrides.
ALTER TABLE IF EXISTS public.account_access_overrides
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description TEXT;
-- Set expiration on existing demo accounts (90 days from now).
UPDATE public.account_access_overrides
SET expires_at = timezone('utc', now()) + INTERVAL '90 days',
    description = COALESCE(description, 'Demo account - auto-expires')
WHERE access_mode = 'demo_full_access'
  AND expires_at IS NULL;
-- Set expiration on admin overrides (180 days, must be renewed).
UPDATE public.account_access_overrides
SET expires_at = timezone('utc', now()) + INTERVAL '180 days',
    description = COALESCE(description, 'Admin override - renew periodically')
WHERE access_mode = 'admin_full_access'
  AND expires_at IS NULL;
-- Keep existing function signature, but include expiration guard.
CREATE OR REPLACE FUNCTION public.get_account_access_override(target_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
  is_override BOOLEAN,
  access_mode TEXT,
  access_label TEXT,
  normalized_email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
  user_email TEXT;
  override_mode TEXT;
  override_label TEXT;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF jwt_role IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM target_user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT lower(email)
  INTO user_email
  FROM auth.users
  WHERE id = target_user_id;

  SELECT aao.access_mode, aao.access_label
  INTO override_mode, override_label
  FROM public.account_access_overrides aao
  WHERE aao.normalized_email = user_email
    AND aao.is_active = true
    AND (aao.expires_at IS NULL OR aao.expires_at > timezone('utc', now()))
  LIMIT 1;

  RETURN QUERY
  SELECT
    override_mode IS NOT NULL,
    override_mode,
    override_label,
    user_email;
END;
$$;
