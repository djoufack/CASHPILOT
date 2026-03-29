-- Migration: Add company_id to webhook_endpoints (ENF-2)
-- webhook_endpoints was missing company_id, violating the ownership chain:
-- user → company → data

-- 1. Add company_id column (nullable first, then we backfill + enforce NOT NULL via CHECK)
ALTER TABLE public.webhook_endpoints
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE CASCADE;

-- 2. Index for performance
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_company ON public.webhook_endpoints(company_id);

-- 3. Drop old user-only RLS policy and replace with company-scoped one
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'webhook_endpoints'
      AND policyname = 'Users manage their webhooks'
  ) THEN
    DROP POLICY "Users manage their webhooks" ON public.webhook_endpoints;
  END IF;
END $$;

-- New policy: user must own the company, and company_id must match
-- When company_id IS NULL (old rows), fall back to user_id only
CREATE POLICY "Users manage their webhooks"
  ON public.webhook_endpoints
  FOR ALL
  USING (
    auth.uid() = user_id
    AND (
      company_id IS NULL
      OR company_id IN (
        SELECT id FROM public.company WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      company_id IS NULL
      OR company_id IN (
        SELECT id FROM public.company WHERE user_id = auth.uid()
      )
    )
  );
