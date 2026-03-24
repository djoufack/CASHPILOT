-- Normalize public.api_keys to a single secure model:
-- name + key_hash + key_prefix + company_id (no plaintext secret storage)

SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF to_regclass('public.api_keys') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'key_name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE public.api_keys RENAME COLUMN key_name TO name;
  END IF;
END $$;

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS key_hash TEXT,
  ADD COLUMN IF NOT EXISTS key_prefix TEXT,
  ADD COLUMN IF NOT EXISTS scopes TEXT[] DEFAULT ARRAY['read']::TEXT[],
  ADD COLUMN IF NOT EXISTS rate_limit INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'key_name'
  ) THEN
    UPDATE public.api_keys
    SET name = COALESCE(name, key_name)
    WHERE name IS NULL OR btrim(name) = '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'api_keys'
      AND column_name = 'api_key'
  ) THEN
    UPDATE public.api_keys
    SET key_hash = encode(digest(convert_to(api_key, 'UTF8'), 'sha256'), 'hex')
    WHERE (key_hash IS NULL OR btrim(key_hash) = '')
      AND api_key IS NOT NULL
      AND btrim(api_key) <> '';
  END IF;
END $$;

DO $$
DECLARE
  has_resolve_preferred_company BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'resolve_preferred_company_id'
  )
  INTO has_resolve_preferred_company;

  IF has_resolve_preferred_company THEN
    UPDATE public.api_keys ak
    SET company_id = COALESCE(
      public.resolve_preferred_company_id(ak.user_id),
      (
        SELECT c.id
        FROM public.company c
        WHERE c.user_id = ak.user_id
        ORDER BY c.id
        LIMIT 1
      )
    )
    WHERE ak.company_id IS NULL;
  ELSE
    UPDATE public.api_keys ak
    SET company_id = (
      SELECT c.id
      FROM public.company c
      WHERE c.user_id = ak.user_id
      ORDER BY c.id
      LIMIT 1
    )
    WHERE ak.company_id IS NULL;
  END IF;
END $$;

UPDATE public.api_keys
SET scopes = ARRAY['read']::TEXT[]
WHERE scopes IS NULL OR array_length(scopes, 1) IS NULL;

UPDATE public.api_keys
SET rate_limit = 100
WHERE rate_limit IS NULL OR rate_limit <= 0;

UPDATE public.api_keys
SET is_active = true
WHERE is_active IS NULL;

UPDATE public.api_keys
SET created_at = now()
WHERE created_at IS NULL;

UPDATE public.api_keys
SET key_hash = encode(digest(convert_to(gen_random_uuid()::TEXT, 'UTF8'), 'sha256'), 'hex'),
    is_active = false
WHERE key_hash IS NULL OR btrim(key_hash) = '';

UPDATE public.api_keys
SET key_prefix = substring(key_hash FROM 1 FOR 12)
WHERE key_prefix IS NULL OR btrim(key_prefix) = '';

UPDATE public.api_keys
SET name = 'API Key ' || substring(key_prefix FROM 1 FOR 8)
WHERE name IS NULL OR btrim(name) = '';

ALTER TABLE public.api_keys
  ALTER COLUMN name SET DEFAULT 'API Key',
  ALTER COLUMN key_hash SET NOT NULL,
  ALTER COLUMN key_prefix SET NOT NULL,
  ALTER COLUMN name SET NOT NULL,
  ALTER COLUMN scopes SET DEFAULT ARRAY['read']::TEXT[],
  ALTER COLUMN rate_limit SET DEFAULT 100,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN created_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.api_keys WHERE company_id IS NULL) THEN
    ALTER TABLE public.api_keys ALTER COLUMN company_id SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.api_keys DROP COLUMN IF EXISTS api_key;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS secret_hash;
ALTER TABLE public.api_keys DROP COLUMN IF EXISTS key_name;

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON public.api_keys(company_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash_unique ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON public.api_keys(is_active) WHERE is_active = true;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their API keys" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_select_own" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_insert_own" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_update_own" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_delete_own" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_all" ON public.api_keys;

CREATE POLICY "api_keys_all"
ON public.api_keys
FOR ALL
TO public
USING (
  (select auth.role()) = 'service_role'
  OR (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = api_keys.company_id
        AND c.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  (select auth.role()) = 'service_role'
  OR (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.company c
      WHERE c.id = api_keys.company_id
        AND c.user_id = auth.uid()
    )
  )
);
