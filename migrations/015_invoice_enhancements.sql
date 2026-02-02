-- Migration 015: Invoice Enhancements
-- Adds shipping fees, adjustment, header/footer notes, terms, internal remarks, image attachment, custom fields
-- Also adds credit_notes table and delivery_notes table

-- ============================================
-- 1. Enrich invoices table
-- ============================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS adjustment NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS adjustment_label TEXT DEFAULT '';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS header_note TEXT DEFAULT '';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS footer_note TEXT DEFAULT '';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT DEFAULT '';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS internal_remark TEXT DEFAULT '';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS attached_image_url TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '[]';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS reference TEXT DEFAULT '';

-- ============================================
-- 2. Enrich invoice_items table with HSN code
-- ============================================
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS hsn_code TEXT DEFAULT '';

-- ============================================
-- 3. Credit Notes table
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credit_note_number TEXT NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT DEFAULT '',
    total_ht NUMERIC(12,2) DEFAULT 0,
    tax_rate NUMERIC(5,2) DEFAULT 0,
    tax_amount NUMERIC(12,2) DEFAULT 0,
    total_ttc NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Credit Note Items
-- ============================================
CREATE TABLE IF NOT EXISTS public.credit_note_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12,2) DEFAULT 1,
    unit_price NUMERIC(12,2) DEFAULT 0,
    amount NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Delivery Notes table
-- ============================================
CREATE TABLE IF NOT EXISTS public.delivery_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    delivery_note_number TEXT NOT NULL,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    delivery_address TEXT DEFAULT '',
    carrier TEXT DEFAULT '',
    tracking_number TEXT DEFAULT '',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Delivery Note Items
-- ============================================
CREATE TABLE IF NOT EXISTS public.delivery_note_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_note_id UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity NUMERIC(12,2) DEFAULT 1,
    unit TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. Enable RLS
-- ============================================
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS Policies - Credit Notes
-- ============================================
DROP POLICY IF EXISTS "Users can view own credit notes" ON public.credit_notes;
CREATE POLICY "Users can view own credit notes" ON public.credit_notes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own credit notes" ON public.credit_notes;
CREATE POLICY "Users can create own credit notes" ON public.credit_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own credit notes" ON public.credit_notes;
CREATE POLICY "Users can update own credit notes" ON public.credit_notes FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own credit notes" ON public.credit_notes;
CREATE POLICY "Users can delete own credit notes" ON public.credit_notes FOR DELETE USING (auth.uid() = user_id);

-- credit_note_items via credit_note owner
DROP POLICY IF EXISTS "Users can view own credit note items" ON public.credit_note_items;
CREATE POLICY "Users can view own credit note items" ON public.credit_note_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.credit_notes cn WHERE cn.id = credit_note_id AND cn.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can manage own credit note items" ON public.credit_note_items;
CREATE POLICY "Users can manage own credit note items" ON public.credit_note_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.credit_notes cn WHERE cn.id = credit_note_id AND cn.user_id = auth.uid())
);

-- ============================================
-- 9. RLS Policies - Delivery Notes
-- ============================================
DROP POLICY IF EXISTS "Users can view own delivery notes" ON public.delivery_notes;
CREATE POLICY "Users can view own delivery notes" ON public.delivery_notes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own delivery notes" ON public.delivery_notes;
CREATE POLICY "Users can create own delivery notes" ON public.delivery_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own delivery notes" ON public.delivery_notes;
CREATE POLICY "Users can update own delivery notes" ON public.delivery_notes FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own delivery notes" ON public.delivery_notes;
CREATE POLICY "Users can delete own delivery notes" ON public.delivery_notes FOR DELETE USING (auth.uid() = user_id);

-- delivery_note_items via delivery_note owner
DROP POLICY IF EXISTS "Users can view own delivery note items" ON public.delivery_note_items;
CREATE POLICY "Users can view own delivery note items" ON public.delivery_note_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.delivery_notes dn WHERE dn.id = delivery_note_id AND dn.user_id = auth.uid())
);
DROP POLICY IF EXISTS "Users can manage own delivery note items" ON public.delivery_note_items;
CREATE POLICY "Users can manage own delivery note items" ON public.delivery_note_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.delivery_notes dn WHERE dn.id = delivery_note_id AND dn.user_id = auth.uid())
);

-- ============================================
-- 10. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_credit_notes_user_id ON public.credit_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON public.credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_client_id ON public.credit_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_cn_id ON public.credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_user_id ON public.delivery_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_notes_invoice_id ON public.delivery_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_note_items_dn_id ON public.delivery_note_items(delivery_note_id);
