-- ADM-04: MCP tools registry (global system catalog)
--
-- Purpose:
-- 1) Provide a single database source for MCP tool metadata.
-- 2) Enable admin CRUD management from the web interface.
-- 3) Feed the public mcp-tools.html page dynamically via API.

CREATE TABLE IF NOT EXISTS public.mcp_tools_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  source_module TEXT NOT NULL DEFAULT 'manual',
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_generated BOOLEAN NOT NULL DEFAULT FALSE,
  tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_changed_at TIMESTAMPTZ,
  last_changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT mcp_tools_registry_tool_name_ck CHECK (char_length(trim(tool_name)) > 0),
  CONSTRAINT mcp_tools_registry_tool_name_unique UNIQUE (tool_name)
);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_registry_category
  ON public.mcp_tools_registry (category, tool_name);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_registry_active
  ON public.mcp_tools_registry (is_active, category, tool_name);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_registry_source
  ON public.mcp_tools_registry (source_module, tool_name);

CREATE INDEX IF NOT EXISTS idx_mcp_tools_registry_tags_gin
  ON public.mcp_tools_registry USING GIN (tags);

ALTER TABLE public.mcp_tools_registry ENABLE ROW LEVEL SECURITY;

-- Public read policy for active tools (used by public catalogue page through anon key).
DROP POLICY IF EXISTS mcp_tools_registry_public_read_active ON public.mcp_tools_registry;
CREATE POLICY mcp_tools_registry_public_read_active
  ON public.mcp_tools_registry
  FOR SELECT
  TO anon, authenticated
  USING (is_active = TRUE);

-- Admin read policy (allows admins to inspect inactive/draft entries too).
DROP POLICY IF EXISTS mcp_tools_registry_admin_read_all ON public.mcp_tools_registry;
CREATE POLICY mcp_tools_registry_admin_read_all
  ON public.mcp_tools_registry
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin write policy.
DROP POLICY IF EXISTS mcp_tools_registry_admin_write ON public.mcp_tools_registry;
CREATE POLICY mcp_tools_registry_admin_write
  ON public.mcp_tools_registry
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_mcp_tools_registry_updated_at ON public.mcp_tools_registry;
CREATE TRIGGER trg_mcp_tools_registry_updated_at
  BEFORE UPDATE ON public.mcp_tools_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_update_updated_at();

COMMENT ON TABLE public.mcp_tools_registry IS
  'Global MCP tools catalog used by admin CRUD and dynamic public documentation page.';

COMMENT ON COLUMN public.mcp_tools_registry.tags IS
  'Functional tags used for search and filtering (e.g. billing, crm, hr, export).';

NOTIFY pgrst, 'reload schema';
