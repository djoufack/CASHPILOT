-- =====================================================================
-- Scope inventory and supplier domain by company
-- Date: 2026-03-03
-- =====================================================================

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.product_stock_history
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.stock_alerts
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_product_categories
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_products
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_services
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_orders
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_locations
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.supplier_reports_cache
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_product_categories_company_id
  ON public.product_categories(company_id);

CREATE INDEX IF NOT EXISTS idx_product_categories_user_company
  ON public.product_categories(user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_products_company_id
  ON public.products(company_id);

CREATE INDEX IF NOT EXISTS idx_products_user_company
  ON public.products(user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_history_company_id
  ON public.product_stock_history(company_id);

CREATE INDEX IF NOT EXISTS idx_product_stock_history_product_company
  ON public.product_stock_history(product_id, company_id);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_company_id
  ON public.stock_alerts(company_id);

CREATE INDEX IF NOT EXISTS idx_stock_alerts_product_company
  ON public.stock_alerts(product_id, company_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_company_id
  ON public.suppliers(company_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_company
  ON public.suppliers(user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_product_categories_company_id
  ON public.supplier_product_categories(company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_product_categories_user_company
  ON public.supplier_product_categories(user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_company_id
  ON public.supplier_products(company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_company
  ON public.supplier_products(supplier_id, company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_services_company_id
  ON public.supplier_services(company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_services_supplier_company
  ON public.supplier_services(supplier_id, company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_company_id
  ON public.supplier_orders(company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_orders_user_company
  ON public.supplier_orders(user_id, company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_company_id
  ON public.supplier_invoices(company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_company
  ON public.supplier_invoices(supplier_id, company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_locations_company_id
  ON public.supplier_locations(company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_reports_cache_company_id
  ON public.supplier_reports_cache(company_id);

CREATE OR REPLACE FUNCTION public.resolve_inventory_company_id_from_supplier(p_supplier_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT s.company_id
  FROM public.suppliers s
  WHERE s.id = p_supplier_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.resolve_inventory_company_id_from_product(p_product_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT p.company_id
  FROM public.products p
  WHERE p.id = p_product_id
  LIMIT 1;
$$;

UPDATE public.product_categories pc
SET company_id = public.resolve_preferred_company_id(pc.user_id)
WHERE pc.company_id IS NULL;

UPDATE public.suppliers s
SET company_id = public.resolve_preferred_company_id(s.user_id)
WHERE s.company_id IS NULL;

UPDATE public.supplier_product_categories spc
SET company_id = public.resolve_preferred_company_id(spc.user_id)
WHERE spc.company_id IS NULL;

UPDATE public.products p
SET company_id = COALESCE(
  public.resolve_inventory_company_id_from_supplier(p.supplier_id),
  (
    SELECT pc.company_id
    FROM public.product_categories pc
    WHERE pc.id = p.category_id
  ),
  public.resolve_preferred_company_id(p.user_id)
)
WHERE p.company_id IS NULL;

UPDATE public.product_stock_history psh
SET company_id = COALESCE(
  public.resolve_inventory_company_id_from_product(COALESCE(psh.product_id, psh.user_product_id)),
  (
    SELECT s.company_id
    FROM public.supplier_orders so
    JOIN public.suppliers s ON s.id = so.supplier_id
    WHERE so.id = psh.order_id
    LIMIT 1
  )
)
WHERE psh.company_id IS NULL;

UPDATE public.stock_alerts sa
SET company_id = public.resolve_inventory_company_id_from_product(COALESCE(sa.product_id, sa.user_product_id))
WHERE sa.company_id IS NULL;

UPDATE public.supplier_products sp
SET company_id = COALESCE(
  public.resolve_inventory_company_id_from_supplier(sp.supplier_id),
  (
    SELECT spc.company_id
    FROM public.supplier_product_categories spc
    WHERE spc.id = sp.category_id
  )
)
WHERE sp.company_id IS NULL;

UPDATE public.supplier_services ss
SET company_id = public.resolve_inventory_company_id_from_supplier(ss.supplier_id)
WHERE ss.company_id IS NULL;

UPDATE public.supplier_orders so
SET company_id = COALESCE(
  public.resolve_inventory_company_id_from_supplier(so.supplier_id),
  public.resolve_preferred_company_id(so.user_id)
)
WHERE so.company_id IS NULL;

UPDATE public.supplier_invoices si
SET company_id = public.resolve_inventory_company_id_from_supplier(si.supplier_id)
WHERE si.company_id IS NULL;

UPDATE public.supplier_locations sl
SET company_id = public.resolve_inventory_company_id_from_supplier(sl.supplier_id)
WHERE sl.company_id IS NULL;

UPDATE public.supplier_reports_cache src
SET company_id = COALESCE(
  public.resolve_inventory_company_id_from_supplier(src.supplier_id),
  public.resolve_preferred_company_id(src.user_id)
)
WHERE src.company_id IS NULL;

CREATE OR REPLACE FUNCTION public.assign_product_category_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_product_category_company_id ON public.product_categories;
CREATE TRIGGER trg_assign_product_category_company_id
  BEFORE INSERT OR UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_product_category_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_company_id ON public.suppliers;
CREATE TRIGGER trg_assign_supplier_company_id
  BEFORE INSERT OR UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_product_category_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_preferred_company_id(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_product_category_company_id ON public.supplier_product_categories;
CREATE TRIGGER trg_assign_supplier_product_category_company_id
  BEFORE INSERT OR UPDATE ON public.supplier_product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_product_category_company_id();

CREATE OR REPLACE FUNCTION public.assign_product_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_inventory_company_id_from_supplier(NEW.supplier_id),
      (
        SELECT pc.company_id
        FROM public.product_categories pc
        WHERE pc.id = NEW.category_id
      ),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_product_company_id ON public.products;
CREATE TRIGGER trg_assign_product_company_id
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_product_company_id();

CREATE OR REPLACE FUNCTION public.assign_product_stock_history_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_inventory_company_id_from_product(COALESCE(NEW.product_id, NEW.user_product_id)),
      (
        SELECT s.company_id
        FROM public.supplier_orders so
        JOIN public.suppliers s ON s.id = so.supplier_id
        WHERE so.id = NEW.order_id
        LIMIT 1
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_product_stock_history_company_id ON public.product_stock_history;
CREATE TRIGGER trg_assign_product_stock_history_company_id
  BEFORE INSERT OR UPDATE ON public.product_stock_history
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_product_stock_history_company_id();

CREATE OR REPLACE FUNCTION public.assign_stock_alert_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_inventory_company_id_from_product(COALESCE(NEW.product_id, NEW.user_product_id));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_stock_alert_company_id ON public.stock_alerts;
CREATE TRIGGER trg_assign_stock_alert_company_id
  BEFORE INSERT OR UPDATE ON public.stock_alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_stock_alert_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_product_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_inventory_company_id_from_supplier(NEW.supplier_id),
      (
        SELECT spc.company_id
        FROM public.supplier_product_categories spc
        WHERE spc.id = NEW.category_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_product_company_id ON public.supplier_products;
CREATE TRIGGER trg_assign_supplier_product_company_id
  BEFORE INSERT OR UPDATE ON public.supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_product_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_service_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_inventory_company_id_from_supplier(NEW.supplier_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_service_company_id ON public.supplier_services;
CREATE TRIGGER trg_assign_supplier_service_company_id
  BEFORE INSERT OR UPDATE ON public.supplier_services
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_service_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_order_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_inventory_company_id_from_supplier(NEW.supplier_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_order_company_id ON public.supplier_orders;
CREATE TRIGGER trg_assign_supplier_order_company_id
  BEFORE INSERT OR UPDATE ON public.supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_order_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_invoice_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_inventory_company_id_from_supplier(NEW.supplier_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_invoice_company_id ON public.supplier_invoices;
CREATE TRIGGER trg_assign_supplier_invoice_company_id
  BEFORE INSERT OR UPDATE ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_invoice_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_location_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.resolve_inventory_company_id_from_supplier(NEW.supplier_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_location_company_id ON public.supplier_locations;
CREATE TRIGGER trg_assign_supplier_location_company_id
  BEFORE INSERT OR UPDATE ON public.supplier_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_location_company_id();

CREATE OR REPLACE FUNCTION public.assign_supplier_report_cache_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := COALESCE(
      public.resolve_inventory_company_id_from_supplier(NEW.supplier_id),
      public.resolve_preferred_company_id(NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_supplier_report_cache_company_id ON public.supplier_reports_cache;
CREATE TRIGGER trg_assign_supplier_report_cache_company_id
  BEFORE INSERT OR UPDATE ON public.supplier_reports_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_supplier_report_cache_company_id();
