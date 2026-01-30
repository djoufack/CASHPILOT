
-- ==============================================================================
-- RLS FIX SCRIPT
-- This script resets and implements strict Row Level Security (RLS) policies 
-- for all application tables to ensure users can ONLY access their own data.
-- It specifically addresses infinite recursion issues by ensuring policies
-- do not self-reference in a way that causes loops.
-- ==============================================================================

-- Helper function to drop all policies for a table to ensure a clean slate
DO $$
DECLARE
    tables text[] := ARRAY[
        'profiles', 'clients', 'projects', 'tasks', 'timesheets', 
        'invoices', 'invoice_items', 'quotes', 'expenses', 'notifications', 'recurring_invoices'
    ];
    t text;
    p record;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
        END LOOP;
        
        -- Enable RLS on the table
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- ==============================================================================
-- 1. PROFILES TABLE
-- Critical: Simple check (auth.uid() = user_id) prevents recursion.
-- Do NOT add policies that query 'profiles' table for roles here.
-- ==============================================================================

CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" 
ON public.profiles FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 2. CLIENTS TABLE
-- ==============================================================================

CREATE POLICY "Users can view own clients" 
ON public.clients FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own clients" 
ON public.clients FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own clients" 
ON public.clients FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own clients" 
ON public.clients FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 3. PROJECTS TABLE
-- ==============================================================================

CREATE POLICY "Users can view own projects" 
ON public.projects FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" 
ON public.projects FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" 
ON public.projects FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" 
ON public.projects FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 4. TASKS TABLE (Linked via Projects)
-- ==============================================================================

CREATE POLICY "Users can view own tasks" 
ON public.tasks FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = tasks.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create own tasks" 
ON public.tasks FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = tasks.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own tasks" 
ON public.tasks FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = tasks.project_id 
    AND projects.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own tasks" 
ON public.tasks FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.projects 
    WHERE projects.id = tasks.project_id 
    AND projects.user_id = auth.uid()
  )
);

-- ==============================================================================
-- 5. TIMESHEETS TABLE
-- ==============================================================================

CREATE POLICY "Users can view own timesheets" 
ON public.timesheets FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own timesheets" 
ON public.timesheets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timesheets" 
ON public.timesheets FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own timesheets" 
ON public.timesheets FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 6. INVOICES TABLE
-- ==============================================================================

CREATE POLICY "Users can view own invoices" 
ON public.invoices FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own invoices" 
ON public.invoices FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices" 
ON public.invoices FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices" 
ON public.invoices FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 7. INVOICE ITEMS TABLE (Linked via Invoices)
-- ==============================================================================

CREATE POLICY "Users can view invoice items" 
ON public.invoice_items FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create invoice items" 
ON public.invoice_items FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update invoice items" 
ON public.invoice_items FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete invoice items" 
ON public.invoice_items FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  )
);

-- ==============================================================================
-- 8. QUOTES TABLE
-- ==============================================================================

CREATE POLICY "Users can view own quotes" 
ON public.quotes FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own quotes" 
ON public.quotes FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotes" 
ON public.quotes FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own quotes" 
ON public.quotes FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 9. EXPENSES TABLE
-- ==============================================================================

CREATE POLICY "Users can view own expenses" 
ON public.expenses FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own expenses" 
ON public.expenses FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses" 
ON public.expenses FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses" 
ON public.expenses FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 10. NOTIFICATIONS TABLE
-- ==============================================================================

CREATE POLICY "Users can view own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" 
ON public.notifications FOR DELETE 
USING (auth.uid() = user_id);

-- ==============================================================================
-- 11. RECURRING INVOICES TABLE
-- ==============================================================================

CREATE POLICY "Users can view own recurring_invoices" 
ON public.recurring_invoices FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own recurring_invoices" 
ON public.recurring_invoices FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recurring_invoices" 
ON public.recurring_invoices FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recurring_invoices" 
ON public.recurring_invoices FOR DELETE 
USING (auth.uid() = user_id);
