
-- Create tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    assigned_to UUID REFERENCES auth.users(id),
    due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create subtasks table
CREATE TABLE IF NOT EXISTS public.subtasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks for their projects" 
    ON public.tasks FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = tasks.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert tasks for their projects" 
    ON public.tasks FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = tasks.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update tasks for their projects" 
    ON public.tasks FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = tasks.project_id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete tasks for their projects" 
    ON public.tasks FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.projects 
            WHERE projects.id = tasks.project_id 
            AND projects.user_id = auth.uid()
        )
    );

-- RLS Policies for subtasks (inherited access via tasks -> projects)
CREATE POLICY "Users can view subtasks for their project tasks" 
    ON public.subtasks FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            JOIN public.projects ON tasks.project_id = projects.id
            WHERE subtasks.task_id = tasks.id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert subtasks for their project tasks" 
    ON public.subtasks FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tasks
            JOIN public.projects ON tasks.project_id = projects.id
            WHERE subtasks.task_id = tasks.id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update subtasks for their project tasks" 
    ON public.subtasks FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            JOIN public.projects ON tasks.project_id = projects.id
            WHERE subtasks.task_id = tasks.id 
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete subtasks for their project tasks" 
    ON public.subtasks FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM public.tasks
            JOIN public.projects ON tasks.project_id = projects.id
            WHERE subtasks.task_id = tasks.id 
            AND projects.user_id = auth.uid()
        )
    );
