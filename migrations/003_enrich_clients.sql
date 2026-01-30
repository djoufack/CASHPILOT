-- ============================================================
-- CASHPILOT - Migration: Enrich Clients Table
-- Date: 2026-01-30
-- Description: Ajout des champs adresse détaillée, téléphone,
--              site web, bancaire, conditions de paiement et notes
-- ============================================================

-- ============================================================
-- 1. CHAMPS CONTACT
-- ============================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS website TEXT;

-- ============================================================
-- 2. CHAMPS ADRESSE DÉTAILLÉE
-- ============================================================
-- Note: 'address' existe déjà dans le schéma original
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS country TEXT;

-- ============================================================
-- 3. CHAMPS COMMERCIAUX
-- ============================================================
-- Note: 'vat_number' existe déjà, 'preferred_currency' existe déjà
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tax_id TEXT;          -- SIRET / Company Registration

-- ============================================================
-- 4. CHAMPS BANCAIRES
-- ============================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS bic_swift TEXT;

-- ============================================================
-- 5. NOTES
-- ============================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- 6. TIMESTAMP DE MISE À JOUR
-- ============================================================
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Trigger pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS update_clients_modtime ON public.clients;
CREATE TRIGGER update_clients_modtime
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
