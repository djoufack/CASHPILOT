
-- Add status related columns to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Ensure status column accepts new values if it doesn't already
-- We use a check constraint for flexibility
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled'));

-- Update default value
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'pending';


-- Add status related columns to subtasks table
ALTER TABLE public.subtasks 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add constraint to subtasks
ALTER TABLE public.subtasks DROP CONSTRAINT IF EXISTS subtasks_status_check;
ALTER TABLE public.subtasks ADD CONSTRAINT subtasks_status_check 
  CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'cancelled'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_status_date ON public.tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_started_at ON public.tasks(started_at);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at);
