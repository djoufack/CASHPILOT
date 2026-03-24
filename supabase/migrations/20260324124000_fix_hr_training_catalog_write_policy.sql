-- ============================================================================
-- Migration: Fix hr_training_catalog write policy (RLS)
-- Date: 2026-03-24
-- Description:
--   The original FOR ALL policy had only USING (no WITH CHECK), which blocks
--   INSERT and caused smoke HR flows to fail. Align write access with other HR
--   modules: DRH admin or HR manager, for both USING and WITH CHECK.
-- ============================================================================

ALTER TABLE public.hr_training_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hr_training_catalog_write" ON public.hr_training_catalog;
CREATE POLICY "hr_training_catalog_write"
ON public.hr_training_catalog
FOR ALL
USING (
  company_id IS NULL
  OR public.fn_is_drh_admin(company_id)
  OR public.fn_is_hr_manager(company_id)
)
WITH CHECK (
  company_id IS NULL
  OR public.fn_is_drh_admin(company_id)
  OR public.fn_is_hr_manager(company_id)
);
