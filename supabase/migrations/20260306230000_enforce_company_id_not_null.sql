-- =====================================================================
-- Enforce NOT NULL on company_id for all core business tables
-- Prerequisite: resolve_preferred_company_id(uuid) must exist
-- Date: 2026-03-06
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. clients
-- =====================================================================
UPDATE public.clients
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.clients
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 2. projects
-- =====================================================================
UPDATE public.projects
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 3. invoices
-- =====================================================================
UPDATE public.invoices
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.invoices
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 4. quotes
-- =====================================================================
UPDATE public.quotes
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.quotes
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 5. expenses
-- =====================================================================
UPDATE public.expenses
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.expenses
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 6. timesheets
-- =====================================================================
UPDATE public.timesheets
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.timesheets
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 7. payments
-- =====================================================================
UPDATE public.payments
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.payments
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 8. suppliers
-- =====================================================================
UPDATE public.suppliers
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.suppliers
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 9. supplier_invoices
-- =====================================================================
UPDATE public.supplier_invoices
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.supplier_invoices
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 10. supplier_orders
-- =====================================================================
UPDATE public.supplier_orders
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.supplier_orders
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 11. recurring_invoices
-- =====================================================================
UPDATE public.recurring_invoices
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.recurring_invoices
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 12. credit_notes
-- =====================================================================
UPDATE public.credit_notes
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.credit_notes
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 13. delivery_notes
-- =====================================================================
UPDATE public.delivery_notes
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.delivery_notes
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 14. bank_connections
-- =====================================================================
UPDATE public.bank_connections
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.bank_connections
  ALTER COLUMN company_id SET NOT NULL;

-- =====================================================================
-- 15. accounting_fixed_assets (fixed_assets)
-- =====================================================================
UPDATE public.accounting_fixed_assets
SET company_id = public.resolve_preferred_company_id(user_id)
WHERE company_id IS NULL;

ALTER TABLE public.accounting_fixed_assets
  ALTER COLUMN company_id SET NOT NULL;

COMMIT;
