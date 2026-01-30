
-- ==============================================================================
-- MIGRATION: Company, Profiles, Quotes, Purchase Orders & Storage
-- ==============================================================================
-- IDEMPOTENT: Safe to re-run — uses IF NOT EXISTS and DROP POLICY IF EXISTS
-- ==============================================================================

-- 1. Create users_profile table (Extended profile info)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users_profile (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    phone TEXT,
    signature_url TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_profile_user_id ON public.users_profile(user_id);
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.users_profile;
CREATE POLICY "Users can view own profile" ON public.users_profile
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users_profile;
CREATE POLICY "Users can insert own profile" ON public.users_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users_profile;
CREATE POLICY "Users can update own profile" ON public.users_profile
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Create company table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    company_name TEXT,
    company_type TEXT CHECK (company_type IN ('freelance', 'company')),
    registration_number TEXT,
    tax_id TEXT,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    logo_url TEXT,
    bank_account TEXT,
    bank_name TEXT,
    iban TEXT,
    swift TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_user_id ON public.company(user_id);
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own company" ON public.company;
CREATE POLICY "Users can view own company" ON public.company
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own company" ON public.company;
CREATE POLICY "Users can insert own company" ON public.company
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own company" ON public.company;
CREATE POLICY "Users can update own company" ON public.company
    FOR UPDATE USING (auth.uid() = user_id);

-- 3. Create payment_terms table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_terms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    days INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_terms_user_id ON public.payment_terms(user_id);
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment terms" ON public.payment_terms;
CREATE POLICY "Users can view own payment terms" ON public.payment_terms
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own payment terms" ON public.payment_terms;
CREATE POLICY "Users can insert own payment terms" ON public.payment_terms
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own payment terms" ON public.payment_terms;
CREATE POLICY "Users can update own payment terms" ON public.payment_terms
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own payment terms" ON public.payment_terms;
CREATE POLICY "Users can delete own payment terms" ON public.payment_terms
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Update invoices table
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'payment_terms_id') THEN
        ALTER TABLE public.invoices ADD COLUMN payment_terms_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'notes') THEN
        ALTER TABLE public.invoices ADD COLUMN notes TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'conditions') THEN
        ALTER TABLE public.invoices ADD COLUMN conditions TEXT;
    END IF;
END $$;

-- 5. Create quotes table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    quote_number TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    items JSONB DEFAULT '[]'::jsonb,
    total NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
    payment_terms_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own quotes" ON public.quotes;
CREATE POLICY "Users can view own quotes" ON public.quotes
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own quotes" ON public.quotes;
CREATE POLICY "Users can insert own quotes" ON public.quotes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own quotes" ON public.quotes;
CREATE POLICY "Users can update own quotes" ON public.quotes
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own quotes" ON public.quotes;
CREATE POLICY "Users can delete own quotes" ON public.quotes
    FOR DELETE USING (auth.uid() = user_id);

-- 6. Create purchase_orders table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    po_number TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    items JSONB DEFAULT '[]'::jsonb,
    total NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'confirmed', 'completed', 'cancelled')),
    payment_terms_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, po_number)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON public.purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_client_id ON public.purchase_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can view own purchase_orders" ON public.purchase_orders
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can insert own purchase_orders" ON public.purchase_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can update own purchase_orders" ON public.purchase_orders
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own purchase_orders" ON public.purchase_orders;
CREATE POLICY "Users can delete own purchase_orders" ON public.purchase_orders
    FOR DELETE USING (auth.uid() = user_id);

-- 7. Trigger for updated_at timestamps
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_profile_modtime ON public.users_profile;
CREATE TRIGGER update_users_profile_modtime BEFORE UPDATE ON public.users_profile FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_modtime ON public.company;
CREATE TRIGGER update_company_modtime BEFORE UPDATE ON public.company FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_terms_modtime ON public.payment_terms;
CREATE TRIGGER update_payment_terms_modtime BEFORE UPDATE ON public.payment_terms FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_modtime ON public.quotes;
CREATE TRIGGER update_quotes_modtime BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_purchase_orders_modtime ON public.purchase_orders;
CREATE TRIGGER update_purchase_orders_modtime BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 8. Storage Buckets
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Avatars
DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Avatar Upload Access" ON storage.objects;
CREATE POLICY "Avatar Upload Access" ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Avatar Update Access" ON storage.objects;
CREATE POLICY "Avatar Update Access" ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Avatar Delete Access" ON storage.objects;
CREATE POLICY "Avatar Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Logos
DROP POLICY IF EXISTS "Logo Public Access" ON storage.objects;
CREATE POLICY "Logo Public Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );

DROP POLICY IF EXISTS "Logo Upload Access" ON storage.objects;
CREATE POLICY "Logo Upload Access" ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Logo Update Access" ON storage.objects;
CREATE POLICY "Logo Update Access" ON storage.objects FOR UPDATE
USING ( bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Logo Delete Access" ON storage.objects;
CREATE POLICY "Logo Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Signatures (Private)
DROP POLICY IF EXISTS "Signature User Access" ON storage.objects;
CREATE POLICY "Signature User Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Signature Upload Access" ON storage.objects;
CREATE POLICY "Signature Upload Access" ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Signature Delete Access" ON storage.objects;
CREATE POLICY "Signature Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Documents (Private)
DROP POLICY IF EXISTS "Document User Access" ON storage.objects;
CREATE POLICY "Document User Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Document Upload Access" ON storage.objects;
CREATE POLICY "Document Upload Access" ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1] );

DROP POLICY IF EXISTS "Document Delete Access" ON storage.objects;
CREATE POLICY "Document Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1] );
