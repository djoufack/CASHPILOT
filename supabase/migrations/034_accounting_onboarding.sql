-- ============================================================================
-- Migration 034: Accounting Onboarding - Plans Comptables & Profil
-- ============================================================================
-- Sprint 2, Tache 1 : Preparer la base de donnees pour l'onboarding comptable
--
-- Contenu :
--   A. Table accounting_plans (IF NOT EXISTS + colonnes manquantes)
--   B. Table accounting_plan_accounts (IF NOT EXISTS + parent_code)
--   C. Profil : onboarding_completed, onboarding_step
--   D. Contrainte profiles_role_check (admin, user, freelance, accountant, manager, client)
--   E. Verification expense_date sur expenses
--   F. Seed : Plans comptables BE (PCMN), FR (PCG), OHADA (SYSCOHADA)
--   G. RLS policies pour accounting_plans et accounting_plan_accounts
--   H. Correctif trigger auto_journal_credit_note
--
-- DOWN (rollback manual) :
--   ALTER TABLE profiles DROP COLUMN IF EXISTS onboarding_completed;
--   ALTER TABLE profiles DROP COLUMN IF EXISTS onboarding_step;
--   DELETE FROM accounting_plan_accounts WHERE plan_id IN (
--     SELECT id FROM accounting_plans WHERE source = 'system_seed'
--   );
--   DELETE FROM accounting_plans WHERE source = 'system_seed';
-- ============================================================================

-- ============================================================================
-- A. TABLE accounting_plans
-- ============================================================================

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

-- Add missing columns if table already exists
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'created_at') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounting_plans' AND column_name = 'updated_at') THEN
    ALTER TABLE public.accounting_plans ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- ============================================================================
-- B. TABLE accounting_plan_accounts
-- ============================================================================

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

-- Add missing columns if table already exists
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

-- Unique constraint on (plan_id, account_code) to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_plan_account_code'
  ) THEN
    ALTER TABLE public.accounting_plan_accounts
      ADD CONSTRAINT uq_plan_account_code UNIQUE (plan_id, account_code);
  END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_plan_accounts_plan_id ON public.accounting_plan_accounts(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_accounts_parent ON public.accounting_plan_accounts(plan_id, parent_code);

-- ============================================================================
-- C. PROFIL : onboarding_completed, onboarding_step
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_step') THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_step INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- D. CONTRAINTE profiles_role_check
-- ============================================================================
-- Support : admin, user, freelance, accountant, manager, client
-- Drop old constraint if it exists (it may restrict to fewer values)
-- Then re-create with the complete set

DO $$
DECLARE
  constraint_rec RECORD;
BEGIN
  -- Drop all existing CHECK constraints on the role column
  -- This covers both named (profiles_role_check) and auto-generated constraints
  FOR constraint_rec IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%'
  LOOP
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(constraint_rec.conname);
  END LOOP;

  -- Add the new comprehensive check constraint
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IS NULL OR role IN ('admin', 'user', 'freelance', 'accountant', 'manager', 'client'));

EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists with correct definition, ignore
  NULL;
END $$;

-- ============================================================================
-- E. VERIFICATION expense_date SUR expenses
-- ============================================================================

-- expense_date was added in migration 029_add_expense_date.sql
-- Ensure it exists as a safety measure
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_date DATE;

-- ============================================================================
-- F. SEED : Plans comptables BE (PCMN), FR (PCG), OHADA (SYSCOHADA)
-- ============================================================================
-- Idempotent : only insert if no system_seed plans exist for the given country

-- F.1 : Belgique - Plan Comptable Minimum Normalise (PCMN)
DO $$
DECLARE
  v_plan_id UUID;
BEGIN
  -- Check if BE PCMN already seeded
  SELECT id INTO v_plan_id FROM public.accounting_plans
  WHERE country_code = 'BE' AND source = 'system_seed' AND status = 'active'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    INSERT INTO public.accounting_plans (name, country_code, description, is_global, source, status, accounts_count)
    VALUES (
      'PCMN - Plan Comptable Minimum Normalise',
      'BE',
      'Plan comptable officiel belge conforme a l''Arrete Royal du 12 septembre 1983. Classes 1 a 7 avec sous-comptes courants.',
      true,
      'system_seed',
      'active',
      22
    ) RETURNING id INTO v_plan_id;

    -- Classe 1 : Fonds propres, provisions et dettes a long terme
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '1',   'Fonds propres, provisions et dettes a plus d''un an', 'equity', NULL, true, 100),
      (v_plan_id, '100', 'Capital souscrit ou fonds social',                    'equity', '1',  false, 101),
      (v_plan_id, '130', 'Reserves',                                            'equity', '1',  false, 102),
      (v_plan_id, '140', 'Report a nouveau',                                    'equity', '1',  false, 103),
      (v_plan_id, '174', 'Autres emprunts',                                     'liability', '1', false, 104);

    -- Classe 2 : Frais d'etablissement, actifs immobilises
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '2',   'Frais d''etablissement, actifs immobilises',   'asset', NULL, true, 200),
      (v_plan_id, '230', 'Installations, machines et outillage',         'asset', '2',  false, 201),
      (v_plan_id, '240', 'Mobilier et materiel roulant',                 'asset', '2',  false, 202);

    -- Classe 3 : Stocks et commandes en cours
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '3',   'Stocks et commandes en cours d''execution',    'asset', NULL, true, 300),
      (v_plan_id, '340', 'Marchandises',                                  'asset', '3',  false, 301);

    -- Classe 4 : Creances et dettes a un an au plus
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '4',   'Creances et dettes a un an au plus',           'asset', NULL, true, 400),
      (v_plan_id, '400', 'Creances commerciales - Clients',              'asset', '4',  false, 401),
      (v_plan_id, '440', 'Dettes commerciales - Fournisseurs',           'liability', '4', false, 402),
      (v_plan_id, '451', 'TVA a payer',                                  'liability', '4', false, 403),
      (v_plan_id, '411', 'TVA a recuperer',                              'asset', '4',  false, 404);

    -- Classe 5 : Placements de tresorerie et valeurs disponibles
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '5',   'Placements de tresorerie et valeurs disponibles', 'asset', NULL, true, 500),
      (v_plan_id, '550', 'Etablissements de credit - comptes courants',     'asset', '5',  false, 501),
      (v_plan_id, '570', 'Caisse',                                          'asset', '5',  false, 502);

    -- Classe 6 : Charges
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '6',   'Charges',                                     'expense', NULL, true, 600),
      (v_plan_id, '600', 'Achats et variations de stocks',              'expense', '6',  false, 601),
      (v_plan_id, '610', 'Services et biens divers',                    'expense', '6',  false, 602);

    -- Classe 7 : Produits
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '7',   'Produits',                                    'revenue', NULL, true, 700),
      (v_plan_id, '700', 'Chiffre d''affaires',                        'revenue', '7',  false, 701),
      (v_plan_id, '7061','Prestations de services',                     'revenue', '7',  false, 702);

    -- Update accounts_count
    UPDATE public.accounting_plans SET accounts_count = (
      SELECT count(*) FROM public.accounting_plan_accounts WHERE plan_id = v_plan_id
    ) WHERE id = v_plan_id;
  END IF;
END $$;

-- F.2 : France - Plan Comptable General (PCG)
DO $$
DECLARE
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id FROM public.accounting_plans
  WHERE country_code = 'FR' AND source = 'system_seed' AND status = 'active'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    INSERT INTO public.accounting_plans (name, country_code, description, is_global, source, status, accounts_count)
    VALUES (
      'PCG - Plan Comptable General',
      'FR',
      'Plan comptable general francais conforme au reglement ANC 2014-03. Classes 1 a 7 avec sous-comptes courants.',
      true,
      'system_seed',
      'active',
      24
    ) RETURNING id INTO v_plan_id;

    -- Classe 1 : Comptes de capitaux
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '1',   'Comptes de capitaux',                         'equity', NULL, true, 100),
      (v_plan_id, '101', 'Capital social',                              'equity', '1',  false, 101),
      (v_plan_id, '106', 'Reserves',                                    'equity', '1',  false, 102),
      (v_plan_id, '110', 'Report a nouveau',                            'equity', '1',  false, 103),
      (v_plan_id, '164', 'Emprunts aupres des etablissements de credit','liability', '1', false, 104);

    -- Classe 2 : Comptes d'immobilisations
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '2',   'Comptes d''immobilisations',                  'asset', NULL, true, 200),
      (v_plan_id, '211', 'Terrains',                                    'asset', '2',  false, 201),
      (v_plan_id, '218', 'Autres immobilisations corporelles',          'asset', '2',  false, 202);

    -- Classe 3 : Comptes de stocks et en-cours
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '3',   'Comptes de stocks et en-cours',              'asset', NULL, true, 300),
      (v_plan_id, '370', 'Stocks de marchandises',                      'asset', '3',  false, 301);

    -- Classe 4 : Comptes de tiers
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '4',   'Comptes de tiers',                            'asset', NULL, true, 400),
      (v_plan_id, '411', 'Clients',                                     'asset', '4',  false, 401),
      (v_plan_id, '401', 'Fournisseurs',                                'liability', '4', false, 402),
      (v_plan_id, '44571','TVA collectee',                              'liability', '4', false, 403),
      (v_plan_id, '44566','TVA deductible sur autres biens et services','asset', '4',  false, 404);

    -- Classe 5 : Comptes financiers
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '5',   'Comptes financiers',                          'asset', NULL, true, 500),
      (v_plan_id, '512', 'Banques',                                     'asset', '5',  false, 501),
      (v_plan_id, '530', 'Caisse',                                      'asset', '5',  false, 502);

    -- Classe 6 : Comptes de charges
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '6',   'Comptes de charges',                          'expense', NULL, true, 600),
      (v_plan_id, '601', 'Achats stockes - Matieres premieres',         'expense', '6',  false, 601),
      (v_plan_id, '606', 'Achats non stockes de matieres et fournitures','expense', '6', false, 602),
      (v_plan_id, '618', 'Divers services exterieurs',                  'expense', '6',  false, 603);

    -- Classe 7 : Comptes de produits
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '7',   'Comptes de produits',                         'revenue', NULL, true, 700),
      (v_plan_id, '701', 'Ventes de produits finis',                    'revenue', '7',  false, 701),
      (v_plan_id, '706', 'Prestations de services',                     'revenue', '7',  false, 702);

    UPDATE public.accounting_plans SET accounts_count = (
      SELECT count(*) FROM public.accounting_plan_accounts WHERE plan_id = v_plan_id
    ) WHERE id = v_plan_id;
  END IF;
END $$;

-- F.3 : OHADA - Systeme Comptable OHADA (SYSCOHADA revise)
DO $$
DECLARE
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id FROM public.accounting_plans
  WHERE country_code = 'OHADA' AND source = 'system_seed' AND status = 'active'
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    INSERT INTO public.accounting_plans (name, country_code, description, is_global, source, status, accounts_count)
    VALUES (
      'SYSCOHADA - Systeme Comptable OHADA Revise',
      'OHADA',
      'Plan comptable OHADA revise applicable dans les 17 pays de l''espace OHADA (Afrique de l''Ouest et Centrale). Classes 1 a 7.',
      true,
      'system_seed',
      'active',
      26
    ) RETURNING id INTO v_plan_id;

    -- Classe 1 : Comptes de ressources durables
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '1',   'Comptes de ressources durables',              'equity', NULL, true, 100),
      (v_plan_id, '101', 'Capital social',                              'equity', '1',  false, 101),
      (v_plan_id, '106', 'Reserves',                                    'equity', '1',  false, 102),
      (v_plan_id, '110', 'Report a nouveau',                            'equity', '1',  false, 103),
      (v_plan_id, '162', 'Emprunts et dettes aupres des etablissements de credit', 'liability', '1', false, 104);

    -- Classe 2 : Comptes d'actif immobilise
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '2',   'Comptes d''actif immobilise',                 'asset', NULL, true, 200),
      (v_plan_id, '215', 'Materiel et outillage industriel et commercial','asset', '2',  false, 201),
      (v_plan_id, '244', 'Materiel et mobilier de bureau',              'asset', '2',  false, 202);

    -- Classe 3 : Comptes de stocks
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '3',   'Comptes de stocks',                           'asset', NULL, true, 300),
      (v_plan_id, '310', 'Marchandises',                                'asset', '3',  false, 301);

    -- Classe 4 : Comptes de tiers
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '4',   'Comptes de tiers',                            'asset', NULL, true, 400),
      (v_plan_id, '411', 'Clients',                                     'asset', '4',  false, 401),
      (v_plan_id, '401', 'Fournisseurs',                                'liability', '4', false, 402),
      (v_plan_id, '4431','TVA facturee sur ventes',                     'liability', '4', false, 403),
      (v_plan_id, '4452','TVA recuperable sur achats',                  'asset', '4',  false, 404);

    -- Classe 5 : Comptes de tresorerie
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '5',   'Comptes de tresorerie',                       'asset', NULL, true, 500),
      (v_plan_id, '521', 'Banques locales',                             'asset', '5',  false, 501),
      (v_plan_id, '571', 'Caisse',                                      'asset', '5',  false, 502);

    -- Classe 6 : Comptes de charges
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '6',   'Comptes de charges des activites ordinaires', 'expense', NULL, true, 600),
      (v_plan_id, '601', 'Achats de marchandises',                      'expense', '6',  false, 601),
      (v_plan_id, '605', 'Autres achats',                               'expense', '6',  false, 602),
      (v_plan_id, '638', 'Autres charges externes',                     'expense', '6',  false, 603),
      (v_plan_id, '627', 'Publicite, publications, relations publiques','expense', '6',  false, 604);

    -- Classe 7 : Comptes de produits
    INSERT INTO public.accounting_plan_accounts (plan_id, account_code, account_name, account_type, parent_code, is_header, sort_order) VALUES
      (v_plan_id, '7',   'Comptes de produits des activites ordinaires','revenue', NULL, true, 700),
      (v_plan_id, '701', 'Ventes de marchandises',                      'revenue', '7',  false, 701),
      (v_plan_id, '706', 'Services vendus',                             'revenue', '7',  false, 702);

    UPDATE public.accounting_plans SET accounts_count = (
      SELECT count(*) FROM public.accounting_plan_accounts WHERE plan_id = v_plan_id
    ) WHERE id = v_plan_id;
  END IF;
END $$;

-- ============================================================================
-- G. RLS POLICIES pour accounting_plans et accounting_plan_accounts
-- ============================================================================

ALTER TABLE public.accounting_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_plan_accounts ENABLE ROW LEVEL SECURITY;

-- accounting_plans : global plans visible by all authenticated users,
-- user-uploaded plans visible only by the uploader
DO $$
BEGIN
  -- SELECT: See global plans + own uploaded plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plans' AND policyname = 'ap_select_global_or_own') THEN
    CREATE POLICY ap_select_global_or_own ON public.accounting_plans
      FOR SELECT TO authenticated
      USING (is_global = true OR uploaded_by = auth.uid());
  END IF;

  -- INSERT: Users can insert their own plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plans' AND policyname = 'ap_insert_own') THEN
    CREATE POLICY ap_insert_own ON public.accounting_plans
      FOR INSERT TO authenticated
      WITH CHECK (uploaded_by = auth.uid() OR uploaded_by IS NULL);
  END IF;

  -- UPDATE: Users can update their own plans (not global/system ones)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plans' AND policyname = 'ap_update_own') THEN
    CREATE POLICY ap_update_own ON public.accounting_plans
      FOR UPDATE TO authenticated
      USING (uploaded_by = auth.uid() AND source != 'system_seed');
  END IF;

  -- DELETE: Users can delete their own non-system plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plans' AND policyname = 'ap_delete_own') THEN
    CREATE POLICY ap_delete_own ON public.accounting_plans
      FOR DELETE TO authenticated
      USING (uploaded_by = auth.uid() AND source != 'system_seed');
  END IF;
END $$;

-- accounting_plan_accounts : visible if the parent plan is visible
DO $$
BEGIN
  -- SELECT: See accounts of visible plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plan_accounts' AND policyname = 'apa_select_visible') THEN
    CREATE POLICY apa_select_visible ON public.accounting_plan_accounts
      FOR SELECT TO authenticated
      USING (
        plan_id IN (
          SELECT id FROM public.accounting_plans
          WHERE is_global = true OR uploaded_by = auth.uid()
        )
      );
  END IF;

  -- INSERT: Users can insert into their own plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plan_accounts' AND policyname = 'apa_insert_own') THEN
    CREATE POLICY apa_insert_own ON public.accounting_plan_accounts
      FOR INSERT TO authenticated
      WITH CHECK (
        plan_id IN (
          SELECT id FROM public.accounting_plans
          WHERE uploaded_by = auth.uid()
        )
      );
  END IF;

  -- UPDATE: Users can update accounts in their own plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plan_accounts' AND policyname = 'apa_update_own') THEN
    CREATE POLICY apa_update_own ON public.accounting_plan_accounts
      FOR UPDATE TO authenticated
      USING (
        plan_id IN (
          SELECT id FROM public.accounting_plans
          WHERE uploaded_by = auth.uid() AND source != 'system_seed'
        )
      );
  END IF;

  -- DELETE: Users can delete accounts in their own non-system plans
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'accounting_plan_accounts' AND policyname = 'apa_delete_own') THEN
    CREATE POLICY apa_delete_own ON public.accounting_plan_accounts
      FOR DELETE TO authenticated
      USING (
        plan_id IN (
          SELECT id FROM public.accounting_plans
          WHERE uploaded_by = auth.uid() AND source != 'system_seed'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- H. CORRECTIF TRIGGER auto_journal_credit_note
-- ============================================================================
-- Bug identifie dans migration 018 : le trigger credit note fait
-- Credit Client pour total_ttc, mais si total_ttc est NULL (champ non
-- renseigne), il insere quand meme une ligne avec montant 0 qui pollue
-- le grand livre. Correctif : ne pas inserer la ligne Credit si total_ttc
-- est NULL ou 0. De plus, on ajoute les colonnes manquantes dans les
-- declarations DECLARE (v_total_ttc) pour plus de robustesse.

CREATE OR REPLACE FUNCTION auto_journal_credit_note() RETURNS TRIGGER AS $$
DECLARE
  v_enabled BOOLEAN;
  v_revenue_code TEXT;
  v_vat_code TEXT;
  v_client_code TEXT;
  v_ref TEXT;
  v_tva NUMERIC;
  v_total_ttc NUMERIC;
  v_total_ht NUMERIC;
BEGIN
  -- Check if auto-journaling is enabled
  SELECT auto_journal_enabled INTO v_enabled
  FROM user_accounting_settings
  WHERE user_id = NEW.user_id;

  IF v_enabled IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only journal when status becomes 'issued'
  IF NOT (
    (TG_OP = 'INSERT' AND NEW.status = 'issued')
    OR (TG_OP = 'UPDATE' AND OLD.status != 'issued' AND NEW.status = 'issued')
  ) THEN
    RETURN NEW;
  END IF;

  -- Check idempotency
  IF EXISTS (
    SELECT 1 FROM accounting_entries
    WHERE source_type = 'credit_note' AND source_id = NEW.id
    AND user_id = NEW.user_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Pre-compute amounts with COALESCE to avoid NULL issues
  v_total_ht := COALESCE(NEW.total_ht, 0);
  v_tva := COALESCE(NEW.tax_amount, 0);
  v_total_ttc := COALESCE(NEW.total_ttc, v_total_ht + v_tva);

  -- Skip if everything is zero (nothing to journal)
  IF v_total_ttc = 0 AND v_total_ht = 0 AND v_tva = 0 THEN
    RETURN NEW;
  END IF;

  v_revenue_code := get_user_account_code(NEW.user_id, 'revenue');
  v_vat_code := get_user_account_code(NEW.user_id, 'vat_output');
  v_client_code := get_user_account_code(NEW.user_id, 'client');
  v_ref := 'CN-' || COALESCE(NEW.credit_note_number, NEW.id::TEXT);

  -- Debit: Revenue (extourne HT) - only if > 0
  IF v_total_ht > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_revenue_code, v_total_ht, 0, 'credit_note', NEW.id, 'VE', v_ref, true,
      'Extourne vente - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  -- Debit: VAT output (extourne TVA) - only if > 0
  IF v_tva > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_vat_code, v_tva, 0, 'credit_note', NEW.id, 'VE', v_ref, true,
      'Extourne TVA - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  -- Credit: Client (extourne TTC) - only if > 0 (BUG FIX: was inserting even when 0)
  IF v_total_ttc > 0 THEN
    INSERT INTO accounting_entries (user_id, transaction_date, account_code, debit, credit, source_type, source_id, journal, entry_ref, is_auto, description)
    VALUES (NEW.user_id, COALESCE(NEW.date, CURRENT_DATE), v_client_code, 0, v_total_ttc, 'credit_note', NEW.id, 'VE', v_ref, true,
      'Avoir client - NC ' || COALESCE(NEW.credit_note_number, ''));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS trg_auto_journal_credit_note ON credit_notes;
CREATE TRIGGER trg_auto_journal_credit_note
  AFTER INSERT OR UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION auto_journal_credit_note();

-- ============================================================================
-- I. INDEX supplementaires
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounting_plans_country ON public.accounting_plans(country_code);
CREATE INDEX IF NOT EXISTS idx_accounting_plans_source ON public.accounting_plans(source);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding ON public.profiles(onboarding_completed) WHERE onboarding_completed = false;

-- ============================================================================
-- MIGRATION 034 COMPLETE
-- ============================================================================
