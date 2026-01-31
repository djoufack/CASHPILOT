-- ============================================================
-- Migration 010: User Products & Stock (centré utilisateur)
-- Le stock appartient au User, pas aux fournisseurs.
-- ============================================================

-- 1. Table des catégories de produits du User
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Table des produits du User (son stock)
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    sku TEXT,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
    unit_price DECIMAL(12,2) DEFAULT 0,          -- prix de vente (au client)
    purchase_price DECIMAL(12,2) DEFAULT 0,       -- prix d'achat (du fournisseur)
    unit TEXT DEFAULT 'pièce',
    stock_quantity DECIMAL(14,2) DEFAULT 0,
    min_stock_level DECIMAL(14,2) DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,  -- fournisseur habituel (optionnel)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ajouter product_id sur invoice_items (lien produit -> facture client)
ALTER TABLE public.invoice_items
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- 4. Ajouter user_product_id sur product_stock_history (nouveau FK vers products)
ALTER TABLE public.product_stock_history
    ADD COLUMN IF NOT EXISTS user_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;

-- 5. Ajouter user_product_id sur stock_alerts (nouveau FK vers products)
ALTER TABLE public.stock_alerts
    ADD COLUMN IF NOT EXISTS user_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE;

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'product_categories_select_own') THEN
        CREATE POLICY "product_categories_select_own" ON public.product_categories
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'product_categories_insert_own') THEN
        CREATE POLICY "product_categories_insert_own" ON public.product_categories
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'product_categories_update_own') THEN
        CREATE POLICY "product_categories_update_own" ON public.product_categories
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_categories' AND policyname = 'product_categories_delete_own') THEN
        CREATE POLICY "product_categories_delete_own" ON public.product_categories
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_select_own') THEN
        CREATE POLICY "products_select_own" ON public.products
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_insert_own') THEN
        CREATE POLICY "products_insert_own" ON public.products
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_update_own') THEN
        CREATE POLICY "products_update_own" ON public.products
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'products_delete_own') THEN
        CREATE POLICY "products_delete_own" ON public.products
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(user_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_product_categories_user_id ON public.product_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user_product ON public.product_stock_history(user_product_id);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_user_product ON public.stock_alerts(user_product_id);

-- ============================================================
-- Triggers updated_at
-- ============================================================

DROP TRIGGER IF EXISTS update_products_modtime ON public.products;
CREATE TRIGGER update_products_modtime
    BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_product_categories_modtime ON public.product_categories;
CREATE TRIGGER update_product_categories_modtime
    BEFORE UPDATE ON public.product_categories
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
