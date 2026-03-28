-- CFO weekly briefings: company-scoped, idempotent weekly snapshots

CREATE TABLE IF NOT EXISTS public.cfo_weekly_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  briefing_text TEXT NOT NULL,
  briefing_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cfo_weekly_briefings_company_week_unique UNIQUE (company_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_cfo_weekly_briefings_user_company_week
  ON public.cfo_weekly_briefings (user_id, company_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_cfo_weekly_briefings_company_generated
  ON public.cfo_weekly_briefings (company_id, generated_at DESC);

ALTER TABLE public.cfo_weekly_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cfo_weekly_briefings_select ON public.cfo_weekly_briefings;
CREATE POLICY cfo_weekly_briefings_select ON public.cfo_weekly_briefings
  FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cfo_weekly_briefings_insert ON public.cfo_weekly_briefings;
CREATE POLICY cfo_weekly_briefings_insert ON public.cfo_weekly_briefings
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cfo_weekly_briefings_update ON public.cfo_weekly_briefings;
CREATE POLICY cfo_weekly_briefings_update ON public.cfo_weekly_briefings
  FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS cfo_weekly_briefings_delete ON public.cfo_weekly_briefings;
CREATE POLICY cfo_weekly_briefings_delete ON public.cfo_weekly_briefings
  FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = company_id
        AND c.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_cfo_weekly_briefings_updated_at ON public.cfo_weekly_briefings;
CREATE TRIGGER trg_cfo_weekly_briefings_updated_at
  BEFORE UPDATE ON public.cfo_weekly_briefings
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
