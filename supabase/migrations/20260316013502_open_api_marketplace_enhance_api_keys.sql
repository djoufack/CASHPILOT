-- Add missing columns to existing api_keys table for marketplace feature
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'company_id') THEN
    ALTER TABLE public.api_keys ADD COLUMN company_id UUID REFERENCES public.company(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'rate_limit') THEN
    ALTER TABLE public.api_keys ADD COLUMN rate_limit INT NOT NULL DEFAULT 100;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_api_keys_company_id ON public.api_keys(company_id);;
