-- Migration: Add recommended_training_id to hr_skill_assessments
-- FIX-14: Persister la formation recommandée lors des évaluations de compétences

ALTER TABLE public.hr_skill_assessments
  ADD COLUMN IF NOT EXISTS recommended_training_id UUID
    REFERENCES public.hr_training_catalog(id) ON DELETE SET NULL;

-- Index pour les jointures rapides
CREATE INDEX IF NOT EXISTS idx_hr_skill_assessments_recommended_training_id
  ON public.hr_skill_assessments (recommended_training_id);

-- Commentaire descriptif
COMMENT ON COLUMN public.hr_skill_assessments.recommended_training_id IS
  'Formation recommandee pour combler le gap de competence identifie lors de l evaluation (FK vers hr_training_catalog)';
