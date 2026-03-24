BEGIN;
ALTER TABLE public.material_assets
  ADD COLUMN IF NOT EXISTS acquisition_mode TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id UUID,
  ADD COLUMN IF NOT EXISTS contract_reference TEXT,
  ADD COLUMN IF NOT EXISTS contract_start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_end_date DATE,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS rental_rate NUMERIC(14,4),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
UPDATE public.material_assets
SET acquisition_mode = 'purchase'
WHERE acquisition_mode IS NULL;
ALTER TABLE public.material_assets
  ALTER COLUMN acquisition_mode SET DEFAULT 'purchase',
  ALTER COLUMN acquisition_mode SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_material_assets_acquisition_mode'
      AND conrelid = 'public.material_assets'::regclass
  ) THEN
    ALTER TABLE public.material_assets
      ADD CONSTRAINT ck_material_assets_acquisition_mode
      CHECK (acquisition_mode IN ('purchase', 'rental', 'service'));
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_material_assets_supplier'
      AND conrelid = 'public.material_assets'::regclass
  ) THEN
    ALTER TABLE public.material_assets
      ADD CONSTRAINT fk_material_assets_supplier
      FOREIGN KEY (supplier_id)
      REFERENCES public.suppliers(id)
      ON DELETE SET NULL;
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_material_assets_contract_dates'
      AND conrelid = 'public.material_assets'::regclass
  ) THEN
    ALTER TABLE public.material_assets
      ADD CONSTRAINT ck_material_assets_contract_dates
      CHECK (
        contract_end_date IS NULL
        OR contract_start_date IS NULL
        OR contract_end_date >= contract_start_date
      );
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_material_assets_purchase_cost_positive'
      AND conrelid = 'public.material_assets'::regclass
  ) THEN
    ALTER TABLE public.material_assets
      ADD CONSTRAINT ck_material_assets_purchase_cost_positive
      CHECK (purchase_cost IS NULL OR purchase_cost >= 0);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_material_assets_rental_rate_positive'
      AND conrelid = 'public.material_assets'::regclass
  ) THEN
    ALTER TABLE public.material_assets
      ADD CONSTRAINT ck_material_assets_rental_rate_positive
      CHECK (rental_rate IS NULL OR rental_rate >= 0);
  END IF;
END $$;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_material_assets_billing_cycle'
      AND conrelid = 'public.material_assets'::regclass
  ) THEN
    ALTER TABLE public.material_assets
      ADD CONSTRAINT ck_material_assets_billing_cycle
      CHECK (
        billing_cycle IS NULL
        OR billing_cycle IN ('hourly', 'daily', 'weekly', 'monthly', 'yearly')
      );
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_material_assets_supplier_id
  ON public.material_assets(supplier_id);
CREATE INDEX IF NOT EXISTS idx_material_assets_acquisition_mode
  ON public.material_assets(acquisition_mode);
COMMIT;
