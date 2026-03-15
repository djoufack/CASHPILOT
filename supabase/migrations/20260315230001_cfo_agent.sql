-- CFO Agent tables: alerts, chat history, health scores
-- Supports the AI CFO agent feature (Feature 3)

-- ─── cfo_alerts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cfo_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfo_alerts_user_company_created
  ON public.cfo_alerts (user_id, company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cfo_alerts_unread
  ON public.cfo_alerts (user_id, company_id, is_read)
  WHERE is_read = false;

ALTER TABLE public.cfo_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY cfo_alerts_select ON public.cfo_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cfo_alerts_insert ON public.cfo_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY cfo_alerts_update ON public.cfo_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY cfo_alerts_delete ON public.cfo_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- ─── cfo_chat_history ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cfo_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfo_chat_history_user_company_created
  ON public.cfo_chat_history (user_id, company_id, created_at DESC);

ALTER TABLE public.cfo_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY cfo_chat_history_select ON public.cfo_chat_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cfo_chat_history_insert ON public.cfo_chat_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY cfo_chat_history_delete ON public.cfo_chat_history
  FOR DELETE USING (auth.uid() = user_id);

-- ─── cfo_health_scores ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cfo_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  factors JSONB,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cfo_health_scores_user_company_computed
  ON public.cfo_health_scores (user_id, company_id, computed_at DESC);

ALTER TABLE public.cfo_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY cfo_health_scores_select ON public.cfo_health_scores
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY cfo_health_scores_insert ON public.cfo_health_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY cfo_health_scores_delete ON public.cfo_health_scores
  FOR DELETE USING (auth.uid() = user_id);
