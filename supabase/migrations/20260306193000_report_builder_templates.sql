-- Persist Report Builder templates in DB (multi-tenant scope).

CREATE TABLE IF NOT EXISTS public.report_builder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  preset TEXT NOT NULL DEFAULT 'custom',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE CASCADE;
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS preset TEXT DEFAULT 'custom';
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS period_start DATE;
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS period_end DATE;
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.report_builder_templates
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE public.report_builder_templates
SET
  preset = COALESCE(NULLIF(preset, ''), 'custom'),
  sections = COALESCE(sections, '{}'::jsonb);
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.report_builder_templates
      ALTER COLUMN user_id SET NOT NULL,
      ALTER COLUMN company_id SET NOT NULL,
      ALTER COLUMN name SET NOT NULL,
      ALTER COLUMN preset SET NOT NULL,
      ALTER COLUMN period_start SET NOT NULL,
      ALTER COLUMN period_end SET NOT NULL,
      ALTER COLUMN sections SET NOT NULL;
  EXCEPTION
    WHEN others THEN
      -- Keep migration resilient if legacy rows still require manual remediation.
      NULL;
  END;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_report_builder_templates_user_company_name
  ON public.report_builder_templates(user_id, company_id, name);
CREATE INDEX IF NOT EXISTS idx_report_builder_templates_company_updated_at
  ON public.report_builder_templates(company_id, updated_at DESC);
ALTER TABLE public.report_builder_templates ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_builder_templates'
      AND policyname = 'report_builder_templates_select_own'
  ) THEN
    CREATE POLICY report_builder_templates_select_own
      ON public.report_builder_templates
      FOR SELECT
      TO authenticated
      USING (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_builder_templates'
      AND policyname = 'report_builder_templates_insert_own'
  ) THEN
    CREATE POLICY report_builder_templates_insert_own
      ON public.report_builder_templates
      FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_builder_templates'
      AND policyname = 'report_builder_templates_update_own'
  ) THEN
    CREATE POLICY report_builder_templates_update_own
      ON public.report_builder_templates
      FOR UPDATE
      TO authenticated
      USING (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      )
      WITH CHECK (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'report_builder_templates'
      AND policyname = 'report_builder_templates_delete_own'
  ) THEN
    CREATE POLICY report_builder_templates_delete_own
      ON public.report_builder_templates
      FOR DELETE
      TO authenticated
      USING (
        auth.uid() = user_id
        AND company_id = public.resolve_preferred_company_id(auth.uid())
      );
  END IF;
END $$;
CREATE OR REPLACE FUNCTION public.assign_report_builder_template_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_assign_report_builder_template_company_id ON public.report_builder_templates;
CREATE TRIGGER trg_assign_report_builder_template_company_id
  BEFORE INSERT OR UPDATE ON public.report_builder_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_report_builder_template_company_id();
CREATE OR REPLACE FUNCTION public.touch_report_builder_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_report_builder_templates_touch_updated_at ON public.report_builder_templates;
CREATE TRIGGER trg_report_builder_templates_touch_updated_at
  BEFORE UPDATE ON public.report_builder_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_report_builder_templates_updated_at();
