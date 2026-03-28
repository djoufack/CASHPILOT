-- ============================================================================
-- Pilotage KPI threshold subscriptions
-- Additive JSONB storage for company-scoped alert subscriptions.
-- ============================================================================

ALTER TABLE public.user_company_preferences
  ADD COLUMN IF NOT EXISTS pilotage_alert_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.user_company_preferences.pilotage_alert_settings
  IS 'Company-scoped Pilotage KPI alert subscriptions keyed by company_id.';
