-- =====================================================================
-- Shareable dashboard and analytics snapshots
-- Date: 2026-03-03
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.dashboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('dashboard', 'analytics')),
  title TEXT NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_public BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_user_company
  ON public.dashboard_snapshots(user_id, company_id, snapshot_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dashboard_snapshots_share_token
  ON public.dashboard_snapshots(share_token);

ALTER TABLE public.dashboard_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own dashboard snapshots" ON public.dashboard_snapshots;
CREATE POLICY "Users manage own dashboard snapshots"
ON public.dashboard_snapshots
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public can read active dashboard snapshots" ON public.dashboard_snapshots;
CREATE POLICY "Public can read active dashboard snapshots"
ON public.dashboard_snapshots
FOR SELECT
USING (
  is_public = true
  AND (expires_at IS NULL OR expires_at > now())
);

CREATE OR REPLACE FUNCTION public.assign_dashboard_snapshot_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_dashboard_snapshot_company_id ON public.dashboard_snapshots;
CREATE TRIGGER trg_assign_dashboard_snapshot_company_id
  BEFORE INSERT OR UPDATE ON public.dashboard_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_dashboard_snapshot_company_id();
