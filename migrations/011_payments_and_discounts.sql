-- Migration 011: Payments & Discounts
-- Adds discount support to invoices/invoice_items and creates payments tracking system

-- ============================================
-- 1. Add discount columns to invoices
-- ============================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'fixed'));
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS balance_due DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overpaid'));

-- ============================================
-- 2. Add discount columns to invoice_items
-- ============================================
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'none' CHECK (discount_type IN ('none', 'percentage', 'fixed'));
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_value DECIMAL(12,2) DEFAULT 0;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0;

-- ============================================
-- 3. Create payments table
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(12,2) NOT NULL,
    payment_method TEXT DEFAULT 'bank_transfer' CHECK (payment_method IN ('cash', 'bank_transfer', 'check', 'card', 'paypal', 'other')),
    reference TEXT,
    notes TEXT,
    is_lump_sum BOOLEAN DEFAULT false,
    receipt_number TEXT,
    receipt_generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Create payment_allocations table (for lump-sum payments)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. Enable RLS
-- ============================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies for payments
-- ============================================
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own payments" ON public.payments;
CREATE POLICY "Users can create own payments" ON public.payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
CREATE POLICY "Users can update own payments" ON public.payments
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own payments" ON public.payments;
CREATE POLICY "Users can delete own payments" ON public.payments
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. RLS Policies for payment_allocations
-- ============================================
DROP POLICY IF EXISTS "Users can view own payment allocations" ON public.payment_allocations;
CREATE POLICY "Users can view own payment allocations" ON public.payment_allocations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_allocations.payment_id AND payments.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can create own payment allocations" ON public.payment_allocations;
CREATE POLICY "Users can create own payment allocations" ON public.payment_allocations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_allocations.payment_id AND payments.user_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can delete own payment allocations" ON public.payment_allocations;
CREATE POLICY "Users can delete own payment allocations" ON public.payment_allocations
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.payments WHERE payments.id = payment_allocations.payment_id AND payments.user_id = auth.uid())
    );

-- ============================================
-- 8. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_client_id ON public.payments(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON public.payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON public.payment_allocations(invoice_id);

-- ============================================
-- 9. Initialize balance_due for existing invoices
-- ============================================
UPDATE public.invoices
SET balance_due = COALESCE(total_ttc, 0) - COALESCE(amount_paid, 0),
    payment_status = CASE
        WHEN status = 'paid' THEN 'paid'
        ELSE 'unpaid'
    END
WHERE balance_due IS NULL OR balance_due = 0;
