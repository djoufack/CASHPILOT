-- ============================================================================
-- Migration: Config tables for sector benchmarks, tax brackets, tax rate presets
-- Sprint C - Audit corrections
-- ============================================================================

-- ============================================================================
-- Table 1: sector_benchmarks — Reference data for financial diagnostics
-- ============================================================================
CREATE TABLE IF NOT EXISTS sector_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_code TEXT NOT NULL,
  sector_name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT 'FR',
  gross_margin_percent NUMERIC NOT NULL,
  ebitda_margin NUMERIC NOT NULL,
  net_margin NUMERIC,
  bfr_typical NUMERIC,
  caf_typical NUMERIC,
  debt_ratio_max NUMERIC,
  current_ratio_min NUMERIC,
  dso_days INTEGER,
  dpo_days INTEGER,
  inventory_days INTEGER,
  source TEXT,
  year INTEGER DEFAULT 2026,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(sector_code, region, year)
);

-- No RLS needed (reference data)

-- Seed: FR benchmarks (from FinancialDiagnostic.jsx lines 69-121)
INSERT INTO sector_benchmarks (sector_code, sector_name, region, gross_margin_percent, ebitda_margin, net_margin, bfr_typical, caf_typical, debt_ratio_max, current_ratio_min, dso_days, dpo_days, inventory_days, source, year)
VALUES
  ('services', 'Services', 'FR', 42, 14, 8, 25000, 50000, 1.1, 1.4, 45, 30, NULL, 'INSEE/BPI France 2024', 2026),
  ('commerce', 'Commerce', 'FR', 30, 9, 4, 35000, 42000, 1.5, 1.2, 40, 45, 30, 'INSEE/BPI France 2024', 2026),
  ('industrie', 'Industrie', 'FR', 36, 13, 6, 50000, 72000, 1.8, 1.5, 55, 50, 45, 'INSEE/BPI France 2024', 2026)
ON CONFLICT DO NOTHING;

-- Seed: BE benchmarks (Belgian variants)
INSERT INTO sector_benchmarks (sector_code, sector_name, region, gross_margin_percent, ebitda_margin, net_margin, bfr_typical, caf_typical, debt_ratio_max, current_ratio_min, dso_days, dpo_days, inventory_days, source, year)
VALUES
  ('services', 'Services', 'BE', 40, 13, 7, 22000, 46000, 1.2, 1.3, 50, 35, NULL, 'BNB/SPF Économie 2024', 2026),
  ('commerce', 'Commerce', 'BE', 28, 8, 3.5, 32000, 39000, 1.6, 1.1, 45, 50, 32, 'BNB/SPF Économie 2024', 2026),
  ('industrie', 'Industrie', 'BE', 34, 12, 5.5, 48000, 68000, 1.9, 1.4, 58, 52, 48, 'BNB/SPF Économie 2024', 2026)
ON CONFLICT DO NOTHING;

-- Seed: OHADA benchmarks (OHADA zone variants)
INSERT INTO sector_benchmarks (sector_code, sector_name, region, gross_margin_percent, ebitda_margin, net_margin, bfr_typical, caf_typical, debt_ratio_max, current_ratio_min, dso_days, dpo_days, inventory_days, source, year)
VALUES
  ('services', 'Services', 'OHADA', 45, 16, 10, 18000, 40000, 1.0, 1.5, 60, 40, NULL, 'BCEAO/SYSCOHADA 2024', 2026),
  ('commerce', 'Commerce', 'OHADA', 32, 10, 5, 28000, 35000, 1.4, 1.2, 55, 55, 35, 'BCEAO/SYSCOHADA 2024', 2026),
  ('industrie', 'Industrie', 'OHADA', 38, 14, 7, 42000, 60000, 1.7, 1.3, 65, 60, 50, 'BCEAO/SYSCOHADA 2024', 2026)
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Table 2: tax_brackets — Corporate income tax brackets by country
-- ============================================================================
CREATE TABLE IF NOT EXISTS tax_brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'corporate_income',
  bracket_min NUMERIC NOT NULL,
  bracket_max NUMERIC,  -- NULL = infinity
  rate NUMERIC NOT NULL,
  label TEXT NOT NULL,
  effective_year INTEGER NOT NULL DEFAULT 2026,
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, tax_type, bracket_min, effective_year)
);

-- No RLS needed (reference data)

-- Seed: FR corporate tax brackets (from accountingCalculations.js lines 34-37)
INSERT INTO tax_brackets (country_code, tax_type, bracket_min, bracket_max, rate, label, effective_year, source)
VALUES
  ('FR', 'corporate_income', 0, 42500, 0.15, 'Taux réduit PME', 2026, 'CGI Art. 219-I-b'),
  ('FR', 'corporate_income', 42500, NULL, 0.25, 'Taux normal', 2026, 'CGI Art. 219-I')
ON CONFLICT DO NOTHING;

-- Seed: BE corporate tax brackets
INSERT INTO tax_brackets (country_code, tax_type, bracket_min, bracket_max, rate, label, effective_year, source)
VALUES
  ('BE', 'corporate_income', 0, 100000, 0.20, 'Taux réduit PME', 2026, 'CIR Art. 215'),
  ('BE', 'corporate_income', 100000, NULL, 0.25, 'Taux normal', 2026, 'CIR Art. 215')
ON CONFLICT DO NOTHING;

-- Seed: OHADA corporate tax (flat rate)
INSERT INTO tax_brackets (country_code, tax_type, bracket_min, bracket_max, rate, label, effective_year, source)
VALUES
  ('OHADA', 'corporate_income', 0, NULL, 0.30, 'Taux unique IS', 2026, 'Code Général des Impôts OHADA')
ON CONFLICT DO NOTHING;


-- ============================================================================
-- Table 3: tax_rate_presets — VAT rate presets by country
-- ============================================================================
CREATE TABLE IF NOT EXISTS tax_rate_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  preset_name TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  account_code TEXT NOT NULL,
  tax_type TEXT NOT NULL DEFAULT 'VAT',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country_code, rate, account_code)
);

-- No RLS needed (reference data)

-- Seed: FR VAT presets (from TaxRatesManager.jsx lines 14-21)
INSERT INTO tax_rate_presets (country_code, preset_name, rate, account_code, tax_type, sort_order)
VALUES
  ('FR', 'TVA 20% (normal)', 0.20, '445710', 'VAT', 1),
  ('FR', 'TVA 10% (intermédiaire)', 0.10, '445711', 'VAT', 2),
  ('FR', 'TVA 5.5% (réduit)', 0.055, '445712', 'VAT', 3),
  ('FR', 'TVA 2.1% (super-réduit)', 0.021, '445713', 'VAT', 4),
  ('FR', 'TVA déductible 20%', 0.20, '445660', 'VAT', 5),
  ('FR', 'TVA déductible 10%', 0.10, '445660', 'VAT', 6)
ON CONFLICT DO NOTHING;

-- Seed: BE VAT presets (from TaxRatesManager.jsx lines 22-30)
INSERT INTO tax_rate_presets (country_code, preset_name, rate, account_code, tax_type, sort_order)
VALUES
  ('BE', 'TVA 21% collectée (normal)', 0.21, '4513', 'VAT', 1),
  ('BE', 'TVA 12% collectée (intermédiaire)', 0.12, '45131', 'VAT', 2),
  ('BE', 'TVA 6% collectée (réduit)', 0.06, '45132', 'VAT', 3),
  ('BE', 'TVA 0% (exonéré)', 0.00, '45133', 'VAT', 4),
  ('BE', 'TVA 21% déductible (achats)', 0.21, '4111', 'VAT', 5),
  ('BE', 'TVA 12% déductible (achats)', 0.12, '4111', 'VAT', 6),
  ('BE', 'TVA 6% déductible (achats)', 0.06, '4111', 'VAT', 7)
ON CONFLICT DO NOTHING;

-- Seed: OHADA VAT presets
INSERT INTO tax_rate_presets (country_code, preset_name, rate, account_code, tax_type, sort_order)
VALUES
  ('OHADA', 'TVA 18% collectée', 0.18, '4431', 'VAT', 1),
  ('OHADA', 'TVA 9.5% (réduit)', 0.095, '44311', 'VAT', 2),
  ('OHADA', 'TVA 0% (exonéré)', 0.00, '44312', 'VAT', 3)
ON CONFLICT DO NOTHING;
