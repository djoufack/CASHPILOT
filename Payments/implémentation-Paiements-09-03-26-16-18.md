# Specification d'implementation — Gestion des Modes de Paiement CashPilot

> **Document de reference pour l'equipe d'agents coordonnes**
> Date : 2026-03-09 16:18
> Projet : CashPilot
> Supabase project_id : `rfzvrezrcigzmldgvntz`

---

## TABLE DES MATIERES

1. [Contexte et objectif](#1-contexte-et-objectif)
2. [Architecture retenue](#2-architecture-retenue)
3. [Sprint 1 — Fondation DB](#3-sprint-1--fondation-db)
4. [Sprint 2 — Registre transactionnel + Comptabilite](#4-sprint-2--registre-transactionnel--comptabilite)
5. [Sprint 3 — Frontend + MCP Tools](#5-sprint-3--frontend--mcp-tools)
6. [Sprint 4 — Stats, Exports, Alertes](#6-sprint-4--stats-exports-alertes)
7. [Migration des donnees existantes](#7-migration-des-donnees-existantes)
8. [Assignation des taches par agent](#8-assignation-des-taches-par-agent)
9. [Tests par agent](#9-tests-par-agent)
10. [Verification end-to-end](#10-verification-end-to-end)
11. [Fichiers critiques de reference](#11-fichiers-critiques-de-reference)
12. [Regles imperatives](#12-regles-imperatives)

---

# 1. Contexte et objectif

## Problemes actuels

- `payment_methods` est un catalogue UI leger (6 types textuels), pas un registre metier
- `payments.payment_method`, `expenses.payment_method`, `debt_payments.payment_method` sont des TEXT sans FK
- Pas de notion d'instrument de paiement physique (quel compte bancaire precis, quelle carte, quelle caisse)
- Pas de registre transactionnel unifie — les flux sont disperses entre `payments`, `expenses`, `debt_payments`, `bank_transactions`
- Pas de portefeuille explicite de societes
- Auto-journaling existant route vers des comptes comptables generiques (512, 530) sans sous-comptes

## Objectif

Permettre a chaque societe de :
- Gerer ses **instruments de paiement reels** (comptes bancaires nommes, cartes credit/debit, caisses)
- Tracer chaque **decaissement** (paiement fournisseur) et **encaissement** (reception client) a travers ces instruments
- **Journaliser en temps reel** chaque transaction en comptabilite double (multi-plan PCG/SYSCOHADA)
- Obtenir des **statistiques** par instrument, par societe, par portefeuille
- **Exporter** en PDF et HTML
- **Consolider** les flux de toutes les societes d'un portefeuille avec conversion multi-devises

---

# 2. Architecture retenue

## Hub d'instruments + Tables de details typees + Registre transactionnel unifie

```
company_portfolios ──────── company_portfolio_members ──── company
       │                                                      │
       └──────── company_payment_instruments (HUB) ───────────┘
                    │              │              │
    payment_instrument    payment_instrument    payment_instrument
      _bank_accounts        _cards              _cash_accounts
                    │
            payment_transactions (REGISTRE UNIFIE)
                    │
        payment_transaction_allocations
                    │
        accounting_entries (AUTO-JOURNAL)
```

## Justification

| Critere | Hub seul | 3 tables separees | **Hub + Details types (retenu)** |
|---------|----------|-------------------|----------------------------------|
| FK standard | Oui | Non (polymorphique) | **Oui** |
| Typage fort par instrument | Non (JSONB) | Oui | **Oui** |
| Requetes simples | Oui | Non (UNION) | **Oui** |
| Integrite comptable | Oui | Oui | **Oui** |
| Nombre de tables CRUD | Faible | Eleve (3x) | **Moyen** |

---

# 3. Sprint 1 — Fondation DB

## Agent S1-A : Tables Portefeuilles

### Tache : Creer company_portfolios + company_portfolio_members + ALTER company

```sql
-- =========================================================
-- PORTEFEUILLES DE SOCIETES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.company_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_name TEXT NOT NULL,
  description TEXT,
  base_currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR'
    CHECK (base_currency ~ '^[A-Z]{3}$'),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_portfolios_default_per_user
  ON public.company_portfolios(user_id)
  WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_company_portfolios_user_id
  ON public.company_portfolios(user_id);

-- =========================================================

CREATE TABLE IF NOT EXISTS public.company_portfolio_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.company_portfolios(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, company_id)
);

CREATE INDEX IF NOT EXISTS idx_company_portfolio_members_portfolio_id
  ON public.company_portfolio_members(portfolio_id);

CREATE INDEX IF NOT EXISTS idx_company_portfolio_members_company_id
  ON public.company_portfolio_members(company_id);

CREATE INDEX IF NOT EXISTS idx_company_portfolio_members_user_id
  ON public.company_portfolio_members(user_id);

-- =========================================================
-- LIEN PORTEFEUILLE SUR COMPANY
-- =========================================================

ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_company_portfolio_id
  ON public.company(portfolio_id);

-- =========================================================
-- RLS
-- =========================================================

ALTER TABLE public.company_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_portfolio_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cp_portfolios_owner_all"
  ON public.company_portfolios FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "cp_portfolio_members_owner_all"
  ON public.company_portfolio_members FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =========================================================
-- TRIGGER updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_portfolios_updated_at ON public.company_portfolios;
CREATE TRIGGER trg_company_portfolios_updated_at
  BEFORE UPDATE ON public.company_portfolios
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
```

### Test Agent S1-A

```sql
-- Verifier la creation des tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('company_portfolios', 'company_portfolio_members');
-- Attendu : 2 lignes

-- Verifier la colonne portfolio_id sur company
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'company' AND column_name = 'portfolio_id';
-- Attendu : 1 ligne, uuid

-- Verifier les RLS
SELECT tablename, policyname FROM pg_policies
WHERE tablename IN ('company_portfolios', 'company_portfolio_members');
-- Attendu : 2 policies

-- Verifier l'index unique (un seul default par user)
SELECT indexname FROM pg_indexes
WHERE tablename = 'company_portfolios' AND indexname LIKE '%default%';
-- Attendu : 1 index
```

---

## Agent S1-B : Table Hub company_payment_instruments

### Tache : Creer la table centrale des instruments de paiement

```sql
-- =========================================================
-- INSTRUMENTS DE PAIEMENT — HUB CENTRAL
-- =========================================================

CREATE TABLE IF NOT EXISTS public.company_payment_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,

  instrument_type TEXT NOT NULL CHECK (
    instrument_type IN ('bank_account', 'card', 'cash')
  ),

  instrument_subtype TEXT CHECK (
    instrument_subtype IN (
      'checking', 'savings',
      'credit_card', 'debit_card',
      'petty_cash', 'cash_register',
      'mobile_money', 'other'
    )
  ),

  code TEXT NOT NULL,
  label TEXT NOT NULL,
  display_name TEXT,
  description TEXT,

  currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR'
    CHECK (currency ~ '^[A-Z]{3}$'),

  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'inactive', 'archived', 'blocked')
  ),

  is_default BOOLEAN NOT NULL DEFAULT false,
  allow_incoming BOOLEAN NOT NULL DEFAULT true,
  allow_outgoing BOOLEAN NOT NULL DEFAULT true,
  include_in_dashboard BOOLEAN NOT NULL DEFAULT true,

  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,

  -- INTEGRATION COMPTABLE (enrichissement vs document ChatGPT)
  account_code TEXT,            -- Sous-compte comptable : 512001, 530001, etc.
  journal_code TEXT,            -- Journal associe : BQ1, CA1, etc.

  external_provider TEXT,
  external_reference TEXT,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ,

  UNIQUE (company_id, code)
);

-- INDEX
CREATE INDEX IF NOT EXISTS idx_cpi_user_id ON public.company_payment_instruments(user_id);
CREATE INDEX IF NOT EXISTS idx_cpi_company_id ON public.company_payment_instruments(company_id);
CREATE INDEX IF NOT EXISTS idx_cpi_portfolio_id ON public.company_payment_instruments(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_cpi_type ON public.company_payment_instruments(instrument_type);
CREATE INDEX IF NOT EXISTS idx_cpi_status ON public.company_payment_instruments(status);
CREATE INDEX IF NOT EXISTS idx_cpi_account_code ON public.company_payment_instruments(account_code);

-- Un seul instrument par defaut par type et par societe
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_default_instrument_per_type
  ON public.company_payment_instruments(company_id, instrument_type)
  WHERE is_default = true AND status = 'active';

-- RLS
ALTER TABLE public.company_payment_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpi_owner_all"
  ON public.company_payment_instruments FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- TRIGGER updated_at
DROP TRIGGER IF EXISTS trg_cpi_updated_at ON public.company_payment_instruments;
CREATE TRIGGER trg_cpi_updated_at
  BEFORE UPDATE ON public.company_payment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- TRIGGER sync portfolio_id depuis company
CREATE OR REPLACE FUNCTION public.sync_portfolio_from_company()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NOT NULL AND NEW.portfolio_id IS NULL THEN
    SELECT c.portfolio_id INTO NEW.portfolio_id
    FROM public.company c WHERE c.id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_portfolio_cpi ON public.company_payment_instruments;
CREATE TRIGGER trg_sync_portfolio_cpi
  BEFORE INSERT OR UPDATE ON public.company_payment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.sync_portfolio_from_company();
```

### Test Agent S1-B

```sql
-- Verifier la table
SELECT column_name FROM information_schema.columns
WHERE table_name = 'company_payment_instruments'
ORDER BY ordinal_position;
-- Attendu : ~25 colonnes incluant account_code et journal_code

-- Verifier l'index unique default per type
SELECT indexname FROM pg_indexes
WHERE tablename = 'company_payment_instruments' AND indexname LIKE '%default%';
-- Attendu : 1 index

-- Verifier le trigger portfolio sync
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'company_payment_instruments';
-- Attendu : trg_cpi_updated_at, trg_sync_portfolio_cpi
```

---

## Agent S1-C : Tables de details typees (bank, card, cash)

### Tache : Creer les 3 tables de details 1:1

```sql
-- =========================================================
-- DETAILS BANCAIRES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_instrument_bank_accounts (
  instrument_id UUID PRIMARY KEY REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,

  bank_connection_id UUID REFERENCES public.bank_connections(id) ON DELETE SET NULL,

  bank_name TEXT,
  account_holder TEXT,
  iban_masked TEXT,
  iban_encrypted TEXT,
  bic_swift TEXT,
  account_number_masked TEXT,
  institution_country TEXT,

  account_kind TEXT CHECK (
    account_kind IN ('checking', 'savings', 'business', 'escrow', 'other')
  ),

  statement_import_enabled BOOLEAN NOT NULL DEFAULT false,
  api_sync_enabled BOOLEAN NOT NULL DEFAULT false,

  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_piba_bank_connection_id
  ON public.payment_instrument_bank_accounts(bank_connection_id);

-- =========================================================
-- DETAILS CARTES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_instrument_cards (
  instrument_id UUID PRIMARY KEY REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,

  card_brand TEXT,
  card_type TEXT NOT NULL CHECK (
    card_type IN ('debit', 'credit', 'prepaid', 'virtual')
  ),

  holder_name TEXT,
  last4 TEXT CHECK (char_length(last4) <= 4),
  expiry_month INTEGER CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year INTEGER,
  issuer_name TEXT,

  billing_cycle_day INTEGER CHECK (billing_cycle_day BETWEEN 1 AND 31),
  statement_due_day INTEGER CHECK (statement_due_day BETWEEN 1 AND 31),

  credit_limit NUMERIC(18,2),
  available_credit NUMERIC(18,2),

  network_token TEXT,
  is_virtual BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- DETAILS CASH / CAISSE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_instrument_cash_accounts (
  instrument_id UUID PRIMARY KEY REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,

  cash_point_name TEXT NOT NULL,
  custodian_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  location TEXT,
  max_authorized_balance NUMERIC(18,2),
  reconciliation_frequency TEXT NOT NULL DEFAULT 'manual' CHECK (
    reconciliation_frequency IN ('daily', 'weekly', 'monthly', 'manual')
  ),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================
-- RLS pour les 3 tables de details
-- =========================================================

ALTER TABLE public.payment_instrument_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instrument_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instrument_cash_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "piba_owner_all" ON public.payment_instrument_bank_accounts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.company_payment_instruments pi
    WHERE pi.id = instrument_id AND pi.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_payment_instruments pi
    WHERE pi.id = instrument_id AND pi.user_id = auth.uid()
  ));

CREATE POLICY "pic_owner_all" ON public.payment_instrument_cards FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.company_payment_instruments pi
    WHERE pi.id = instrument_id AND pi.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_payment_instruments pi
    WHERE pi.id = instrument_id AND pi.user_id = auth.uid()
  ));

CREATE POLICY "pica_owner_all" ON public.payment_instrument_cash_accounts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.company_payment_instruments pi
    WHERE pi.id = instrument_id AND pi.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_payment_instruments pi
    WHERE pi.id = instrument_id AND pi.user_id = auth.uid()
  ));
```

### Test Agent S1-C

```sql
-- Verifier les 3 tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'payment_instrument_bank_accounts',
  'payment_instrument_cards',
  'payment_instrument_cash_accounts'
);
-- Attendu : 3 lignes

-- Verifier les FK CASCADE
SELECT tc.table_name, rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name LIKE 'payment_instrument_%' AND tc.constraint_type = 'FOREIGN KEY';
-- Attendu : CASCADE pour les 3

-- Verifier RLS
SELECT tablename, policyname FROM pg_policies
WHERE tablename LIKE 'payment_instrument_%';
-- Attendu : 3 policies
```

---

## Agent S1-D : ALTER tables existantes

### Tache : Ajouter payment_instrument_id et payment_transaction_id aux tables existantes

```sql
-- =========================================================
-- ALTER PAYMENTS
-- =========================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID
    REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;
  -- payment_transaction_id FK sera ajoutee au Sprint 2 quand la table existe

CREATE INDEX IF NOT EXISTS idx_payments_payment_instrument_id
  ON public.payments(payment_instrument_id);

-- =========================================================
-- ALTER EXPENSES
-- =========================================================

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID
    REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;

CREATE INDEX IF NOT EXISTS idx_expenses_payment_instrument_id
  ON public.expenses(payment_instrument_id);

-- =========================================================
-- ALTER DEBT_PAYMENTS
-- =========================================================

ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID
    REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;

CREATE INDEX IF NOT EXISTS idx_debt_payments_payment_instrument_id
  ON public.debt_payments(payment_instrument_id);

-- =========================================================
-- ALTER BANK_TRANSACTIONS
-- =========================================================

ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID
    REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_payment_instrument_id
  ON public.bank_transactions(payment_instrument_id);

-- =========================================================
-- ALTER BANK_STATEMENTS
-- =========================================================

ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID
    REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_statements_payment_instrument_id
  ON public.bank_statements(payment_instrument_id);

-- =========================================================
-- ALTER BANK_CONNECTIONS
-- =========================================================

ALTER TABLE public.bank_connections
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID
    REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_connections_payment_instrument_id
  ON public.bank_connections(payment_instrument_id);

-- =========================================================
-- ALTER ACCOUNTING_ENTRIES
-- =========================================================

ALTER TABLE public.accounting_entries
  ADD COLUMN IF NOT EXISTS payment_instrument_id UUID
    REFERENCES public.company_payment_instruments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_transaction_id UUID;

CREATE INDEX IF NOT EXISTS idx_accounting_entries_payment_instrument_id
  ON public.accounting_entries(payment_instrument_id);
```

### Test Agent S1-D

```sql
-- Verifier les nouvelles colonnes sur chaque table
SELECT table_name, column_name FROM information_schema.columns
WHERE column_name = 'payment_instrument_id'
  AND table_schema = 'public'
ORDER BY table_name;
-- Attendu : 7 tables (payments, expenses, debt_payments, bank_transactions, bank_statements, bank_connections, accounting_entries)

SELECT table_name, column_name FROM information_schema.columns
WHERE column_name = 'payment_transaction_id'
  AND table_schema = 'public'
ORDER BY table_name;
-- Attendu : 4 tables (payments, expenses, debt_payments, bank_transactions, accounting_entries)
```

---

# 4. Sprint 2 — Registre transactionnel + Comptabilite

## Agent S2-A : Table payment_transactions

### Tache : Creer le registre transactionnel unifie

```sql
-- =========================================================
-- REGISTRE TRANSACTIONNEL UNIFIE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,

  payment_instrument_id UUID NOT NULL
    REFERENCES public.company_payment_instruments(id) ON DELETE RESTRICT,

  transaction_kind TEXT NOT NULL CHECK (
    transaction_kind IN (
      'income', 'expense',
      'transfer_in', 'transfer_out',
      'refund_in', 'refund_out',
      'fee', 'adjustment',
      'withdrawal', 'deposit'
    )
  ),

  flow_direction TEXT NOT NULL CHECK (
    flow_direction IN ('inflow', 'outflow')
  ),

  status TEXT NOT NULL DEFAULT 'posted' CHECK (
    status IN ('draft', 'pending', 'posted', 'reconciled', 'cancelled')
  ),

  source_module TEXT NOT NULL CHECK (
    source_module IN (
      'payments', 'expenses', 'debt_payments',
      'bank_transactions', 'manual',
      'supplier_invoices', 'receivables', 'payables',
      'transfers'
    )
  ),

  source_table TEXT,
  source_id UUID,

  transaction_date DATE NOT NULL,
  posting_date DATE,
  value_date DATE,

  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR'
    CHECK (currency ~ '^[A-Z]{3}$'),

  company_currency CHARACTER VARYING(3)
    CHECK (company_currency IS NULL OR company_currency ~ '^[A-Z]{3}$'),

  fx_rate NUMERIC(18,8),
  amount_company_currency NUMERIC(18,2),

  counterparty_name TEXT,
  description TEXT,
  reference TEXT,
  external_reference TEXT,

  category TEXT,
  subcategory TEXT,

  analytical_axis_id UUID,

  attachment_url TEXT,
  notes TEXT,

  is_internal_transfer BOOLEAN NOT NULL DEFAULT false,
  transfer_group_id UUID,

  matched_bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,

  -- LIEN COMPTABLE (enrichissement)
  accounting_entry_id UUID,

  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- INDEX
CREATE INDEX IF NOT EXISTS idx_pt_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_company_id ON public.payment_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_pt_portfolio_id ON public.payment_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pt_instrument_id ON public.payment_transactions(payment_instrument_id);
CREATE INDEX IF NOT EXISTS idx_pt_transaction_date ON public.payment_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_pt_source ON public.payment_transactions(source_module, source_id);
CREATE INDEX IF NOT EXISTS idx_pt_transfer_group ON public.payment_transactions(transfer_group_id);
CREATE INDEX IF NOT EXISTS idx_pt_status ON public.payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pt_flow_direction ON public.payment_transactions(flow_direction);
CREATE INDEX IF NOT EXISTS idx_pt_accounting_entry ON public.payment_transactions(accounting_entry_id);

-- RLS
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pt_owner_all" ON public.payment_transactions FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- TRIGGER updated_at
DROP TRIGGER IF EXISTS trg_pt_updated_at ON public.payment_transactions;
CREATE TRIGGER trg_pt_updated_at
  BEFORE UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- TRIGGER sync portfolio
DROP TRIGGER IF EXISTS trg_sync_portfolio_pt ON public.payment_transactions;
CREATE TRIGGER trg_sync_portfolio_pt
  BEFORE INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_portfolio_from_company();

-- =========================================================
-- AJOUTER LES FK maintenant que payment_transactions existe
-- =========================================================

-- Ces colonnes ont ete creees sans FK au Sprint 1 (table pas encore creee)
-- On ajoute les FK constraints maintenant

DO $$
BEGIN
  -- payments.payment_transaction_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_payments_payment_transaction_id') THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT fk_payments_payment_transaction_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;

  -- expenses.payment_transaction_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_expenses_payment_transaction_id') THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT fk_expenses_payment_transaction_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;

  -- debt_payments.payment_transaction_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_debt_payments_payment_transaction_id') THEN
    ALTER TABLE public.debt_payments
      ADD CONSTRAINT fk_debt_payments_payment_transaction_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;

  -- bank_transactions.payment_transaction_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_bank_transactions_payment_transaction_id') THEN
    ALTER TABLE public.bank_transactions
      ADD CONSTRAINT fk_bank_transactions_payment_transaction_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;

  -- accounting_entries.payment_transaction_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_accounting_entries_payment_transaction_id') THEN
    ALTER TABLE public.accounting_entries
      ADD CONSTRAINT fk_accounting_entries_payment_transaction_id
      FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payments_payment_transaction_id
  ON public.payments(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_transaction_id
  ON public.expenses(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_payment_transaction_id
  ON public.debt_payments(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_payment_transaction_id
  ON public.bank_transactions(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_payment_transaction_id
  ON public.accounting_entries(payment_transaction_id);
```

### Test Agent S2-A

```sql
-- Verifier la table
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'payment_transactions';
-- Attendu : ~30 colonnes

-- Verifier les FK constraints ajoutees
SELECT constraint_name FROM information_schema.table_constraints
WHERE constraint_name LIKE 'fk_%_payment_transaction_id';
-- Attendu : 5 constraints

-- Verifier le trigger sync portfolio
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'payment_transactions';
-- Attendu : trg_pt_updated_at, trg_sync_portfolio_pt
```

---

## Agent S2-B : Tables allocations + transferts

### Tache : Creer payment_transaction_allocations et payment_transfers

```sql
-- =========================================================
-- ALLOCATIONS (ventilation multi-pieces)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_transaction_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  payment_transaction_id UUID NOT NULL
    REFERENCES public.payment_transactions(id) ON DELETE CASCADE,

  allocation_type TEXT NOT NULL CHECK (
    allocation_type IN (
      'invoice', 'expense', 'supplier_invoice',
      'receivable', 'payable', 'credit_note', 'manual'
    )
  ),

  target_id UUID NOT NULL,
  allocated_amount NUMERIC(18,2) NOT NULL CHECK (allocated_amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pta_payment_transaction_id
  ON public.payment_transaction_allocations(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pta_target
  ON public.payment_transaction_allocations(allocation_type, target_id);

ALTER TABLE public.payment_transaction_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pta_owner_all" ON public.payment_transaction_allocations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.payment_transactions pt
    WHERE pt.id = payment_transaction_id AND pt.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payment_transactions pt
    WHERE pt.id = payment_transaction_id AND pt.user_id = auth.uid()
  ));

-- =========================================================
-- TRANSFERTS INTERNES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,

  from_instrument_id UUID NOT NULL
    REFERENCES public.company_payment_instruments(id) ON DELETE RESTRICT,
  to_instrument_id UUID NOT NULL
    REFERENCES public.company_payment_instruments(id) ON DELETE RESTRICT,

  transfer_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency CHARACTER VARYING(3) NOT NULL DEFAULT 'EUR'
    CHECK (currency ~ '^[A-Z]{3}$'),

  fee_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  reference TEXT,
  notes TEXT,

  status TEXT NOT NULL DEFAULT 'posted' CHECK (
    status IN ('draft', 'pending', 'posted', 'cancelled')
  ),

  transfer_group_id UUID NOT NULL DEFAULT gen_random_uuid(),

  outflow_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  inflow_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CHECK (from_instrument_id <> to_instrument_id)
);

CREATE INDEX IF NOT EXISTS idx_ptf_user_id ON public.payment_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_ptf_company_id ON public.payment_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_ptf_portfolio_id ON public.payment_transfers(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_ptf_group_id ON public.payment_transfers(transfer_group_id);

ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ptf_owner_all" ON public.payment_transfers FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_ptf_updated_at ON public.payment_transfers;
CREATE TRIGGER trg_ptf_updated_at
  BEFORE UPDATE ON public.payment_transfers
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

DROP TRIGGER IF EXISTS trg_sync_portfolio_ptf ON public.payment_transfers;
CREATE TRIGGER trg_sync_portfolio_ptf
  BEFORE INSERT OR UPDATE ON public.payment_transfers
  FOR EACH ROW EXECUTE FUNCTION public.sync_portfolio_from_company();
```

### Test Agent S2-B

```sql
-- Verifier les tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('payment_transaction_allocations', 'payment_transfers');
-- Attendu : 2 lignes

-- Verifier CHECK constraint from != to
SELECT constraint_name FROM information_schema.check_constraints
WHERE constraint_name LIKE '%payment_transfers%';
-- Attendu : inclut le check from_instrument_id <> to_instrument_id
```

---

## Agent S2-C : Triggers de coherence et balance

### Tache : Creer les triggers metier

```sql
-- =========================================================
-- TRIGGER : Coherence company entre transaction et instrument
-- =========================================================

CREATE OR REPLACE FUNCTION public.ensure_instrument_company_consistency()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN
  SELECT company_id, user_id INTO v_company_id, v_user_id
  FROM public.company_payment_instruments
  WHERE id = NEW.payment_instrument_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Instrument de paiement % introuvable', NEW.payment_instrument_id;
  END IF;

  IF NEW.company_id <> v_company_id THEN
    RAISE EXCEPTION 'Incoherence company_id entre transaction (%) et instrument (%)',
      NEW.company_id, v_company_id;
  END IF;

  IF NEW.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Incoherence user_id entre transaction et instrument';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_instrument_consistency ON public.payment_transactions;
CREATE TRIGGER trg_ensure_instrument_consistency
  BEFORE INSERT OR UPDATE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.ensure_instrument_company_consistency();

-- =========================================================
-- TRIGGER : Mise a jour du solde de l'instrument
-- =========================================================

CREATE OR REPLACE FUNCTION public.apply_payment_transaction_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('posted', 'reconciled') AND NEW.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance +
        CASE
          WHEN NEW.flow_direction = 'inflow' THEN NEW.amount
          WHEN NEW.flow_direction = 'outflow' THEN -NEW.amount
          ELSE 0
        END,
        updated_at = now()
      WHERE id = NEW.payment_instrument_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Annuler l'ancien impact
    IF OLD.status IN ('posted', 'reconciled') AND OLD.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance -
        CASE
          WHEN OLD.flow_direction = 'inflow' THEN OLD.amount
          WHEN OLD.flow_direction = 'outflow' THEN -OLD.amount
          ELSE 0
        END,
        updated_at = now()
      WHERE id = OLD.payment_instrument_id;
    END IF;

    -- Appliquer le nouveau impact
    IF NEW.status IN ('posted', 'reconciled') AND NEW.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance +
        CASE
          WHEN NEW.flow_direction = 'inflow' THEN NEW.amount
          WHEN NEW.flow_direction = 'outflow' THEN -NEW.amount
          ELSE 0
        END,
        updated_at = now()
      WHERE id = NEW.payment_instrument_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('posted', 'reconciled') AND OLD.deleted_at IS NULL THEN
      UPDATE public.company_payment_instruments
      SET current_balance = current_balance -
        CASE
          WHEN OLD.flow_direction = 'inflow' THEN OLD.amount
          WHEN OLD.flow_direction = 'outflow' THEN -OLD.amount
          ELSE 0
        END,
        updated_at = now()
      WHERE id = OLD.payment_instrument_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_pt_balance ON public.payment_transactions;
CREATE TRIGGER trg_apply_pt_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_transactions
  FOR EACH ROW EXECUTE FUNCTION public.apply_payment_transaction_balance();

-- =========================================================
-- TRIGGER : Audit log des instruments
-- =========================================================

CREATE OR REPLACE FUNCTION public.log_payment_instrument_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.payment_instrument_audit_log (
      user_id, company_id, payment_instrument_id, action, new_data
    ) VALUES (
      NEW.user_id, NEW.company_id, NEW.id, 'created', to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.payment_instrument_audit_log (
      user_id, company_id, payment_instrument_id, action, old_data, new_data
    ) VALUES (
      NEW.user_id, NEW.company_id, NEW.id,
      CASE WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_changed' ELSE 'updated' END,
      to_jsonb(OLD), to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Note : ce trigger sera active APRES la creation de payment_instrument_audit_log (Agent S2-D)

-- =========================================================
-- FUNCTION : Auto-numerotation des sous-comptes comptables
-- =========================================================

CREATE OR REPLACE FUNCTION public.generate_instrument_account_code(
  p_company_id UUID,
  p_instrument_type TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_base_code TEXT;
  v_plan TEXT;
  v_next_seq INT;
BEGIN
  -- Determiner le plan comptable de la societe
  SELECT COALESCE(
    (SELECT ap.plan_type FROM public.accounting_plans ap
     JOIN public.company c ON c.id = p_company_id
     WHERE ap.user_id = c.user_id AND ap.is_active = true
     LIMIT 1),
    'pcg'
  ) INTO v_plan;

  -- Determiner le code de base selon le type et le plan
  v_base_code := CASE
    WHEN p_instrument_type = 'bank_account' AND v_plan = 'pcg' THEN '512'
    WHEN p_instrument_type = 'bank_account' AND v_plan = 'syscohada' THEN '521'
    WHEN p_instrument_type = 'cash' AND v_plan = 'pcg' THEN '530'
    WHEN p_instrument_type = 'cash' AND v_plan = 'syscohada' THEN '571'
    WHEN p_instrument_type = 'card' AND v_plan = 'pcg' THEN '512'
    WHEN p_instrument_type = 'card' AND v_plan = 'syscohada' THEN '521'
    ELSE '512'
  END;

  -- Trouver le prochain numero de sequence
  SELECT COALESCE(MAX(
    CASE
      WHEN account_code ~ ('^' || v_base_code || '\d+$')
      THEN CAST(SUBSTRING(account_code FROM length(v_base_code) + 1) AS INTEGER)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_seq
  FROM public.company_payment_instruments
  WHERE company_id = p_company_id
    AND account_code LIKE v_base_code || '%';

  RETURN v_base_code || LPAD(v_next_seq::TEXT, 3, '0');
END;
$$;
```

### Test Agent S2-C

```sql
-- Test coherence : doit echouer si company_id ne correspond pas
-- (a tester avec des donnees reelles apres seed)

-- Test balance : inserer une transaction et verifier le solde
-- (a tester avec des donnees reelles apres seed)

-- Test generate_instrument_account_code
SELECT public.generate_instrument_account_code(
  (SELECT id FROM public.company LIMIT 1),
  'bank_account'
);
-- Attendu : '512001' (premier compte bancaire)

-- Verifier les triggers
SELECT trigger_name, event_object_table FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_%'
  AND event_object_table = 'payment_transactions';
-- Attendu : trg_ensure_instrument_consistency, trg_apply_pt_balance, trg_pt_updated_at, trg_sync_portfolio_pt
```

---

## Agent S2-D : Tables support (audit, alertes, rapprochement, exports)

### Tache : Creer les 4 tables de support

```sql
-- =========================================================
-- AUDIT LOG
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_instrument_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (
    action IN ('created', 'updated', 'status_changed', 'archived', 'unarchived', 'balance_adjusted', 'exported')
  ),
  old_data JSONB,
  new_data JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pial_instrument_id
  ON public.payment_instrument_audit_log(payment_instrument_id);

ALTER TABLE public.payment_instrument_audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log : lecture seule pour l'utilisateur
CREATE POLICY "pial_owner_read" ON public.payment_instrument_audit_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.company_payment_instruments pi
    WHERE pi.id = payment_instrument_id AND pi.user_id = auth.uid()
  ));

-- Activer le trigger d'audit maintenant que la table existe
DROP TRIGGER IF EXISTS trg_log_instrument_changes ON public.company_payment_instruments;
CREATE TRIGGER trg_log_instrument_changes
  AFTER INSERT OR UPDATE ON public.company_payment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_instrument_changes();

-- =========================================================
-- ALERTES DE PAIEMENT
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  payment_instrument_id UUID REFERENCES public.company_payment_instruments(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (
    alert_type IN (
      'low_balance', 'negative_balance', 'credit_limit_reached',
      'large_cash_movement', 'sync_failed', 'reconciliation_gap'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  message TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pa_user_id ON public.payment_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_pa_instrument_id ON public.payment_alerts(payment_instrument_id);

ALTER TABLE public.payment_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_owner_all" ON public.payment_alerts FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- RAPPROCHEMENT BANCAIRE ENRICHI
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  payment_transaction_id UUID NOT NULL REFERENCES public.payment_transactions(id) ON DELETE CASCADE,
  bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  statement_line_id UUID REFERENCES public.bank_statement_lines(id) ON DELETE SET NULL,
  reconciliation_status TEXT NOT NULL CHECK (
    reconciliation_status IN ('matched', 'partial', 'manual', 'rejected')
  ),
  matched_amount NUMERIC(18,2),
  confidence_score NUMERIC(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pr_pt_id ON public.payment_reconciliations(payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pr_bt_id ON public.payment_reconciliations(bank_transaction_id);

ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_owner_all" ON public.payment_reconciliations FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- =========================================================
-- EXPORTS DE RAPPORTS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.payment_report_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  portfolio_id UUID REFERENCES public.company_portfolios(id) ON DELETE SET NULL,
  export_scope TEXT NOT NULL CHECK (
    export_scope IN ('company', 'portfolio', 'instrument', 'transaction_list')
  ),
  export_format TEXT NOT NULL CHECK (
    export_format IN ('pdf', 'html')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  ),
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_url TEXT,
  file_size BIGINT,
  generated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pre_user_id ON public.payment_report_exports(user_id);

ALTER TABLE public.payment_report_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pre_owner_all" ON public.payment_report_exports FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

### Test Agent S2-D

```sql
-- Verifier les 4 tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN (
  'payment_instrument_audit_log', 'payment_alerts',
  'payment_reconciliations', 'payment_report_exports'
);
-- Attendu : 4 lignes

-- Verifier que le trigger d'audit est actif
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'company_payment_instruments'
  AND trigger_name = 'trg_log_instrument_changes';
-- Attendu : 1 ligne
```

---

## Agent S2-E : Vues analytiques et RPCs

### Tache : Creer les vues et fonctions de statistiques

```sql
-- =========================================================
-- VUE : Stats par instrument
-- =========================================================

CREATE OR REPLACE VIEW public.v_payment_instrument_stats AS
SELECT
  pi.id AS payment_instrument_id,
  pi.user_id,
  pi.company_id,
  pi.portfolio_id,
  pi.instrument_type,
  pi.instrument_subtype,
  pi.label,
  pi.currency,
  pi.current_balance,
  COUNT(pt.id) AS transaction_count,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS total_inflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS total_outflow,
  COALESCE(SUM(CASE
    WHEN pt.flow_direction = 'inflow' THEN pt.amount
    WHEN pt.flow_direction = 'outflow' THEN -pt.amount
    ELSE 0
  END), 0) AS net_flow
FROM public.company_payment_instruments pi
LEFT JOIN public.payment_transactions pt
  ON pt.payment_instrument_id = pi.id
  AND pt.deleted_at IS NULL
  AND pt.status IN ('posted', 'reconciled')
GROUP BY pi.id, pi.user_id, pi.company_id, pi.portfolio_id,
  pi.instrument_type, pi.instrument_subtype, pi.label, pi.currency, pi.current_balance;

-- =========================================================
-- VUE : Stats par societe
-- =========================================================

CREATE OR REPLACE VIEW public.v_company_payment_stats AS
SELECT
  pt.user_id,
  pt.company_id,
  pt.portfolio_id,
  COUNT(pt.id) AS transaction_count,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS total_inflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS total_outflow,
  COALESCE(SUM(CASE
    WHEN pt.flow_direction = 'inflow' THEN pt.amount
    WHEN pt.flow_direction = 'outflow' THEN -pt.amount
    ELSE 0
  END), 0) AS net_flow
FROM public.payment_transactions pt
WHERE pt.deleted_at IS NULL AND pt.status IN ('posted', 'reconciled')
GROUP BY pt.user_id, pt.company_id, pt.portfolio_id;

-- =========================================================
-- VUE : Stats par portefeuille
-- =========================================================

CREATE OR REPLACE VIEW public.v_portfolio_payment_stats AS
SELECT
  pt.user_id,
  pt.portfolio_id,
  COUNT(pt.id) AS transaction_count,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS total_inflow,
  COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS total_outflow,
  COALESCE(SUM(CASE
    WHEN pt.flow_direction = 'inflow' THEN pt.amount
    WHEN pt.flow_direction = 'outflow' THEN -pt.amount
    ELSE 0
  END), 0) AS net_flow
FROM public.payment_transactions pt
WHERE pt.deleted_at IS NULL
  AND pt.status IN ('posted', 'reconciled')
  AND pt.portfolio_id IS NOT NULL
GROUP BY pt.user_id, pt.portfolio_id;

-- =========================================================
-- RPC : Volume par methode de paiement (evolution mensuelle)
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_payment_volume_by_method(
  p_user_id UUID,
  p_company_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '12 months')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  month TEXT,
  instrument_type TEXT,
  instrument_subtype TEXT,
  transaction_count BIGINT,
  total_inflow NUMERIC,
  total_outflow NUMERIC,
  net_flow NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    TO_CHAR(pt.transaction_date, 'YYYY-MM') AS month,
    pi.instrument_type,
    pi.instrument_subtype,
    COUNT(pt.id) AS transaction_count,
    COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS total_inflow,
    COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS total_outflow,
    COALESCE(SUM(CASE
      WHEN pt.flow_direction = 'inflow' THEN pt.amount
      WHEN pt.flow_direction = 'outflow' THEN -pt.amount
      ELSE 0
    END), 0) AS net_flow
  FROM public.payment_transactions pt
  JOIN public.company_payment_instruments pi ON pi.id = pt.payment_instrument_id
  WHERE pt.user_id = p_user_id
    AND (p_company_id IS NULL OR pt.company_id = p_company_id)
    AND pt.transaction_date BETWEEN p_start_date AND p_end_date
    AND pt.deleted_at IS NULL
    AND pt.status IN ('posted', 'reconciled')
  GROUP BY TO_CHAR(pt.transaction_date, 'YYYY-MM'), pi.instrument_type, pi.instrument_subtype
  ORDER BY month, pi.instrument_type;
$$;

-- =========================================================
-- RPC : Cash flow par instrument
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_account_cash_flow(
  p_instrument_id UUID,
  p_months INT DEFAULT 6
)
RETURNS TABLE (
  month TEXT,
  inflow NUMERIC,
  outflow NUMERIC,
  net NUMERIC,
  running_balance NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH monthly AS (
    SELECT
      TO_CHAR(pt.transaction_date, 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS inflow,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS outflow
    FROM public.payment_transactions pt
    WHERE pt.payment_instrument_id = p_instrument_id
      AND pt.transaction_date >= (CURRENT_DATE - (p_months || ' months')::INTERVAL)::DATE
      AND pt.deleted_at IS NULL
      AND pt.status IN ('posted', 'reconciled')
    GROUP BY TO_CHAR(pt.transaction_date, 'YYYY-MM')
    ORDER BY month
  )
  SELECT
    m.month,
    m.inflow,
    m.outflow,
    m.inflow - m.outflow AS net,
    SUM(m.inflow - m.outflow) OVER (ORDER BY m.month) +
      (SELECT opening_balance FROM public.company_payment_instruments WHERE id = p_instrument_id)
    AS running_balance
  FROM monthly m;
$$;

-- =========================================================
-- RPC : Evolution du solde quotidien
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_account_balance_evolution(
  p_instrument_id UUID,
  p_days INT DEFAULT 90
)
RETURNS TABLE (
  day DATE,
  daily_inflow NUMERIC,
  daily_outflow NUMERIC,
  closing_balance NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH daily AS (
    SELECT
      pt.transaction_date AS day,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'inflow' THEN pt.amount ELSE 0 END), 0) AS daily_inflow,
      COALESCE(SUM(CASE WHEN pt.flow_direction = 'outflow' THEN pt.amount ELSE 0 END), 0) AS daily_outflow
    FROM public.payment_transactions pt
    WHERE pt.payment_instrument_id = p_instrument_id
      AND pt.transaction_date >= (CURRENT_DATE - p_days)
      AND pt.deleted_at IS NULL
      AND pt.status IN ('posted', 'reconciled')
    GROUP BY pt.transaction_date
    ORDER BY pt.transaction_date
  )
  SELECT
    d.day,
    d.daily_inflow,
    d.daily_outflow,
    SUM(d.daily_inflow - d.daily_outflow) OVER (ORDER BY d.day) +
      (SELECT opening_balance FROM public.company_payment_instruments WHERE id = p_instrument_id)
    AS closing_balance
  FROM daily d;
$$;

-- =========================================================
-- RPC : Consolidation portefeuille multi-devises
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_portfolio_consolidated_balances(
  p_user_id UUID
)
RETURNS TABLE (
  portfolio_id UUID,
  portfolio_name TEXT,
  base_currency TEXT,
  company_id UUID,
  company_name TEXT,
  instrument_id UUID,
  instrument_label TEXT,
  instrument_type TEXT,
  instrument_currency TEXT,
  balance_original NUMERIC,
  balance_base_currency NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    cp.id AS portfolio_id,
    cp.portfolio_name,
    cp.base_currency,
    c.id AS company_id,
    c.company_name,
    pi.id AS instrument_id,
    pi.label AS instrument_label,
    pi.instrument_type,
    pi.currency AS instrument_currency,
    pi.current_balance AS balance_original,
    -- Conversion simplifiee (a enrichir avec les taux de change reels)
    CASE
      WHEN pi.currency = cp.base_currency THEN pi.current_balance
      ELSE pi.current_balance -- TODO: multiplier par le taux de change via exchange_rates
    END AS balance_base_currency
  FROM public.company_portfolios cp
  JOIN public.company_portfolio_members cpm ON cpm.portfolio_id = cp.id
  JOIN public.company c ON c.id = cpm.company_id
  JOIN public.company_payment_instruments pi ON pi.company_id = c.id AND pi.status = 'active'
  WHERE cp.user_id = p_user_id;
$$;

-- =========================================================
-- RPC : Depenses par carte et categorie
-- =========================================================

CREATE OR REPLACE FUNCTION public.rpc_card_spending_by_category(
  p_instrument_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '3 months')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category TEXT,
  subcategory TEXT,
  transaction_count BIGINT,
  total_amount NUMERIC
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    COALESCE(pt.category, 'Non categorise') AS category,
    pt.subcategory,
    COUNT(pt.id) AS transaction_count,
    SUM(pt.amount) AS total_amount
  FROM public.payment_transactions pt
  WHERE pt.payment_instrument_id = p_instrument_id
    AND pt.flow_direction = 'outflow'
    AND pt.transaction_date BETWEEN p_start_date AND p_end_date
    AND pt.deleted_at IS NULL
    AND pt.status IN ('posted', 'reconciled')
  GROUP BY pt.category, pt.subcategory
  ORDER BY total_amount DESC;
$$;
```

### Test Agent S2-E

```sql
-- Verifier les vues
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public' AND table_name LIKE 'v_%payment%';
-- Attendu : 3 vues

-- Verifier les RPCs
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name LIKE 'rpc_%';
-- Attendu : inclut rpc_payment_volume_by_method, rpc_account_cash_flow,
--   rpc_account_balance_evolution, rpc_portfolio_consolidated_balances,
--   rpc_card_spending_by_category
```

---

# 5. Sprint 3 — Frontend + MCP Tools

## Agent S3-A : Hooks frontend

### Tache : Creer les hooks React pour les instruments de paiement

**Fichiers a creer :**

| Fichier | Pattern a suivre | Description |
|---------|------------------|-------------|
| `src/hooks/usePaymentInstruments.js` | `src/hooks/useBankConnections.js` | CRUD instruments avec useCompanyScope |
| `src/hooks/useInstrumentCards.js` | `src/hooks/usePaymentMethods.js` | CRUD cartes liees a un instrument |
| `src/hooks/useInstrumentCashAccounts.js` | `src/hooks/usePaymentMethods.js` | CRUD caisses |
| `src/hooks/usePaymentTransactions.js` | `src/hooks/usePayments.js` | Lecture/filtrage registre unifie |
| `src/hooks/usePaymentTransfers.js` | `src/hooks/usePayments.js` | Transferts entre instruments |
| `src/hooks/usePaymentInstrumentStats.js` | Nouveau | Appels RPC stats (recharts-ready) |
| `src/hooks/usePortfolios.js` | `src/hooks/useCompany.js` | CRUD portefeuilles |

**Pattern obligatoire (depuis useBankConnections.js) :**

```javascript
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useActiveCompanyId } from './useActiveCompanyId';

export function usePaymentInstruments() {
  const [instruments, setInstruments] = useState([]);
  const [loading, setLoading] = useState(false);
  const activeCompanyId = useActiveCompanyId();

  const fetchInstruments = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      let query = supabase
        .from('company_payment_instruments')
        .select('*, payment_instrument_bank_accounts(*), payment_instrument_cards(*), payment_instrument_cash_accounts(*)')
        .eq('company_id', activeCompanyId)
        .order('sort_order', { ascending: true });

      if (filters.type) query = query.eq('instrument_type', filters.type);
      if (filters.status) query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      setInstruments(data || []);
      return data;
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  const createInstrument = useCallback(async (instrumentData) => {
    // Appeler la RPC generate_instrument_account_code si account_code non fourni
    // Inserer dans company_payment_instruments + table de detail selon type
    // ...
  }, [activeCompanyId]);

  // updateInstrument, deleteInstrument, etc.

  return { instruments, loading, fetchInstruments, createInstrument /* ... */ };
}
```

**Fichier a modifier :**
- `src/hooks/usePayments.js` : Ajouter parametre `payment_instrument_id` a `createPayment()` et `createLumpSumPayment()`

### Test Agent S3-A

```
- Chaque hook exporte les fonctions CRUD attendues
- Chaque hook utilise useActiveCompanyId() pour le scope
- usePaymentInstruments fait un SELECT avec jointure sur les 3 tables de details
- usePaymentTransactions supporte les filtres : date, instrument, flow_direction, status
- usePaymentInstrumentStats appelle les RPCs et retourne des donnees recharts-ready
- Pas d'erreur de build : npm run build
```

---

## Agent S3-B : Page et composants frontend

### Tache : Creer la page FinancialInstrumentsPage et ses composants

**Design DNA (OBLIGATOIRE) :**
- Dark glassmorphism : backgrounds #0a0e1a, #0f1528, #141c33
- Accent orange : #F59E0B
- Bordures : border-gray-800/50
- Icones : Lucide React (Wallet, CreditCard, Banknote, Building2, ArrowLeftRight)
- Animations : Framer Motion (staggered cards)
- Charts : recharts (AreaChart, BarChart, ComposedChart)
- Responsive : grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3

**Fichiers a creer :**

| Fichier | Description |
|---------|-------------|
| `src/pages/FinancialInstrumentsPage.jsx` | Page principale avec 4 onglets (Tabs Shadcn) |
| `src/components/financial-instruments/InstrumentsList.jsx` | Grille de cartes avec solde, type, statut |
| `src/components/financial-instruments/BankAccountForm.jsx` | Dialog creation/edition compte bancaire |
| `src/components/financial-instruments/CardGrid.jsx` | Affichage visuel des cartes (masquees) |
| `src/components/financial-instruments/CardForm.jsx` | Dialog ajout/edition carte |
| `src/components/financial-instruments/CashRegisterPanel.jsx` | Gestion des caisses |
| `src/components/financial-instruments/TransferDialog.jsx` | Dialog de transfert entre instruments |
| `src/components/financial-instruments/InstrumentBalanceChart.jsx` | recharts AreaChart evolution solde |
| `src/components/financial-instruments/PaymentVolumeChart.jsx` | recharts BarChart volume par type |
| `src/components/financial-instruments/InstrumentCashFlowChart.jsx` | recharts ComposedChart in/out |
| `src/components/financial-instruments/PortfolioConsolidatedView.jsx` | Vue multi-societes avec FX |

**Fichiers a modifier :**

| Fichier | Modification |
|---------|-------------|
| Navigation/Sidebar | Ajouter entree "Instruments financiers" (icone Wallet) |
| `src/pages/Dashboard.jsx` | Ajouter widget resume des soldes par instrument |
| `src/pages/PortfolioPage.jsx` | Integrer PortfolioConsolidatedView |

### Test Agent S3-B

```
- La page s'affiche sans erreur
- Les 4 onglets fonctionnent (Comptes Bancaires, Cartes, Caisses, Statistiques)
- Le formulaire de creation de compte bancaire ouvre un dialog
- Les cartes s'affichent avec le numero masque (****1234)
- Les charts se chargent (meme vides)
- Le design respecte le DNA (dark glassmorphism, orange accent)
- Responsive : mobile, tablet, desktop
- npm run build reussit sans erreur
```

---

## Agent S3-C : MCP Tools

### Tache : Creer les outils MCP pour les instruments de paiement

**Fichier a creer : `mcp-server/src/tools/financial-instruments.ts`**

**Pattern a suivre : `mcp-server/src/tools/payments.ts`**

---

### Outil 1 : `list_payment_instruments`

**Description :** Liste les instruments de paiement avec filtres optionnels

**Parametres :**

```typescript
{
  company_id?: string,       // UUID — filtre par societe (defaut: societe active)
  instrument_type?: string,  // 'bank_account' | 'card' | 'cash'
  status?: string,           // 'active' | 'inactive' | 'archived' | 'blocked' (defaut: 'active')
  include_details?: boolean  // Si true, joint les tables de details (bank/card/cash) — defaut: true
}
```

**Logique :**
```
1. SELECT * FROM company_payment_instruments WHERE company_id = ? AND user_id = auth.uid()
2. Si include_details: LEFT JOIN payment_instrument_bank_accounts / _cards / _cash_accounts
3. Filtrer par instrument_type et status si fournis
4. ORDER BY sort_order, label
```

**Retour :** Array d'instruments avec leurs details types

---

### Outil 2 : `create_payment_instrument`

**Description :** Cree un instrument de paiement + sa table de detail selon le type + auto-genere l'account_code comptable

**Parametres :**

```typescript
{
  // Champs obligatoires
  company_id: string,          // UUID de la societe
  instrument_type: string,     // 'bank_account' | 'card' | 'cash'
  label: string,               // Nom affiche ("BNP Pro", "Visa Business", "Caisse magasin 1")

  // Champs optionnels generaux
  instrument_subtype?: string, // 'checking' | 'savings' | 'credit_card' | 'debit_card' | 'petty_cash' | 'cash_register' | 'mobile_money' | 'other'
  display_name?: string,       // Nom long
  description?: string,
  currency?: string,           // ISO 4217 (defaut: devise de la societe)
  is_default?: boolean,        // Defaut: false
  opening_balance?: number,    // Solde d'ouverture (defaut: 0)
  account_code?: string,       // Si non fourni: auto-genere via generate_instrument_account_code()
  journal_code?: string,       // Si non fourni: 'BQ' pour bank, 'CA' pour cash

  // Details bancaires (si type = 'bank_account')
  bank_details?: {
    bank_connection_id?: string,  // UUID — lier a une connexion GoCardless existante
    bank_name?: string,
    account_holder?: string,
    iban?: string,                // Sera masque automatiquement (****1234)
    bic_swift?: string,
    account_kind?: string,        // 'checking' | 'savings' | 'business' | 'escrow' | 'other'
    api_sync_enabled?: boolean
  },

  // Details carte (si type = 'card')
  card_details?: {
    card_brand?: string,          // 'visa' | 'mastercard' | 'amex' | etc.
    card_type: string,            // 'debit' | 'credit' | 'prepaid' | 'virtual'
    holder_name?: string,
    last4?: string,               // 4 derniers chiffres
    expiry_month?: number,        // 1-12
    expiry_year?: number,         // 2024+
    issuer_name?: string,
    credit_limit?: number,
    is_virtual?: boolean
  },

  // Details caisse (si type = 'cash')
  cash_details?: {
    cash_point_name: string,      // Nom du point de caisse
    custodian_user_id?: string,   // UUID du responsable
    location?: string,
    max_authorized_balance?: number,
    reconciliation_frequency?: string  // 'daily' | 'weekly' | 'monthly' | 'manual'
  }
}
```

**Logique :**
```
1. Generer code unique: "{TYPE}-{LABEL_SLUG}-{SUBSTR(company_id,0,8)}"
2. Si account_code non fourni: appeler generate_instrument_account_code(company_id, type)
3. INSERT INTO company_payment_instruments (...)
4. Selon instrument_type:
   - 'bank_account': INSERT INTO payment_instrument_bank_accounts (instrument_id, ...)
     - Si iban fourni: masquer (****XXXX) dans iban_masked, chiffrer dans iban_encrypted
   - 'card': INSERT INTO payment_instrument_cards (instrument_id, ...)
   - 'cash': INSERT INTO payment_instrument_cash_accounts (instrument_id, ...)
5. Retourner l'instrument complet avec ses details
```

**Retour :** L'instrument cree avec ses details

---

### Outil 3 : `update_payment_instrument`

**Description :** Met a jour un instrument de paiement et/ou ses details

**Parametres :**

```typescript
{
  id: string,                  // UUID de l'instrument
  // Champs modifiables sur company_payment_instruments
  label?: string,
  display_name?: string,
  description?: string,
  status?: string,             // 'active' | 'inactive' | 'archived' | 'blocked'
  is_default?: boolean,
  allow_incoming?: boolean,
  allow_outgoing?: boolean,
  include_in_dashboard?: boolean,
  account_code?: string,
  journal_code?: string,

  // Details specifiques au type (memes schemas que create)
  bank_details?: { ... },
  card_details?: { ... },
  cash_details?: { ... }
}
```

**Logique :**
```
1. UPDATE company_payment_instruments SET ... WHERE id = ? AND user_id = auth.uid()
2. Si bank/card/cash_details fournis: UPDATE la table de detail correspondante
3. Le trigger log_payment_instrument_changes() enregistre automatiquement l'audit
```

---

### Outil 4 : `delete_payment_instrument`

**Description :** Supprime un instrument de paiement (avec safety check)

**Parametres :**

```typescript
{
  id: string,        // UUID de l'instrument
  force?: boolean    // Si true: supprime meme avec des transactions (defaut: false)
}
```

**Logique :**
```
1. Verifier qu'aucune payment_transaction n'est liee (sauf si force=true)
   - SELECT COUNT(*) FROM payment_transactions WHERE payment_instrument_id = ?
   - Si count > 0 et force=false: ERREUR "Instrument lie a N transactions"
2. Si force=true: soft-delete (SET status='archived', archived_at=now())
3. Si aucune transaction: DELETE FROM company_payment_instruments WHERE id = ?
   (CASCADE supprimera la table de detail automatiquement)
```

**Retour :** { deleted: true } ou { archived: true, transaction_count: N }

---

### Outil 5 : `create_payment_transaction`

**Description :** Cree une transaction dans le registre unifie avec journalisation comptable automatique

**Parametres :**

```typescript
{
  // Obligatoires
  payment_instrument_id: string,  // UUID — instrument utilise
  transaction_kind: string,       // 'income' | 'expense' | 'refund_in' | 'refund_out' | 'fee' | 'adjustment' | 'withdrawal' | 'deposit'
  amount: number,                 // Montant > 0
  transaction_date: string,       // Date ISO (YYYY-MM-DD)

  // Optionnels
  counterparty_name?: string,     // Nom du fournisseur ou client
  description?: string,
  reference?: string,             // Reference interne
  external_reference?: string,    // Reference externe (num cheque, ref virement...)
  category?: string,              // Categorie de depense/revenu
  subcategory?: string,
  notes?: string,
  attachment_url?: string,

  // Devises
  currency?: string,              // ISO 4217 (defaut: devise de l'instrument)
  fx_rate?: number,               // Taux de change si devise != devise societe

  // Allocation a un document metier
  allocations?: Array<{
    allocation_type: string,      // 'invoice' | 'expense' | 'supplier_invoice' | 'receivable' | 'payable' | 'credit_note'
    target_id: string,            // UUID du document
    allocated_amount: number
  }>,

  // Source (si cree depuis un autre module)
  source_module?: string,         // 'payments' | 'expenses' | 'debt_payments' | 'manual' | etc.
  source_id?: string              // UUID de la ligne source
}
```

**Logique :**
```
1. Determiner flow_direction depuis transaction_kind:
   - 'income', 'refund_in', 'deposit' → 'inflow'
   - 'expense', 'refund_out', 'fee', 'adjustment', 'withdrawal' → 'outflow'
2. Recuperer company_id et user_id depuis l'instrument
3. INSERT INTO payment_transactions (...) — status='posted'
4. Le trigger apply_payment_transaction_balance() met a jour le solde de l'instrument
5. Le trigger auto_journal_payment_transaction() cree l'ecriture comptable:
   - Lit account_code de l'instrument (ex: 512001)
   - Determine le compte contrepartie selon transaction_kind + counterparty
   - Insere dans accounting_entries avec journal = instrument.journal_code
6. Si allocations fournies: INSERT INTO payment_transaction_allocations
7. Retourner la transaction creee + l'ecriture comptable generee
```

**Retour :** { transaction: {...}, accounting_entry: {...}, new_balance: number }

---

### Outil 6 : `list_payment_transactions`

**Description :** Liste les transactions du registre unifie avec filtres

**Parametres :**

```typescript
{
  company_id?: string,             // UUID (defaut: societe active)
  payment_instrument_id?: string,  // UUID — filtre par instrument
  flow_direction?: string,         // 'inflow' | 'outflow'
  transaction_kind?: string,       // 'income' | 'expense' | etc.
  status?: string,                 // 'posted' | 'reconciled' | 'draft' | 'pending' | 'cancelled'
  date_from?: string,              // Date ISO
  date_to?: string,                // Date ISO
  counterparty_name?: string,      // Recherche partielle (ILIKE)
  category?: string,
  source_module?: string,
  limit?: number,                  // Defaut: 50, max: 500
  offset?: number                  // Pagination
}
```

**Logique :**
```
1. SELECT * FROM payment_transactions WHERE user_id = auth.uid()
2. Appliquer les filtres en chaine
3. JOIN company_payment_instruments pour inclure le nom de l'instrument
4. ORDER BY transaction_date DESC, created_at DESC
5. LIMIT/OFFSET
```

**Retour :** { transactions: [...], total_count: number, has_more: boolean }

---

### Outil 7 : `create_payment_transfer`

**Description :** Transfert d'argent entre deux instruments de paiement (cree 2 transactions liees)

**Parametres :**

```typescript
{
  from_instrument_id: string,  // UUID — instrument source
  to_instrument_id: string,    // UUID — instrument destination
  amount: number,              // Montant > 0
  transfer_date: string,       // Date ISO
  fee_amount?: number,         // Frais de transfert (defaut: 0)
  currency?: string,           // ISO 4217
  reference?: string,
  notes?: string
}
```

**Logique :**
```
1. Verifier que from != to
2. Verifier que les 2 instruments appartiennent au meme user
3. Generer un transfer_group_id (UUID)
4. INSERT INTO payment_transactions: transaction outflow sur from_instrument
   - transaction_kind = 'transfer_out', flow_direction = 'outflow', is_internal_transfer = true
5. INSERT INTO payment_transactions: transaction inflow sur to_instrument
   - transaction_kind = 'transfer_in', flow_direction = 'inflow', is_internal_transfer = true
6. INSERT INTO payment_transfers avec les 2 transaction_ids
7. Si fee_amount > 0: creer une 3eme transaction 'fee' sur from_instrument
8. Les triggers de balance mettent a jour les 2 soldes automatiquement
```

**Retour :** { transfer: {...}, outflow_transaction: {...}, inflow_transaction: {...}, fee_transaction?: {...} }

---

### Outil 8 : `get_instrument_balance_history`

**Description :** Historique du solde d'un instrument (evolution quotidienne ou mensuelle)

**Parametres :**

```typescript
{
  instrument_id: string,   // UUID
  months?: number,         // Nombre de mois d'historique (defaut: 6)
  granularity?: string     // 'daily' | 'monthly' (defaut: 'monthly')
}
```

**Logique :**
```
- Si granularity = 'monthly': appeler rpc_account_cash_flow(instrument_id, months)
- Si granularity = 'daily': appeler rpc_account_balance_evolution(instrument_id, months * 30)
```

**Retour :** Array de { period, inflow, outflow, net, running_balance }

---

### Outil 9 : `get_payment_volume_stats`

**Description :** Statistiques de volume de paiements par methode/type d'instrument

**Parametres :**

```typescript
{
  company_id?: string,     // UUID (defaut: toutes les societes du user)
  start_date?: string,     // Date ISO (defaut: 12 mois en arriere)
  end_date?: string        // Date ISO (defaut: aujourd'hui)
}
```

**Logique :**
```
Appeler rpc_payment_volume_by_method(user_id, company_id, start_date, end_date)
```

**Retour :** Array de { month, instrument_type, instrument_subtype, transaction_count, total_inflow, total_outflow, net_flow }

---

### Outil 10 : `get_portfolio_consolidated_summary`

**Description :** Vue consolidee des soldes de tous les instruments de toutes les societes du portefeuille

**Parametres :**

```typescript
{
  portfolio_id?: string    // UUID (defaut: portefeuille par defaut du user)
}
```

**Logique :**
```
Appeler rpc_portfolio_consolidated_balances(user_id)
Si portfolio_id fourni: filtrer les resultats par portfolio_id
Agreger les soldes par devise de reference du portefeuille (avec conversion FX)
```

**Retour :**
```typescript
{
  portfolio_name: string,
  base_currency: string,
  total_balance_base_currency: number,
  companies: Array<{
    company_id: string,
    company_name: string,
    instruments: Array<{
      instrument_id: string,
      label: string,
      type: string,
      currency: string,
      balance_original: number,
      balance_base_currency: number
    }>
  }>
}
```

---

### Outils CRUD generes

**Ajouter dans `mcp-server/src/tools/generated_crud.ts` les tables suivantes (5 outils chacune : create, get, list, update, delete) :**

| Table | Outils generes |
|-------|---------------|
| `company_portfolios` | create_company_portfolios, get_company_portfolios, list_company_portfolios, update_company_portfolios, delete_company_portfolios |
| `company_portfolio_members` | create_company_portfolio_members, get_company_portfolio_members, list_company_portfolio_members, update_company_portfolio_members, delete_company_portfolio_members |
| `payment_instrument_bank_accounts` | create_payment_instrument_bank_accounts, get_payment_instrument_bank_accounts, list_payment_instrument_bank_accounts, update_payment_instrument_bank_accounts, delete_payment_instrument_bank_accounts |
| `payment_instrument_cards` | create_payment_instrument_cards, get_payment_instrument_cards, list_payment_instrument_cards, update_payment_instrument_cards, delete_payment_instrument_cards |
| `payment_instrument_cash_accounts` | create_payment_instrument_cash_accounts, get_payment_instrument_cash_accounts, list_payment_instrument_cash_accounts, update_payment_instrument_cash_accounts, delete_payment_instrument_cash_accounts |
| `payment_transaction_allocations` | create_payment_transaction_allocations, get_payment_transaction_allocations, list_payment_transaction_allocations, update_payment_transaction_allocations, delete_payment_transaction_allocations |
| `payment_alerts` | create_payment_alerts, get_payment_alerts, list_payment_alerts, update_payment_alerts, delete_payment_alerts |

**Total : 10 outils hand-written + 35 outils CRUD generes = 45 nouveaux outils MCP**

### Test Agent S3-C

```
- Chaque outil MCP repond sans erreur
- create_payment_instrument cree l'instrument + la table de detail appropriee
- create_payment_instrument genere automatiquement l'account_code (512001, 530001, etc.)
- create_payment_transaction genere une ecriture comptable dans accounting_entries
- create_payment_transaction met a jour le current_balance de l'instrument
- create_payment_transfer cree 2 transactions (inflow + outflow) liees par transfer_group_id
- create_payment_transfer avec fee_amount cree une 3eme transaction 'fee'
- list_payment_instruments filtre par type, company, status
- list_payment_transactions filtre par date, instrument, flow_direction
- get_instrument_balance_history retourne des donnees mensuelles ou quotidiennes
- get_payment_volume_stats retourne les volumes par type d'instrument
- get_portfolio_consolidated_summary retourne les soldes consolides multi-devises
- delete_payment_instrument refuse la suppression si des transactions existent (sauf force=true)
- Le serveur MCP demarre sans erreur : npm run build dans mcp-server/
```

---

## Agent S3-D : i18n

### Tache : Ajouter les cles de traduction

**Fichiers a modifier :**
- `src/i18n/locales/fr.json`
- `src/i18n/locales/en.json`

**Cles a ajouter :**

```json
{
  "financialInstruments": {
    "title": "Instruments financiers",
    "bankAccounts": "Comptes bancaires",
    "cards": "Cartes",
    "cashRegisters": "Caisses",
    "statistics": "Statistiques",
    "addBankAccount": "Ajouter un compte bancaire",
    "addCard": "Ajouter une carte",
    "addCashRegister": "Ajouter une caisse",
    "balance": "Solde",
    "accountCode": "Code comptable",
    "instrumentType": "Type d'instrument",
    "transfer": "Transfert",
    "transferBetween": "Transfert entre instruments",
    "from": "De",
    "to": "Vers",
    "bankName": "Nom de la banque",
    "iban": "IBAN",
    "bic": "BIC/SWIFT",
    "cardNumber": "Numero de carte",
    "cardType": "Type de carte",
    "creditCard": "Carte de credit",
    "debitCard": "Carte de debit",
    "prepaidCard": "Carte prepayee",
    "virtualCard": "Carte virtuelle",
    "cardholder": "Titulaire",
    "expiryDate": "Date d'expiration",
    "creditLimit": "Plafond de credit",
    "cashPointName": "Nom de la caisse",
    "custodian": "Responsable",
    "location": "Emplacement",
    "maxBalance": "Solde maximum autorise",
    "noInstruments": "Aucun instrument financier configure",
    "createFirst": "Creez votre premier instrument de paiement"
  },
  "paymentTransactions": {
    "title": "Transactions",
    "income": "Encaissement",
    "expense": "Decaissement",
    "transfer": "Transfert",
    "refund": "Remboursement",
    "inflow": "Entree",
    "outflow": "Sortie",
    "posted": "Comptabilise",
    "reconciled": "Rapproche",
    "draft": "Brouillon",
    "pending": "En attente",
    "cancelled": "Annule",
    "counterparty": "Contrepartie",
    "amount": "Montant",
    "date": "Date",
    "reference": "Reference"
  },
  "portfolios": {
    "title": "Portefeuilles",
    "createPortfolio": "Creer un portefeuille",
    "defaultPortfolio": "Portefeuille principal",
    "consolidatedView": "Vue consolidee",
    "baseCurrency": "Devise de reference",
    "totalBalance": "Solde total",
    "companiesCount": "Nombre de societes"
  }
}
```

### Test Agent S3-D

```
- Les fichiers fr.json et en.json sont valides (JSON parse OK)
- Les cles sont utilisees dans les composants frontend
- Pas de cle manquante a l'affichage
```

---

# 6. Sprint 4 — Stats, Exports, Alertes

## Agent S4-A : Charts et visualisations

### Tache : Implementer les graphiques recharts dans l'onglet Statistiques

**Composants concernes :**
- `InstrumentBalanceChart.jsx` — AreaChart : evolution du solde sur 90 jours (donnees de rpc_account_balance_evolution)
- `PaymentVolumeChart.jsx` — BarChart empile : volume mensuel par type d'instrument (donnees de rpc_payment_volume_by_method)
- `InstrumentCashFlowChart.jsx` — ComposedChart : barres inflow/outflow + ligne running_balance (donnees de rpc_account_cash_flow)

**Pattern recharts existant (depuis Dashboard.jsx) :**

```jsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={data}>
    <defs>
      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <XAxis dataKey="day" stroke="#6b7280" />
    <YAxis stroke="#6b7280" />
    <Tooltip />
    <Area type="monotone" dataKey="closing_balance" stroke="#F59E0B" fill="url(#colorBalance)" />
  </AreaChart>
</ResponsiveContainer>
```

### Test Agent S4-A

```
- Les 3 charts s'affichent dans l'onglet Statistiques
- Les donnees proviennent des RPCs (pas de calcul frontend)
- Les charts sont responsives
- Les gradients utilisent la couleur accent (#F59E0B)
- Les tooltips affichent les montants formates (formatCurrency de src/utils/calculations.js)
```

---

## Agent S4-B : Exports PDF et HTML

### Tache : Creer les services d'export

**Fichiers a creer :**

| Fichier | Pattern | Description |
|---------|---------|-------------|
| `src/services/exportPaymentInstrumentsPDF.js` | `src/services/exportReports.js` | Resume instruments + soldes en PDF |
| `src/services/exportPaymentTransactionsPDF.js` | `src/services/exportListsPDF.js` | Liste transactions filtrees en PDF |
| `src/services/exportPaymentStatsHTML.js` | `src/services/exportHTML.js` | Rapport stats interactif en HTML |

**Librairies a utiliser (deja installees) :**
- `jsPDF` pour la generation PDF
- `html2canvas` pour capturer les charts (scale 2, CORS)
- `DOMPurify` pour sanitizer le HTML

**Format PDF (A4 portrait, 10mm margins) :**
- En-tete : logo CashPilot + nom societe + date
- Section 1 : Liste des instruments avec soldes
- Section 2 : Graphique de volume par methode (capture html2canvas)
- Section 3 : Tableau des dernieres transactions
- Pied de page : numero de page

### Test Agent S4-B

```
- Export PDF genere un fichier valide
- Export HTML genere un fichier avec les stats
- Les charts sont correctement captures dans le PDF
- Les montants sont formates correctement
- Le PDF contient l'en-tete avec le nom de la societe
```

---

## Agent S4-C : Systeme d'alertes

### Tache : Implementer le trigger d'alertes et le composant frontend

**Trigger DB :**

```sql
CREATE OR REPLACE FUNCTION public.check_payment_alerts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_instrument RECORD;
BEGIN
  -- Charger l'instrument
  SELECT * INTO v_instrument
  FROM public.company_payment_instruments
  WHERE id = NEW.payment_instrument_id;

  -- Alerte solde negatif
  IF v_instrument.current_balance < 0 THEN
    INSERT INTO public.payment_alerts (
      user_id, company_id, payment_instrument_id,
      alert_type, severity, title, message
    ) VALUES (
      v_instrument.user_id, v_instrument.company_id, v_instrument.id,
      'negative_balance', 'critical',
      'Solde negatif sur ' || v_instrument.label,
      'Le solde de ' || v_instrument.label || ' est de ' || v_instrument.current_balance || ' ' || v_instrument.currency
    )
    ON CONFLICT DO NOTHING;
  END IF;

  -- Alerte plafond carte atteint
  IF v_instrument.instrument_type = 'card' THEN
    DECLARE
      v_card RECORD;
    BEGIN
      SELECT * INTO v_card
      FROM public.payment_instrument_cards
      WHERE instrument_id = v_instrument.id;

      IF v_card.credit_limit IS NOT NULL AND v_card.available_credit IS NOT NULL
         AND v_card.available_credit < (v_card.credit_limit * 0.1) THEN
        INSERT INTO public.payment_alerts (
          user_id, company_id, payment_instrument_id,
          alert_type, severity, title, message
        ) VALUES (
          v_instrument.user_id, v_instrument.company_id, v_instrument.id,
          'credit_limit_reached', 'warning',
          'Plafond carte bientot atteint',
          'Il reste ' || v_card.available_credit || ' ' || v_instrument.currency || ' de credit disponible'
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Declencher apres mise a jour du solde
DROP TRIGGER IF EXISTS trg_check_alerts_on_balance ON public.company_payment_instruments;
CREATE TRIGGER trg_check_alerts_on_balance
  AFTER UPDATE OF current_balance ON public.company_payment_instruments
  FOR EACH ROW EXECUTE FUNCTION public.check_payment_alerts();
```

**Composant frontend :**
- `src/components/financial-instruments/PaymentAlertsBanner.jsx`
- Affiche les alertes non resolues en haut de la page
- Badges de severite : info (bleu), warning (orange), critical (rouge)
- Bouton "Marquer comme resolu"

### Test Agent S4-C

```
- Quand un instrument a un solde negatif, une alerte 'negative_balance' est creee
- Les alertes s'affichent dans le banner
- Le bouton "Resolu" met a jour is_resolved et resolved_at
- Pas de doublons d'alertes
```

---

# 7. Migration des donnees existantes

## Agent BACKFILL : Migration des donnees

### Tache : Migrer les donnees existantes vers le nouveau schema

**IMPORTANT : Cet agent s'execute APRES les Sprints 1 et 2**

```sql
-- =========================================================
-- 1. CREER UN PORTEFEUILLE PAR DEFAUT PAR USER
-- =========================================================

INSERT INTO public.company_portfolios (user_id, portfolio_name, description, base_currency, is_default, is_active)
SELECT DISTINCT
  c.user_id,
  'Portfolio principal',
  'Portefeuille genere automatiquement',
  COALESCE(c.currency, 'EUR'),
  true, true
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_portfolios p
  WHERE p.user_id = c.user_id AND p.is_default = true
);

-- =========================================================
-- 2. ATTACHER CHAQUE SOCIETE A SON PORTEFEUILLE
-- =========================================================

UPDATE public.company c
SET portfolio_id = p.id
FROM public.company_portfolios p
WHERE p.user_id = c.user_id AND p.is_default = true AND c.portfolio_id IS NULL;

-- =========================================================
-- 3. ALIMENTER company_portfolio_members
-- =========================================================

INSERT INTO public.company_portfolio_members (portfolio_id, company_id, user_id)
SELECT c.portfolio_id, c.id, c.user_id
FROM public.company c
WHERE c.portfolio_id IS NOT NULL
ON CONFLICT (portfolio_id, company_id) DO NOTHING;

-- =========================================================
-- 4. CREER UN INSTRUMENT BANCAIRE PAR DEFAUT PAR SOCIETE
-- =========================================================

INSERT INTO public.company_payment_instruments (
  user_id, company_id, portfolio_id,
  instrument_type, instrument_subtype,
  code, label, display_name, currency,
  status, is_default, opening_balance, current_balance,
  account_code, journal_code, metadata
)
SELECT
  c.user_id, c.id, c.portfolio_id,
  'bank_account', 'checking',
  'BANK-MAIN-' || SUBSTR(c.id::text, 1, 8),
  COALESCE(c.bank_name, 'Compte bancaire principal'),
  COALESCE(c.bank_name, 'Compte bancaire principal'),
  COALESCE(c.currency, 'EUR'),
  'active', true, 0, 0,
  public.generate_instrument_account_code(c.id, 'bank_account'),
  'BQ',
  jsonb_build_object('source', 'migration', 'legacy_iban', c.iban)
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_payment_instruments pi
  WHERE pi.company_id = c.id AND pi.instrument_type = 'bank_account' AND pi.is_default = true
);

-- =========================================================
-- 5. CREER UN INSTRUMENT CASH PAR DEFAUT PAR SOCIETE
-- =========================================================

INSERT INTO public.company_payment_instruments (
  user_id, company_id, portfolio_id,
  instrument_type, instrument_subtype,
  code, label, display_name, currency,
  status, is_default, opening_balance, current_balance,
  account_code, journal_code
)
SELECT
  c.user_id, c.id, c.portfolio_id,
  'cash', 'cash_register',
  'CASH-MAIN-' || SUBSTR(c.id::text, 1, 8),
  'Caisse principale',
  'Caisse principale',
  COALESCE(c.currency, 'EUR'),
  'active', true, 0, 0,
  public.generate_instrument_account_code(c.id, 'cash'),
  'CA'
FROM public.company c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_payment_instruments pi
  WHERE pi.company_id = c.id AND pi.instrument_type = 'cash' AND pi.is_default = true
);

-- =========================================================
-- 6. LIER bank_connections AUX INSTRUMENTS
-- =========================================================

UPDATE public.bank_connections bc
SET payment_instrument_id = pi.id
FROM public.company_payment_instruments pi
WHERE pi.company_id = bc.company_id
  AND pi.instrument_type = 'bank_account'
  AND pi.is_default = true
  AND bc.payment_instrument_id IS NULL;
```

### Test Agent BACKFILL

```sql
-- Verifier qu'un portefeuille existe par user
SELECT user_id, COUNT(*) FROM public.company_portfolios GROUP BY user_id;
-- Attendu : 1 par user

-- Verifier que chaque societe a un instrument bancaire et cash
SELECT c.id, c.company_name,
  (SELECT COUNT(*) FROM public.company_payment_instruments pi WHERE pi.company_id = c.id AND pi.instrument_type = 'bank_account') AS bank_count,
  (SELECT COUNT(*) FROM public.company_payment_instruments pi WHERE pi.company_id = c.id AND pi.instrument_type = 'cash') AS cash_count
FROM public.company c;
-- Attendu : bank_count >= 1 et cash_count >= 1 pour chaque societe

-- Verifier les account_code
SELECT code, label, account_code, journal_code FROM public.company_payment_instruments ORDER BY company_id, instrument_type;
-- Attendu : account_code non null (512001, 530001, etc.)
```

---

# 8. Assignation des taches par agent

## Regle : 1 agent = 1 tache

| Agent | Sprint | Tache | Dependances |
|-------|--------|-------|-------------|
| **S1-A** | 1 | Tables portfolios + ALTER company + RLS | Aucune |
| **S1-B** | 1 | Table company_payment_instruments + triggers | S1-A (portfolio FK) |
| **S1-C** | 1 | Tables details (bank, card, cash) + RLS | S1-B (instrument FK) |
| **S1-D** | 1 | ALTER tables existantes | S1-B (instrument FK) |
| **S2-A** | 2 | Table payment_transactions + FK retro | S1-B, S1-D |
| **S2-B** | 2 | Tables allocations + transferts | S2-A (transaction FK) |
| **S2-C** | 2 | Triggers coherence + balance + generate_account_code | S2-A, S1-B |
| **S2-D** | 2 | Tables support (audit, alertes, rapprochement, exports) | S2-A, S1-B |
| **S2-E** | 2 | Vues analytiques + RPCs | S2-A, S1-B |
| **S3-A** | 3 | Hooks frontend (7 hooks) | Sprint 2 complet |
| **S3-B** | 3 | Page + composants frontend | S3-A |
| **S3-C** | 3 | MCP tools (10 hand-written + CRUD) | Sprint 2 complet |
| **S3-D** | 3 | i18n fr/en | S3-B |
| **S4-A** | 4 | Charts recharts | S3-A, S2-E |
| **S4-B** | 4 | Exports PDF/HTML | S3-A, S4-A |
| **S4-C** | 4 | Alertes (trigger + frontend) | S2-D, S3-B |
| **BACKFILL** | Post-S2 | Migration donnees existantes | Sprint 2 complet |
| **INTEGRATION** | Final | Verification croisee de tous les sprints | Tous |

## Agents parallelisables

- **Sprint 1** : S1-A seul d'abord, puis S1-B, puis S1-C et S1-D en parallele
- **Sprint 2** : S2-A d'abord, puis S2-B/S2-C/S2-D/S2-E en parallele
- **Sprint 3** : S3-A et S3-C en parallele, puis S3-B et S3-D en parallele
- **Sprint 4** : S4-A/S4-B/S4-C en parallele (apres Sprint 3)

---

# 9. Tests par agent

Chaque agent DOIT verifier :

1. **Test structurel** : Les tables/colonnes/indexes/triggers existent
2. **Test fonctionnel** : Les operations CRUD fonctionnent
3. **Test RLS** : Les donnees sont isolees par user_id
4. **Test integrite** : Les FK CASCADE/RESTRICT fonctionnent
5. **Test build** : `npm run build` reussit (pour les agents frontend)

**Critere de succes** : 100% des tests passent avant de marquer la tache comme terminee.

---

# 10. Verification end-to-end

L'agent **INTEGRATION** execute ces tests apres tous les sprints :

1. **Scenario complet** :
   - Creer un portefeuille
   - Creer une societe dans ce portefeuille
   - Creer un compte bancaire + une caisse + une carte
   - Enregistrer un paiement fournisseur via le compte bancaire
   - Enregistrer un encaissement client via la caisse
   - Verifier que les ecritures comptables sont generees
   - Verifier que les soldes sont mis a jour
   - Faire un transfert entre compte bancaire et caisse
   - Verifier les statistiques via les RPCs
   - Exporter un PDF de transactions
   - Verifier la consolidation portefeuille

2. **Test multi-company** :
   - Switcher de societe
   - Verifier que les instruments de l'autre societe ne sont pas visibles
   - Verifier l'isolation RLS

3. **Test regression** :
   - Les paiements existants (sans instrument) fonctionnent toujours
   - Les exports existants fonctionnent
   - Le dashboard existant fonctionne
   - Les outils MCP existants fonctionnent

---

# 11. Fichiers critiques de reference

| Fichier | Role |
|---------|------|
| `supabase/migrations/20260226150558_cashpilot_auto_accounting_engine_v2.sql` | Moteur auto-journaling existant — NE PAS CASSER |
| `supabase/migrations/20260308270000_config_tables_payment_methods_credits_journals.sql` | Table payment_methods existante — CONSERVER |
| `supabase/migrations/20260226160044_042_payment_method_split.sql` | Trigger auto_journal_payment() et get_payment_account_code() |
| `mcp-server/src/tools/payments.ts` | Pattern pour les nouveaux outils MCP |
| `mcp-server/src/tools/generated_crud.ts` | Generateur CRUD — ajouter les nouvelles tables |
| `src/hooks/usePayments.js` | Hook existant a modifier (ajouter instrument_id) |
| `src/hooks/useBankConnections.js` | Pattern a suivre pour usePaymentInstruments |
| `src/hooks/useActiveCompanyId.js` | Hook de scope company — a reutiliser |
| `src/services/exportReports.js` | Pattern d'export PDF existant |
| `src/services/exportHTML.js` | Pattern d'export HTML existant |
| `src/utils/calculations.js` | formatCurrency(), formatCompactCurrency() — a reutiliser |
| `src/utils/currencyService.js` | Conversion multi-devises — a reutiliser pour consolidation |
| `src/shared/canonicalDashboardSnapshot.js` | Snapshot dashboard — a enrichir |
| `src/i18n/locales/fr.json` | Traductions francaises |
| `src/i18n/locales/en.json` | Traductions anglaises |
| `src/pages/Dashboard.jsx` | Dashboard existant — ajouter widget instruments |
| `src/pages/PortfolioPage.jsx` | Page portefeuille existante — integrer vue consolidee |

---

# 12. Regles imperatives

1. **NE RIEN CASSER** : Les tables/hooks/pages existants doivent continuer a fonctionner
2. **Colonnes nullable** : Toutes les nouvelles FK sur les tables existantes sont NULLABLE (migration progressive)
3. **RLS sur tout** : Chaque nouvelle table a des policies RLS
4. **Frontend = afficheur** : Aucun calcul metier dans le frontend. Tout dans la DB (vues, RPCs, triggers)
5. **Zerodowntime** : Les migrations s'executent sans interruption de service
6. **1 agent = 1 tache** : Jamais regrouper plusieurs taches dans un seul agent
7. **Tests a 100%** : Un agent ne termine pas tant que ses tests ne passent pas
8. **Source de verite** : Ce document est la reference. En cas de perte de contexte, REVENIR ICI.
9. **Pas de hardcoded** : Aucune valeur hardcodee. Tout dans la DB ou la config.
10. **Design DNA** : Dark glassmorphism (#0a0e1a), accent orange (#F59E0B), Lucide icons, recharts, Framer Motion

---

> **Ce document est la source de verite pour l'implementation complete du systeme de gestion des modes de paiement CashPilot.**
> En cas de compaction de conversation, tout agent DOIT relire ce document pour reprendre sa tache.
