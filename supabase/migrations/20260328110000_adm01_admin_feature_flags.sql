-- ADM-01: Admin feature flags, company-scoped, with gradual rollout controls.

CREATE TABLE IF NOT EXISTS public.admin_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  flag_key TEXT NOT NULL,
  flag_name TEXT NOT NULL,
  flag_description TEXT NOT NULL DEFAULT '',
  target_area TEXT NOT NULL DEFAULT 'admin',
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  last_changed_at TIMESTAMPTZ,
  last_changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (company_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_admin_feature_flags_company
  ON public.admin_feature_flags (company_id);

CREATE INDEX IF NOT EXISTS idx_admin_feature_flags_enabled
  ON public.admin_feature_flags (company_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_admin_feature_flags_area
  ON public.admin_feature_flags (company_id, target_area);

ALTER TABLE public.admin_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_feature_flags_access ON public.admin_feature_flags;
CREATE POLICY admin_feature_flags_access
  ON public.admin_feature_flags
  FOR ALL
  USING (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND company_id = public.resolve_preferred_company_id(auth.uid())
  );

DROP TRIGGER IF EXISTS trg_admin_feature_flags_updated_at ON public.admin_feature_flags;
CREATE TRIGGER trg_admin_feature_flags_updated_at
  BEFORE UPDATE ON public.admin_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE public.admin_feature_flags IS
  'Company-scoped admin feature flag registry with rollout controls and change traceability metadata.';

WITH scoped_companies AS (
  SELECT id AS company_id, user_id
  FROM public.company
),
flag_templates AS (
  SELECT *
  FROM (
    VALUES
      (
        'admin.feature_flags',
        'Feature flags admin',
        'Pilotage centralise des activations progressives cote administration.',
        'admin',
        TRUE,
        100::numeric,
        '{"critical": true}'::jsonb
      ),
      (
        'admin.operational_health',
        'Dashboard sante operationnelle',
        'Exposition des signaux Edge Functions et webhooks dans l espace admin.',
        'admin',
        TRUE,
        100::numeric,
        '{"critical": true}'::jsonb
      ),
      (
        'admin.enhanced_traceability',
        'Tracabilite admin renforcee',
        'Journal detaille des operations administrateur avec correlation.',
        'security',
        TRUE,
        100::numeric,
        '{"critical": true}'::jsonb
      ),
      (
        'integrations.api_key_scope_guard',
        'Garde-fou scopes API',
        'Controle strict des scopes et rotation des cles Open API.',
        'api',
        TRUE,
        100::numeric,
        '{"critical": true}'::jsonb
      ),
      (
        'finance.assisted_closing',
        'Assistant cloture comptable',
        'Activation progressive de l assistant de cloture comptable.',
        'accounting',
        TRUE,
        100::numeric,
        '{}'::jsonb
      )
  ) AS t(
    flag_key,
    flag_name,
    flag_description,
    target_area,
    is_enabled,
    rollout_percentage,
    metadata
  )
)
INSERT INTO public.admin_feature_flags (
  user_id,
  company_id,
  flag_key,
  flag_name,
  flag_description,
  target_area,
  is_enabled,
  rollout_percentage,
  metadata,
  last_changed_at,
  last_changed_by
)
SELECT
  sc.user_id,
  sc.company_id,
  ft.flag_key,
  ft.flag_name,
  ft.flag_description,
  ft.target_area,
  ft.is_enabled,
  ft.rollout_percentage,
  ft.metadata,
  timezone('utc', now()),
  sc.user_id
FROM scoped_companies sc
CROSS JOIN flag_templates ft
ON CONFLICT (company_id, flag_key) DO NOTHING;
