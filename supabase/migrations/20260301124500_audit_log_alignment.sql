-- ============================================================================
-- Migration 047: Align audit log schema and policies with admin UI
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'details'
  ) THEN
    ALTER TABLE public.audit_log ADD COLUMN details JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.audit_log ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_log;
CREATE POLICY "Users can insert own audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own audit logs"
ON public.audit_log
FOR SELECT
USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all audit logs"
ON public.audit_log
FOR SELECT
USING (public.is_admin());
CREATE POLICY "Admins can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (public.is_admin());
