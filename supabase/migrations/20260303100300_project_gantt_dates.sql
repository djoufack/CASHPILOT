-- =====================================================================
-- S2-F5 : Vue Gantt projets — dates sur projects et tasks
-- Date : 2026-03-03
-- =====================================================================

-- Ajout des dates de début/fin sur les projets
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date   DATE;

-- Ajout des dates et dépendances sur les tâches
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_date  DATE,
  ADD COLUMN IF NOT EXISTS end_date    DATE,
  ADD COLUMN IF NOT EXISTS depends_on  UUID[] DEFAULT '{}';

-- Index pour les requêtes Gantt (par projet, avec dates)
CREATE INDEX IF NOT EXISTS idx_tasks_gantt_dates
  ON public.tasks(project_id, start_date, end_date)
  WHERE start_date IS NOT NULL AND end_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_dates
  ON public.projects(user_id, start_date, end_date)
  WHERE start_date IS NOT NULL;
