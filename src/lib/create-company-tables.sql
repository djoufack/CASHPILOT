
-- ==============================================================================
-- MIGRATION: Company, Profiles, Quotes, Purchase Orders & Storage
-- ==============================================================================
-- This migration sets up the core tables for company management, extended user profiles,
-- quotes, purchase orders, and configures necessary storage buckets.
--
-- Cette migration configure les tables principales pour la gestion d'entreprise,
-- les profils utilisateurs étendus, les devis, les bons de commande, et le stockage.
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

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_profile_user_id ON public.users_profile(user_id);

-- Enable RLS
ALTER TABLE public.users_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON public.users_profile
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.users_profile
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.users_profile
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Create company table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    company_name TEXT,
    company_type TEXT CHECK (company_type IN ('freelance', 'company')),
    registration_number TEXT, -- SIRET/SIREN
    tax_id TEXT, -- TVA Intra
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
    swift TEXT, -- BIC
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_user_id ON public.company(user_id);

-- Enable RLS
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own company" ON public.company
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own company" ON public.company
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own company" ON public.company
    FOR UPDATE USING (auth.uid() = user_id);

-- 3. Create payment_terms table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_terms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- e.g., "30 Days Net"
    days INTEGER NOT NULL DEFAULT 30,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_payment_terms_user_id ON public.payment_terms(user_id);

-- Enable RLS
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own payment terms" ON public.payment_terms
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment terms" ON public.payment_terms
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment terms" ON public.payment_terms
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment terms" ON public.payment_terms
    FOR DELETE USING (auth.uid() = user_id);

-- 4. Update invoices table
-- ------------------------------------------------------------------------------
-- Add new columns to existing invoices table if they don't exist
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
    items JSONB DEFAULT '[]'::jsonb, -- Array of objects: {description, quantity, unit_price, tax_rate}
    total NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
    payment_terms_id UUID REFERENCES public.payment_terms(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, quote_number) -- Ensure uniqueness per user
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own quotes" ON public.quotes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quotes" ON public.quotes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quotes" ON public.quotes
    FOR UPDATE USING (auth.uid() = user_id);

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON public.purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_client_id ON public.purchase_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON public.purchase_orders(status);

-- Enable RLS
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own purchase_orders" ON public.purchase_orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchase_orders" ON public.purchase_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own purchase_orders" ON public.purchase_orders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own purchase_orders" ON public.purchase_orders
    FOR DELETE USING (auth.uid() = user_id);

-- 7. Trigger for updated_at timestamps
-- ------------------------------------------------------------------------------
-- Function to update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all new tables
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

-- 8. Storage Buckets Configuration (SQL representation)
-- Note: In Supabase, buckets are usually created via the API or dashboard, 
-- but we can insert into storage.buckets if we have permissions.
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('signatures', 'signatures', false) -- Private, requires signed URLs
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false) -- Private, sensitive PDFs
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (RLS for storage.objects)
-- Ensure users can only upload/read their own files in these buckets

-- Avatars Policies
CREATE POLICY "Avatar Public Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Avatar Upload Access" ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Avatar Update Access" ON storage.objects FOR UPDATE
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Avatar Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Logos Policies
CREATE POLICY "Logo Public Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'logos' );

CREATE POLICY "Logo Upload Access" ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Logo Update Access" ON storage.objects FOR UPDATE
USING ( bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Logo Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Signatures Policies (Private)
CREATE POLICY "Signature User Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Signature Upload Access" ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Signature Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'signatures' AND auth.uid()::text = (storage.foldername(name))[1] );

-- Documents Policies (Private)
CREATE POLICY "Document User Access" ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Document Upload Access" ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1] );

CREATE POLICY "Document Delete Access" ON storage.objects FOR DELETE
USING ( bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1] );
