
-- Enable pgcrypto for UUID generation and password hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean up existing test data (optional, be careful in production)
-- DELETE FROM public.audit_log;
-- DELETE FROM public.notifications;
-- DELETE FROM public.accounting_entries;
-- DELETE FROM public.supplier_invoices;
-- DELETE FROM public.supplier_order_items;
-- DELETE FROM public.supplier_orders;
-- DELETE FROM public.supplier_products;
-- DELETE FROM public.supplier_services;
-- DELETE FROM public.suppliers;
-- DELETE FROM public.company;
-- DELETE FROM public.profiles;

-- Transaction start
BEGIN;

---------------------------------------------------------------------------
-- 1. Create Users (Auth & Public)
---------------------------------------------------------------------------
-- Defined UUIDs for stability
-- Admin: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
-- SCTE SRL: b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22
-- Freelance: c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33

-- Insert Admin User
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, is_super_admin)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin.test@cashpilot.cloud',
    crypt('AdminTest@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Admin User"}',
    now(),
    now(),
    'authenticated',
    false
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'admin.test@cashpilot.cloud',
    '{"sub":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","email":"admin.test@cashpilot.cloud"}',
    'email',
    now(),
    now(),
    now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- Insert SCTE SRL User
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role)
VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'scte.test@cashpilot.cloud',
    crypt('ScteTest@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"SCTE Manager"}',
    now(),
    now(),
    'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'scte.test@cashpilot.cloud',
    '{"sub":"b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22","email":"scte.test@cashpilot.cloud"}',
    'email',
    now(),
    now(),
    now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- Insert Freelance User
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role)
VALUES (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
    'freelance.test@cashpilot.cloud',
    crypt('FreelanceTest@123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"Freelance User"}',
    now(),
    now(),
    'authenticated'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES (
    gen_random_uuid(),
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
    'freelance.test@cashpilot.cloud',
    '{"sub":"c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33","email":"freelance.test@cashpilot.cloud"}',
    'email',
    now(),
    now(),
    now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

---------------------------------------------------------------------------
-- 2. User Roles & Profiles
---------------------------------------------------------------------------
INSERT INTO public.user_roles (user_id, role) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'user'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'user')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.profiles (id, user_id, full_name, company_name, role, created_at, updated_at) VALUES
('p0000000-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Admin User', 'CashPilot Admin', 'admin', now(), now()),
('p0000000-0000-0000-0000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'SCTE Manager', 'SCTE SRL', 'user', now(), now()),
('p0000000-0000-0000-0000-000000000003', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Freelance User', 'Freelance', 'user', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company (id, user_id, company_name, company_type, address, country, created_at) VALUES
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'SCTE SRL', 'SARL', 'Paris', 'France', now()),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Freelance', 'Freelance', 'Paris', 'France', now());

---------------------------------------------------------------------------
-- 3 & 4. Create Suppliers
---------------------------------------------------------------------------
-- IDs for referencing later
-- S1: Électronique Pro (SCTE)
-- S2: Quincaillerie Générale (SCTE)
-- S3: Logistique Express (Freelance)
-- S4: Fournitures Bureau Plus (Freelance)

INSERT INTO public.suppliers (id, user_id, company_name, contact_person, email, phone, address, supplier_type, status, payment_terms, created_at, updated_at) VALUES
('s0000000-0000-0000-0000-000000000001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Électronique Pro', 'Jean Dupont', 'contact@electronique-pro.fr', '+33 1 23 45 67 89', '123 Rue de la Paix, 75001 Paris', 'both', 'active', 'Net 30', now(), now()),
('s0000000-0000-0000-0000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Quincaillerie Générale', 'Marie Martin', 'contact@quincaillerie-gen.fr', '+33 2 34 56 78 90', '456 Avenue du Commerce, 75002 Paris', 'product', 'active', 'Net 45', now(), now()),
('s0000000-0000-0000-0000-000000000003', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Logistique Express', 'Pierre Bernard', 'contact@logistique-express.fr', '+33 3 45 67 89 01', '789 Boulevard de la Logistique, 75003 Paris', 'service', 'active', 'Net 15', now(), now()),
('s0000000-0000-0000-0000-000000000004', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Fournitures Bureau Plus', 'Sophie Leclerc', 'contact@fournitures-bureau.fr', '+33 4 56 78 90 12', '321 Rue des Fournitures, 75004 Paris', 'product', 'active', 'Net 30', now(), now());

---------------------------------------------------------------------------
-- 5. Supplier Services
---------------------------------------------------------------------------
-- Électronique Pro (S1)
INSERT INTO public.supplier_services (id, supplier_id, service_name, pricing_type, hourly_rate, fixed_price, availability) VALUES
('sv000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'Installation électrique', 'hourly', 75, NULL, 'Lundi-Vendredi 08:00-18:00'),
('sv000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'Maintenance préventive', 'fixed', NULL, 500, 'Sur rendez-vous');

-- Logistique Express (S3)
INSERT INTO public.supplier_services (id, supplier_id, service_name, pricing_type, hourly_rate, fixed_price, availability) VALUES
('sv000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000003', 'Transport local', 'hourly', 50, NULL, 'Lundi-Samedi 06:00-22:00'),
('sv000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000003', 'Livraison express', 'fixed', NULL, 150, '24h/24'),
('sv000000-0000-0000-0000-000000000005', 's0000000-0000-0000-0000-000000000003', 'Entreposage', 'fixed', NULL, 200, 'Continu');

---------------------------------------------------------------------------
-- 6-8. Product Categories & Products
---------------------------------------------------------------------------
-- Categories SCTE
INSERT INTO public.supplier_product_categories (id, user_id, name) VALUES
('cat00000-0000-0000-0000-000000000001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Câbles'),
('cat00000-0000-0000-0000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Disjoncteurs'),
('cat00000-0000-0000-0000-000000000003', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Prises'),
('cat00000-0000-0000-0000-000000000004', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Vis'),
('cat00000-0000-0000-0000-000000000005', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Écrous'),
('cat00000-0000-0000-0000-000000000006', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'Rondelles');

-- Categories Freelance
INSERT INTO public.supplier_product_categories (id, user_id, name) VALUES
('cat00000-0000-0000-0000-000000000007', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Papier'),
('cat00000-0000-0000-0000-000000000008', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Stylos'),
('cat00000-0000-0000-0000-000000000009', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'Classeurs');

-- Products Électronique Pro
INSERT INTO public.supplier_products (id, supplier_id, category_id, product_name, sku, unit_price, unit, stock_quantity) VALUES
('pr000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'cat00000-0000-0000-0000-000000000001', 'Câble électrique 2.5mm²', 'CABLE-2.5-100', 0.85, 'mètre', 500),
('pr000000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'cat00000-0000-0000-0000-000000000002', 'Disjoncteur 16A', 'DISJ-16A-50', 12.50, 'pièce', 150),
('pr000000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 'cat00000-0000-0000-0000-000000000003', 'Prise électrique 2P+T', 'PRISE-2PT-200', 2.30, 'pièce', 300);

-- Products Quincaillerie
INSERT INTO public.supplier_products (id, supplier_id, category_id, product_name, sku, unit_price, unit, stock_quantity) VALUES
('pr000000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000002', 'cat00000-0000-0000-0000-000000000004', 'Vis acier M8x50', 'VIS-M8-50-1000', 0.15, 'pièce', 5000),
('pr000000-0000-0000-0000-000000000005', 's0000000-0000-0000-0000-000000000002', 'cat00000-0000-0000-0000-000000000005', 'Écrou acier M8', 'ECROU-M8-1000', 0.12, 'pièce', 4000),
('pr000000-0000-0000-0000-000000000006', 's0000000-0000-0000-0000-000000000002', 'cat00000-0000-0000-0000-000000000006', 'Rondelle acier M8', 'RONDELLE-M8-1000', 0.08, 'pièce', 6000);

-- Products Fournitures
INSERT INTO public.supplier_products (id, supplier_id, category_id, product_name, sku, unit_price, unit, stock_quantity) VALUES
('pr000000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000004', 'cat00000-0000-0000-0000-000000000007', 'Papier A4 80g', 'PAPIER-A4-80-500', 4.50, 'ramette', 200),
('pr000000-0000-0000-0000-000000000008', 's0000000-0000-0000-0000-000000000004', 'cat00000-0000-0000-0000-000000000008', 'Stylo bille noir', 'STYLO-NOIR-50', 0.35, 'pièce', 1000),
('pr000000-0000-0000-0000-000000000009', 's0000000-0000-0000-0000-000000000004', 'cat00000-0000-0000-0000-000000000009', 'Classeur A4', 'CLASSEUR-A4-50', 2.80, 'pièce', 300);

---------------------------------------------------------------------------
-- 9-12. Supplier Orders & Items
---------------------------------------------------------------------------
-- Orders SCTE -> Electro (S1)
INSERT INTO public.supplier_orders (id, supplier_id, user_id, order_number, order_date, expected_delivery_date, actual_delivery_date, order_status, total_amount, created_at) VALUES
('ord00000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '001', '2024-01-15', '2024-01-18', '2024-01-18', 'delivered', 335, '2024-01-15'),
('ord00000-0000-0000-0000-000000000002', 's0000000-0000-0000-0000-000000000001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '002', '2024-02-10', '2024-02-12', '2024-02-12', 'delivered', 715, '2024-02-10'),
('ord00000-0000-0000-0000-000000000003', 's0000000-0000-0000-0000-000000000001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '003', '2024-03-05', '2024-03-15', NULL, 'pending', 670, '2024-03-05');

-- Order Items SCTE -> Electro
INSERT INTO public.supplier_order_items (id, order_id, product_id, quantity, unit_price, total_price) VALUES
(gen_random_uuid(), 'ord00000-0000-0000-0000-000000000001', 'pr000000-0000-0000-0000-000000000001', 100, 0.85, 85),
(gen_random_uuid(), 'ord00000-0000-0000-0000-000000000001', 'pr000000-0000-0000-0000-000000000002', 20, 12.50, 250);

-- Orders SCTE -> Quincaillerie (S2)
INSERT INTO public.supplier_orders (id, supplier_id, user_id, order_number, order_date, expected_delivery_date, actual_delivery_date, order_status, total_amount, created_at) VALUES
('ord00000-0000-0000-0000-000000000004', 's0000000-0000-0000-0000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '001', '2024-01-20', '2024-01-22', '2024-01-22', 'delivered', 175, '2024-01-20'),
('ord00000-0000-0000-0000-000000000005', 's0000000-0000-0000-0000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '002', '2024-02-15', '2024-02-17', '2024-02-17', 'delivered', 270, '2024-02-15'),
('ord00000-0000-0000-0000-000000000006', 's0000000-0000-0000-0000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '003', '2024-03-10', '2024-03-20', NULL, 'confirmed', 160, '2024-03-10');

-- Orders Freelance -> Logistique (S3)
INSERT INTO public.supplier_orders (id, supplier_id, user_id, order_number, order_date, expected_delivery_date, actual_delivery_date, order_status, total_amount, created_at) VALUES
('ord00000-0000-0000-0000-000000000007', 's0000000-0000-0000-0000-000000000003', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '001', '2024-01-25', '2024-01-26', '2024-01-26', 'delivered', 750, '2024-01-25'),
('ord00000-0000-0000-0000-000000000008', 's0000000-0000-0000-0000-000000000003', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '002', '2024-02-20', '2024-03-20', '2024-03-20', 'delivered', 400, '2024-02-20'),
('ord00000-0000-0000-0000-000000000009', 's0000000-0000-0000-0000-000000000003', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '003', '2024-03-12', '2024-03-20', NULL, 'pending', 550, '2024-03-12');

-- Orders Freelance -> Fournitures (S4)
INSERT INTO public.supplier_orders (id, supplier_id, user_id, order_number, order_date, expected_delivery_date, actual_delivery_date, order_status, total_amount, created_at) VALUES
('ord00000-0000-0000-0000-000000000010', 's0000000-0000-0000-0000-000000000004', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '001', '2024-01-30', '2024-02-01', '2024-02-01', 'delivered', 125, '2024-01-30'),
('ord00000-0000-0000-0000-000000000011', 's0000000-0000-0000-0000-000000000004', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '002', '2024-02-25', '2024-02-27', '2024-02-27', 'delivered', 185, '2024-02-25'),
('ord00000-0000-0000-0000-000000000012', 's0000000-0000-0000-0000-000000000004', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '003', '2024-03-15', '2024-03-22', NULL, 'confirmed', 154, '2024-03-15');

---------------------------------------------------------------------------
-- 13-16. Supplier Invoices
---------------------------------------------------------------------------
-- Electro (S1)
INSERT INTO public.supplier_invoices (id, supplier_id, invoice_number, invoice_date, due_date, total_amount, vat_amount, vat_rate, payment_status, created_at) VALUES
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000001', 'ELP-2024-001', '2024-01-18', '2024-02-17', 335, 70.35, 21, 'paid', '2024-01-18'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000001', 'ELP-2024-002', '2024-02-12', '2024-03-13', 715, 150.15, 21, 'paid', '2024-02-12'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000001', 'ELP-2024-003', '2024-03-05', '2024-04-04', 670, 140.70, 21, 'pending', '2024-03-05');

-- Quincaillerie (S2)
INSERT INTO public.supplier_invoices (id, supplier_id, invoice_number, invoice_date, due_date, total_amount, vat_amount, vat_rate, payment_status, created_at) VALUES
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000002', 'QG-2024-001', '2024-01-22', '2024-03-08', 175, 36.75, 21, 'paid', '2024-01-22'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000002', 'QG-2024-002', '2024-02-17', '2024-04-03', 270, 56.70, 21, 'paid', '2024-02-17'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000002', 'QG-2024-003', '2024-03-10', '2024-04-24', 160, 33.60, 21, 'pending', '2024-03-10');

-- Logistique (S3)
INSERT INTO public.supplier_invoices (id, supplier_id, invoice_number, invoice_date, due_date, total_amount, vat_amount, vat_rate, payment_status, created_at) VALUES
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000003', 'LE-2024-001', '2024-01-26', '2024-02-10', 750, 157.50, 21, 'paid', '2024-01-26'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000003', 'LE-2024-002', '2024-02-20', '2024-03-06', 400, 84, 21, 'paid', '2024-02-20'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000003', 'LE-2024-003', '2024-03-12', '2024-03-27', 550, 115.50, 21, 'pending', '2024-03-12');

-- Fournitures (S4)
INSERT INTO public.supplier_invoices (id, supplier_id, invoice_number, invoice_date, due_date, total_amount, vat_amount, vat_rate, payment_status, created_at) VALUES
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000004', 'FBP-2024-001', '2024-02-01', '2024-03-02', 125, 26.25, 21, 'paid', '2024-02-01'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000004', 'FBP-2024-002', '2024-02-27', '2024-03-28', 185, 38.85, 21, 'paid', '2024-02-27'),
(gen_random_uuid(), 's0000000-0000-0000-0000-000000000004', 'FBP-2024-003', '2024-03-15', '2024-04-14', 154, 32.34, 21, 'pending', '2024-03-15');

---------------------------------------------------------------------------
-- 17. Chart of Accounts
---------------------------------------------------------------------------
-- For SCTE (User B)
INSERT INTO public.accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type, is_active) VALUES
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '401', 'Fournisseurs', 'liability', true),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '411', 'Clients', 'asset', true),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '512', 'Banque', 'asset', true),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '601', 'Achats matières', 'expense', true),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '602', 'Achats fournitures', 'expense', true),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '401100', 'Fournisseur Électronique Pro', 'liability', true),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '401200', 'Fournisseur Quincaillerie', 'liability', true);

-- For Freelance (User C)
INSERT INTO public.accounting_chart_of_accounts (id, user_id, account_code, account_name, account_type, is_active) VALUES
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '401', 'Fournisseurs', 'liability', true),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '411', 'Clients', 'asset', true),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '512', 'Banque', 'asset', true),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '606', 'Achats services', 'expense', true),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '401300', 'Fournisseur Logistique', 'liability', true),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '401400', 'Fournisseur Bureau Plus', 'liability', true);

---------------------------------------------------------------------------
-- 18. Accounting Entries
---------------------------------------------------------------------------
-- Sample Entries for SCTE Invoice #1 (ELP-2024-001) - 335 EUR
INSERT INTO public.accounting_entries (id, user_id, transaction_date, description, account_code, debit, credit) VALUES
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2024-01-18', 'Facture ELP-2024-001', '601', 335, 0),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '2024-01-18', 'Facture ELP-2024-001', '401100', 0, 335);

-- Sample Entries for Freelance Invoice #1 (LE-2024-001) - 750 EUR
INSERT INTO public.accounting_entries (id, user_id, transaction_date, description, account_code, debit, credit) VALUES
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '2024-01-26', 'Facture LE-2024-001', '606', 750, 0),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', '2024-01-26', 'Facture LE-2024-001', '401300', 0, 750);

---------------------------------------------------------------------------
-- 19. Stock History (Barcode Scan Logs)
---------------------------------------------------------------------------
INSERT INTO public.barcode_scan_logs (id, product_id, user_id, barcode, scan_timestamp, quantity, action) VALUES
(gen_random_uuid(), 'pr000000-0000-0000-0000-000000000001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'CABLE-2.5-100', '2024-01-01 10:00:00', 500, 'INVENTORY_INIT'),
(gen_random_uuid(), 'pr000000-0000-0000-0000-000000000002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'DISJ-16A-50', '2024-01-01 10:05:00', 150, 'INVENTORY_INIT'),
(gen_random_uuid(), 'pr000000-0000-0000-0000-000000000007', 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'PAPIER-A4-80-500', '2024-01-02 09:00:00', 200, 'INVENTORY_INIT');

---------------------------------------------------------------------------
-- 20. Notifications
---------------------------------------------------------------------------
INSERT INTO public.notifications (id, user_id, type, message, read, created_at) VALUES
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'order_delivered', 'Order #001 has been delivered by Électronique Pro', false, '2024-01-18 10:00:00'),
(gen_random_uuid(), 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33', 'invoice_received', 'New invoice received from Logistique Express (750€)', false, '2024-01-26 14:00:00');

---------------------------------------------------------------------------
-- 21. Audit Logs
---------------------------------------------------------------------------
INSERT INTO public.audit_log (id, user_id, action, details, created_at) VALUES
(gen_random_uuid(), 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'USER_CREATED', '{"email": "scte.test@cashpilot.cloud", "role": "user"}', now()),
(gen_random_uuid(), 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'SUPPLIER_CREATED', '{"name": "Électronique Pro"}', now());

COMMIT;
