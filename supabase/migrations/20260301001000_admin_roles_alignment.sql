-- ============================================================================
-- Migration 046: Align elevated roles with live Supabase schema
-- ============================================================================
-- Context:
--   - `profiles.role` remains an informational/profile field.
--   - Elevated access is granted server-side through `public.user_roles`.
--   - Atomic permissions are stored in `public.role_permissions.permission`.
--   - The first admin must be bootstrapped server-side (SQL editor, migration, or
--     service role), not from the browser.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. Core role tables
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_role_check CHECK (
    role IN ('admin', 'manager', 'accountant', 'user', 'freelance', 'client')
  )
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.user_roles ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_roles_role_check'
      AND conrelid = 'public.user_roles'::regclass
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_role_check
      CHECK (role IN ('admin', 'manager', 'accountant', 'user', 'freelance', 'client'));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_permissions_role_check CHECK (
    role IN ('admin', 'manager', 'accountant', 'user', 'freelance', 'client')
  )
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'permission'
  ) THEN
    ALTER TABLE public.role_permissions ADD COLUMN permission TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'role_permissions' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.role_permissions ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'role_permissions_role_check'
      AND conrelid = 'public.role_permissions'::regclass
  ) THEN
    ALTER TABLE public.role_permissions
      ADD CONSTRAINT role_permissions_role_check
      CHECK (role IN ('admin', 'manager', 'accountant', 'user', 'freelance', 'client'));
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_permissions_unique
  ON public.role_permissions(role, permission);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role
  ON public.role_permissions(role);
-- ----------------------------------------------------------------------------
-- B. Helper functions and triggers
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_user_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_roles_touch_updated_at ON public.user_roles;
CREATE TRIGGER trg_user_roles_touch_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_user_roles_updated_at();
CREATE OR REPLACE FUNCTION public.is_admin(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = COALESCE(target_user_id, auth.uid())
      AND ur.role = 'admin'
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
-- ----------------------------------------------------------------------------
-- C. RLS
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own role assignments" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage role assignments" ON public.user_roles;
DROP POLICY IF EXISTS "Authenticated users can read role permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Admins can manage role permissions" ON public.role_permissions;
CREATE POLICY "Users can view own role assignments"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "Admins can manage role assignments"
ON public.user_roles
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
CREATE POLICY "Authenticated users can read role permissions"
ON public.role_permissions
FOR SELECT
USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());
-- ----------------------------------------------------------------------------
-- D. Seed the canonical permission format
-- ----------------------------------------------------------------------------

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('admin', 'all:manage'),
  ('admin', 'manage_all'),
  ('admin', 'admin'),
  ('manager', 'clients:manage'),
  ('manager', 'invoices:manage'),
  ('manager', 'payments:manage'),
  ('accountant', 'accounting:manage'),
  ('accountant', 'exports:manage'),
  ('client', 'invoices:read')
ON CONFLICT (role, permission) DO NOTHING;
-- ----------------------------------------------------------------------------
-- E. Server-side bootstrap example for the first admin
-- ----------------------------------------------------------------------------
-- Replace the email below and run it from the SQL editor or a service role:
--
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin'
-- FROM auth.users
-- WHERE email = 'replace-with-real-admin@example.com'
-- ON CONFLICT (user_id) DO UPDATE
--   SET role = EXCLUDED.role,
--       updated_at = now();;
