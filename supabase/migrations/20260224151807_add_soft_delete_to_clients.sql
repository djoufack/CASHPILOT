
-- 1. Add deleted_at column
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Index for fast filtering of active clients
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients (deleted_at) WHERE deleted_at IS NULL;

-- 3. Update RLS: SELECT only shows non-deleted clients
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
CREATE POLICY "clients_select_own" ON public.clients
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 4. New policy: allow selecting deleted clients explicitly (for restore/archive view)
CREATE POLICY "clients_select_own_deleted" ON public.clients
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- 5. UPDATE policy: allow updating own clients (including for soft delete)
DROP POLICY IF EXISTS "clients_update_own" ON public.clients;
CREATE POLICY "clients_update_own" ON public.clients
  FOR UPDATE USING (auth.uid() = user_id);

-- 6. Keep DELETE policy but it won't be used by the app anymore
-- (kept for admin/maintenance purposes)
;
