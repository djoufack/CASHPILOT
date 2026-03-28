-- ============================================================================
-- CAT-02: Multi-entrepots + lot/serie
-- - Adds warehouse master table (company-scoped)
-- - Adds lot/serial registry linked to products + warehouses
-- - Enforces company ownership via RLS (auth.uid() -> company.user_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  warehouse_code TEXT NOT NULL,
  warehouse_name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_warehouses_company_code
  ON public.inventory_warehouses(company_id, warehouse_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_warehouses_company_default
  ON public.inventory_warehouses(company_id)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_company_id
  ON public.inventory_warehouses(company_id);

CREATE INDEX IF NOT EXISTS idx_inventory_warehouses_user_company
  ON public.inventory_warehouses(user_id, company_id);

CREATE TABLE IF NOT EXISTS public.inventory_lot_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.inventory_warehouses(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  serial_number TEXT,
  quantity NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  received_at DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'reserved', 'consumed', 'expired')),
  notes TEXT,
  source_type TEXT,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_lot_registry_company_id
  ON public.inventory_lot_registry(company_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lot_registry_product_company
  ON public.inventory_lot_registry(product_id, company_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lot_registry_warehouse_company
  ON public.inventory_lot_registry(warehouse_id, company_id);

CREATE INDEX IF NOT EXISTS idx_inventory_lot_registry_lot_company
  ON public.inventory_lot_registry(lot_number, company_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_lot_registry_serial_company
  ON public.inventory_lot_registry(company_id, serial_number)
  WHERE serial_number IS NOT NULL AND serial_number <> '';

DROP TRIGGER IF EXISTS update_inventory_warehouses_modtime ON public.inventory_warehouses;
CREATE TRIGGER update_inventory_warehouses_modtime
  BEFORE UPDATE ON public.inventory_warehouses
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_lot_registry_modtime ON public.inventory_lot_registry;
CREATE TRIGGER update_inventory_lot_registry_modtime
  BEFORE UPDATE ON public.inventory_lot_registry
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.inventory_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_lot_registry ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_warehouses'
      AND policyname = 'inventory_warehouses_select_company_owner'
  ) THEN
    CREATE POLICY inventory_warehouses_select_company_owner
      ON public.inventory_warehouses
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_warehouses.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_warehouses'
      AND policyname = 'inventory_warehouses_insert_company_owner'
  ) THEN
    CREATE POLICY inventory_warehouses_insert_company_owner
      ON public.inventory_warehouses
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_warehouses.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_warehouses'
      AND policyname = 'inventory_warehouses_update_company_owner'
  ) THEN
    CREATE POLICY inventory_warehouses_update_company_owner
      ON public.inventory_warehouses
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_warehouses.company_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_warehouses.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_warehouses'
      AND policyname = 'inventory_warehouses_delete_company_owner'
  ) THEN
    CREATE POLICY inventory_warehouses_delete_company_owner
      ON public.inventory_warehouses
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_warehouses.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_lot_registry'
      AND policyname = 'inventory_lot_registry_select_company_owner'
  ) THEN
    CREATE POLICY inventory_lot_registry_select_company_owner
      ON public.inventory_lot_registry
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_lot_registry.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_lot_registry'
      AND policyname = 'inventory_lot_registry_insert_company_owner'
  ) THEN
    CREATE POLICY inventory_lot_registry_insert_company_owner
      ON public.inventory_lot_registry
      FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_lot_registry.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_lot_registry'
      AND policyname = 'inventory_lot_registry_update_company_owner'
  ) THEN
    CREATE POLICY inventory_lot_registry_update_company_owner
      ON public.inventory_lot_registry
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_lot_registry.company_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_lot_registry.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inventory_lot_registry'
      AND policyname = 'inventory_lot_registry_delete_company_owner'
  ) THEN
    CREATE POLICY inventory_lot_registry_delete_company_owner
      ON public.inventory_lot_registry
      FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.company c
          WHERE c.id = inventory_lot_registry.company_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Seed default warehouse for each company if missing.
INSERT INTO public.inventory_warehouses (
  user_id,
  company_id,
  warehouse_code,
  warehouse_name,
  description,
  is_default,
  is_active
)
SELECT
  c.user_id,
  c.id,
  'MAIN',
  CASE
    WHEN c.country = 'FR' THEN 'Entrepot principal'
    WHEN c.country = 'BE' THEN 'Magazijn hoofdlocatie'
    ELSE 'Main warehouse'
  END,
  'Entrepot par defaut initialise automatiquement pour la societe.',
  TRUE,
  TRUE
FROM public.company c
WHERE c.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.inventory_warehouses w
    WHERE w.company_id = c.id
  );
