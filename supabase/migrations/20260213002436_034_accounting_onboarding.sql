-- A. TABLE accounting_plans
CREATE TABLE IF NOT EXISTS public.accounting_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code TEXT,
  description TEXT,
  is_global BOOLEAN DEFAULT false,
  file_url TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  accounts_count INTEGER DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'country_code') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN country_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'description') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'is_global') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN is_global BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'file_url') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN file_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'source') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'status') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN status TEXT DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'accounts_count') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN accounts_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'uploaded_by') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- B. TABLE accounting_plan_accounts
CREATE TABLE IF NOT EXISTS public.accounting_plan_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.accounting_plans(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT DEFAULT 'asset' CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_code TEXT,
  description TEXT,
  is_header BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plan_accounts' AND column_name = 'parent_code') THEN
    ALTER TABLE public.accounting_plan_accounts ADD COLUMN parent_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plan_accounts' AND column_name = 'description') THEN
    ALTER TABLE public.accounting_plan_accounts ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plan_accounts' AND column_name = 'is_header') THEN
    ALTER TABLE public.accounting_plan_accounts ADD COLUMN is_header BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plan_accounts' AND column_name = 'sort_order') THEN
    ALTER TABLE public.accounting_plan_accounts ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_plan_account_code') THEN
    ALTER TABLE public.accounting_plan_accounts ADD CONSTRAINT uq_plan_account_code UNIQUE (plan_id, account_code);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plan_accounts_plan_id ON public.accounting_plan_accounts(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_accounts_parent ON public.accounting_plan_accounts(plan_id, parent_code);

-- C. PROFIL onboarding columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_step') THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_step INTEGER DEFAULT 0;
  END IF;
END $$;

-- D. CONTRAINTE profiles_role_check
DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  FOR constraint_rec IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(constraint_rec.conname);
  END LOOP;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IS NULL OR role IN ('admin', 'user', 'freelance', 'accountant', 'manager', 'client'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- E. expense_date
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_date DATE;;
