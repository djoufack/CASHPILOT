-- INT-03: Collaborative accountant workspace (review + tasks)

CREATE TABLE IF NOT EXISTS public.accountant_collaboration_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  accountant_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_review', 'blocked', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_accountant_collaboration_tasks_company
  ON public.accountant_collaboration_tasks (company_id);

CREATE INDEX IF NOT EXISTS idx_accountant_collaboration_tasks_status
  ON public.accountant_collaboration_tasks (company_id, status);

CREATE INDEX IF NOT EXISTS idx_accountant_collaboration_tasks_accountant
  ON public.accountant_collaboration_tasks (accountant_user_id);

ALTER TABLE public.accountant_collaboration_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accountant_collaboration_tasks_access ON public.accountant_collaboration_tasks;
CREATE POLICY accountant_collaboration_tasks_access
  ON public.accountant_collaboration_tasks
  FOR ALL
  USING (
    (
      auth.uid() = user_id
      AND company_id = public.resolve_preferred_company_id(auth.uid())
    )
    OR auth.uid() = accountant_user_id
  )
  WITH CHECK (
    (
      auth.uid() = user_id
      AND company_id = public.resolve_preferred_company_id(auth.uid())
    )
    OR auth.uid() = accountant_user_id
  );

DROP TRIGGER IF EXISTS trg_accountant_collaboration_tasks_updated_at ON public.accountant_collaboration_tasks;
CREATE TRIGGER trg_accountant_collaboration_tasks_updated_at
  BEFORE UPDATE ON public.accountant_collaboration_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE public.accountant_collaboration_tasks IS
  'Shared review and task tracking between company owner and accountant.';
