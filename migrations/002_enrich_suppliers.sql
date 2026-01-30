-- ============================================================
-- CASHPILOT - Migration: Enrich Suppliers Table
-- Date: 2026-01-30
-- Description: Ajout des champs adresse, bancaire, fiscal,
--              conditions de paiement et notes aux fournisseurs
-- ============================================================

-- ============================================================
-- 1. CHAMPS ADRESSE
-- ============================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS country TEXT;

-- ============================================================
-- 2. CHAMPS COMMERCIAUX
-- ============================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tax_id TEXT;          -- N° TVA / SIRET
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';

-- ============================================================
-- 3. CHAMPS BANCAIRES
-- ============================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS bic_swift TEXT;

-- ============================================================
-- 4. NOTES
-- ============================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;

-- ============================================================
-- 5. TIMESTAMP DE MISE À JOUR
-- ============================================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Trigger pour mettre à jour updated_at automatiquement
DROP TRIGGER IF EXISTS update_suppliers_modtime ON public.suppliers;
CREATE TRIGGER update_suppliers_modtime
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
