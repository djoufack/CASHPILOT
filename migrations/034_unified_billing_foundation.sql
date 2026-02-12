-- ============================================================
-- Migration 034: Unified Billing Foundation
-- Services, service categories, and unified invoice item types.
-- Links services to tasks, timesheets, and invoice items.
-- Auto stock decrement trigger on invoice_items for products.
-- ============================================================

-- 1. Table des catégories de services du User
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des services du User
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    service_name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
    pricing_type TEXT NOT NULL DEFAULT 'hourly' CHECK (pricing_type IN ('hourly', 'fixed', 'per_unit')),
    hourly_rate DECIMAL(12,2) DEFAULT 0,
    fixed_price DECIMAL(12,2) DEFAULT 0,
    unit_price DECIMAL(12,2) DEFAULT 0,
    unit TEXT DEFAULT 'heure',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Étendre tasks avec estimated_hours et service_id
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(8,2),
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- 4. Étendre invoice_items avec item_type, service_id, timesheet_id
ALTER TABLE public.invoice_items
    ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'manual' CHECK (item_type IN ('product', 'service', 'timesheet', 'manual')),
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS timesheet_id UUID REFERENCES public.timesheets(id) ON DELETE SET NULL;

-- 5. Étendre invoices avec invoice_type
ALTER TABLE public.invoices
    ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'mixed' CHECK (invoice_type IN ('product', 'service', 'mixed'));

-- 6. Étendre timesheets avec service_id
ALTER TABLE public.timesheets
    ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_categories' AND policyname = 'service_categories_select_own') THEN
        CREATE POLICY "service_categories_select_own" ON public.service_categories
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_categories' AND policyname = 'service_categories_insert_own') THEN
        CREATE POLICY "service_categories_insert_own" ON public.service_categories
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_categories' AND policyname = 'service_categories_update_own') THEN
        CREATE POLICY "service_categories_update_own" ON public.service_categories
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'service_categories' AND policyname = 'service_categories_delete_own') THEN
        CREATE POLICY "service_categories_delete_own" ON public.service_categories
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'services_select_own') THEN
        CREATE POLICY "services_select_own" ON public.services
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'services_insert_own') THEN
        CREATE POLICY "services_insert_own" ON public.services
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'services_update_own') THEN
        CREATE POLICY "services_update_own" ON public.services
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'services' AND policyname = 'services_delete_own') THEN
        CREATE POLICY "services_delete_own" ON public.services
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_services_user_id ON public.services(user_id);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(category_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_service_categories_user_id ON public.service_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_service_id ON public.tasks(service_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_service_id ON public.invoice_items(service_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_item_type ON public.invoice_items(item_type);
CREATE INDEX IF NOT EXISTS idx_invoice_items_timesheet_id ON public.invoice_items(timesheet_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_service_id ON public.timesheets(service_id);

-- ============================================================
-- Triggers updated_at
-- ============================================================

DROP TRIGGER IF EXISTS update_services_modtime ON public.services;
CREATE TRIGGER update_services_modtime
    BEFORE UPDATE ON public.services
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_service_categories_modtime ON public.service_categories;
CREATE TRIGGER update_service_categories_modtime
    BEFORE UPDATE ON public.service_categories
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- ============================================================
-- Stock Auto-Decrement Trigger on invoice_items
-- ============================================================

CREATE OR REPLACE FUNCTION auto_stock_decrement()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_number TEXT;
    v_prev_qty DECIMAL(14,2);
    v_user_id UUID;
BEGIN
    IF TG_OP = 'INSERT' AND NEW.item_type = 'product' AND NEW.product_id IS NOT NULL THEN
        SELECT invoice_number, user_id INTO v_invoice_number, v_user_id
        FROM public.invoices WHERE id = NEW.invoice_id;

        SELECT stock_quantity INTO v_prev_qty FROM public.products WHERE id = NEW.product_id;

        UPDATE public.products
        SET stock_quantity = stock_quantity - COALESCE(NEW.quantity, 0)
        WHERE id = NEW.product_id;

        INSERT INTO public.product_stock_history (
            user_product_id, previous_quantity, new_quantity, change_quantity,
            reason, notes, created_by
        ) VALUES (
            NEW.product_id, v_prev_qty, v_prev_qty - COALESCE(NEW.quantity, 0),
            -COALESCE(NEW.quantity, 0), 'sale',
            'Facture ' || COALESCE(v_invoice_number, 'N/A'), v_user_id
        );

    ELSIF TG_OP = 'DELETE' AND OLD.item_type = 'product' AND OLD.product_id IS NOT NULL THEN
        SELECT invoice_number, user_id INTO v_invoice_number, v_user_id
        FROM public.invoices WHERE id = OLD.invoice_id;

        SELECT stock_quantity INTO v_prev_qty FROM public.products WHERE id = OLD.product_id;

        UPDATE public.products
        SET stock_quantity = stock_quantity + COALESCE(OLD.quantity, 0)
        WHERE id = OLD.product_id;

        INSERT INTO public.product_stock_history (
            user_product_id, previous_quantity, new_quantity, change_quantity,
            reason, notes, created_by
        ) VALUES (
            OLD.product_id, v_prev_qty, v_prev_qty + COALESCE(OLD.quantity, 0),
            COALESCE(OLD.quantity, 0), 'adjustment',
            'Annulation facture ' || COALESCE(v_invoice_number, 'N/A'), v_user_id
        );
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_stock_decrement ON public.invoice_items;
CREATE TRIGGER trg_auto_stock_decrement
    AFTER INSERT OR DELETE ON public.invoice_items
    FOR EACH ROW EXECUTE FUNCTION auto_stock_decrement();
