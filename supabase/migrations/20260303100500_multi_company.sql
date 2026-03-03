-- =====================================================================
-- S2-F8 : Multi-sociétés — Phase 1
-- Date : 2026-03-03
-- =====================================================================

-- Table de préférences: quelle société est active pour cet utilisateur
CREATE TABLE IF NOT EXISTS public.user_company_preferences (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_company_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_company_prefs_policy"
  ON public.user_company_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Supprimer la contrainte UNIQUE sur company.user_id si elle existe
-- (permet à un user d'avoir plusieurs sociétés)
-- Note: en PostgreSQL, on ne peut pas DROP CONSTRAINT IF EXISTS directement,
-- donc on utilise une fonction DO block pour être sûr
DO $$
BEGIN
  -- Retirer l'index unique sur company(user_id) si existant
  -- pour permettre plusieurs sociétés par user
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'company'
      AND indexname = 'company_user_id_key'
  ) THEN
    ALTER TABLE public.company DROP CONSTRAINT company_user_id_key;
  END IF;
END $$;

-- Index non-unique à la place
CREATE INDEX IF NOT EXISTS idx_company_user_id
  ON public.company(user_id);

-- Initialiser les préférences pour les users existants
INSERT INTO public.user_company_preferences (user_id, active_company_id)
SELECT user_id, id FROM public.company
ON CONFLICT (user_id) DO NOTHING;
