-- ============================================================
-- CASHPILOT - Migration: Production Ready
-- Date: 2026-01-30
-- Description: Contraintes, RLS, nettoyage, homogénéisation
-- ============================================================

-- ============================================================
-- 1. CONTRAINTES UNIQUE
-- ============================================================

-- Supplier invoices: unique par (supplier_id, invoice_number)
ALTER TABLE supplier_invoices
ADD CONSTRAINT uq_supplier_invoices_number
UNIQUE (supplier_id, invoice_number);

-- Supplier orders: unique par (user_id, supplier_id, order_number)
ALTER TABLE supplier_orders
ADD CONSTRAINT uq_supplier_orders_number
UNIQUE (user_id, supplier_id, order_number);

-- Chart of accounts: unique par (user_id, account_code)
ALTER TABLE accounting_chart_of_accounts
ADD CONSTRAINT uq_accounting_chart_user_code
UNIQUE (user_id, account_code);

-- Invoices: unique par (user_id, invoice_number)
ALTER TABLE invoices
ADD CONSTRAINT uq_invoices_number
UNIQUE (user_id, invoice_number);

-- Quotes: unique par (user_id, quote_number)
ALTER TABLE quotes
ADD CONSTRAINT uq_quotes_number
UNIQUE (user_id, quote_number);

-- Purchase orders: unique par (user_id, po_number)
ALTER TABLE purchase_orders
ADD CONSTRAINT uq_purchase_orders_number
UNIQUE (user_id, po_number);

-- Role permissions: unique par (role, permission)
ALTER TABLE role_permissions
ADD CONSTRAINT uq_role_permissions
UNIQUE (role, permission);

-- Product barcodes: unique barcode
ALTER TABLE product_barcodes
ADD CONSTRAINT uq_product_barcodes_barcode
UNIQUE (barcode);

-- ============================================================
-- 2. SUPPRESSION DE LA TABLE REDONDANTE users_profile
-- ============================================================
DROP TABLE IF EXISTS users_profile;

-- ============================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_reports_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE barcode_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3.1 POLICIES: Users table
-- ============================================================
CREATE POLICY "users_select_own" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
    FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 3.2 POLICIES: Tables with user_id column (multi-tenant)
-- ============================================================

-- Profiles
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE USING (auth.uid() = user_id);

-- Company
CREATE POLICY "company_select_own" ON company
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "company_insert_own" ON company
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "company_update_own" ON company
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "company_delete_own" ON company
    FOR DELETE USING (auth.uid() = user_id);

-- Clients
CREATE POLICY "clients_select_own" ON clients
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "clients_insert_own" ON clients
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "clients_update_own" ON clients
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "clients_delete_own" ON clients
    FOR DELETE USING (auth.uid() = user_id);

-- Invoices
CREATE POLICY "invoices_select_own" ON invoices
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "invoices_insert_own" ON invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "invoices_update_own" ON invoices
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "invoices_delete_own" ON invoices
    FOR DELETE USING (auth.uid() = user_id);

-- Invoice Items (via parent invoice)
CREATE POLICY "invoice_items_select" ON invoice_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid())
    );
CREATE POLICY "invoice_items_insert" ON invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid())
    );
CREATE POLICY "invoice_items_update" ON invoice_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid())
    );
CREATE POLICY "invoice_items_delete" ON invoice_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid())
    );

-- Quotes
CREATE POLICY "quotes_select_own" ON quotes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "quotes_insert_own" ON quotes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quotes_update_own" ON quotes
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "quotes_delete_own" ON quotes
    FOR DELETE USING (auth.uid() = user_id);

-- Expenses
CREATE POLICY "expenses_select_own" ON expenses
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert_own" ON expenses
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_update_own" ON expenses
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "expenses_delete_own" ON expenses
    FOR DELETE USING (auth.uid() = user_id);

-- Projects
CREATE POLICY "projects_select_own" ON projects
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON projects
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Tasks (via project)
CREATE POLICY "tasks_select" ON tasks
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
    );
CREATE POLICY "tasks_insert" ON tasks
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
    );
CREATE POLICY "tasks_update" ON tasks
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
    );
CREATE POLICY "tasks_delete" ON tasks
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM projects WHERE projects.id = tasks.project_id AND projects.user_id = auth.uid())
    );

-- Subtasks (via task -> project)
CREATE POLICY "subtasks_select" ON subtasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "subtasks_insert" ON subtasks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "subtasks_update" ON subtasks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()
        )
    );
CREATE POLICY "subtasks_delete" ON subtasks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = subtasks.task_id AND projects.user_id = auth.uid()
        )
    );

-- Timesheets
CREATE POLICY "timesheets_select_own" ON timesheets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "timesheets_insert_own" ON timesheets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "timesheets_update_own" ON timesheets
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "timesheets_delete_own" ON timesheets
    FOR DELETE USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "notifications_select_own" ON notifications
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete_own" ON notifications
    FOR DELETE USING (auth.uid() = user_id);

-- Payment Terms
CREATE POLICY "payment_terms_select_own" ON payment_terms
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "payment_terms_insert_own" ON payment_terms
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "payment_terms_update_own" ON payment_terms
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "payment_terms_delete_own" ON payment_terms
    FOR DELETE USING (auth.uid() = user_id);

-- Purchase Orders
CREATE POLICY "purchase_orders_select_own" ON purchase_orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "purchase_orders_insert_own" ON purchase_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "purchase_orders_update_own" ON purchase_orders
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "purchase_orders_delete_own" ON purchase_orders
    FOR DELETE USING (auth.uid() = user_id);

-- Recurring Invoices
CREATE POLICY "recurring_invoices_select_own" ON recurring_invoices
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recurring_invoices_insert_own" ON recurring_invoices
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_invoices_update_own" ON recurring_invoices
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recurring_invoices_delete_own" ON recurring_invoices
    FOR DELETE USING (auth.uid() = user_id);

-- Suppliers
CREATE POLICY "suppliers_select_own" ON suppliers
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "suppliers_insert_own" ON suppliers
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_update_own" ON suppliers
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "suppliers_delete_own" ON suppliers
    FOR DELETE USING (auth.uid() = user_id);

-- Supplier Products (via supplier)
CREATE POLICY "supplier_products_select" ON supplier_products
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_products_insert" ON supplier_products
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_products_update" ON supplier_products
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_products_delete" ON supplier_products
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_products.supplier_id AND suppliers.user_id = auth.uid())
    );

-- Supplier Product Categories
CREATE POLICY "supplier_product_categories_select_own" ON supplier_product_categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "supplier_product_categories_insert_own" ON supplier_product_categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supplier_product_categories_update_own" ON supplier_product_categories
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "supplier_product_categories_delete_own" ON supplier_product_categories
    FOR DELETE USING (auth.uid() = user_id);

-- Supplier Orders
CREATE POLICY "supplier_orders_select_own" ON supplier_orders
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "supplier_orders_insert_own" ON supplier_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "supplier_orders_update_own" ON supplier_orders
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "supplier_orders_delete_own" ON supplier_orders
    FOR DELETE USING (auth.uid() = user_id);

-- Supplier Order Items (via order)
CREATE POLICY "supplier_order_items_select" ON supplier_order_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_orders.id = supplier_order_items.order_id AND supplier_orders.user_id = auth.uid())
    );
CREATE POLICY "supplier_order_items_insert" ON supplier_order_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_orders.id = supplier_order_items.order_id AND supplier_orders.user_id = auth.uid())
    );
CREATE POLICY "supplier_order_items_update" ON supplier_order_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_orders.id = supplier_order_items.order_id AND supplier_orders.user_id = auth.uid())
    );
CREATE POLICY "supplier_order_items_delete" ON supplier_order_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_orders.id = supplier_order_items.order_id AND supplier_orders.user_id = auth.uid())
    );

-- Supplier Invoices (via supplier)
CREATE POLICY "supplier_invoices_select" ON supplier_invoices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_invoices.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_invoices_insert" ON supplier_invoices
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_invoices.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_invoices_update" ON supplier_invoices
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_invoices.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_invoices_delete" ON supplier_invoices
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_invoices.supplier_id AND suppliers.user_id = auth.uid())
    );

-- Supplier Services (via supplier)
CREATE POLICY "supplier_services_select" ON supplier_services
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_services.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_services_insert" ON supplier_services
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_services.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_services_update" ON supplier_services
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_services.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_services_delete" ON supplier_services
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_services.supplier_id AND suppliers.user_id = auth.uid())
    );

-- Supplier Locations (via supplier)
CREATE POLICY "supplier_locations_select" ON supplier_locations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_locations.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_locations_insert" ON supplier_locations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_locations.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_locations_update" ON supplier_locations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_locations.supplier_id AND suppliers.user_id = auth.uid())
    );
CREATE POLICY "supplier_locations_delete" ON supplier_locations
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = supplier_locations.supplier_id AND suppliers.user_id = auth.uid())
    );

-- Supplier Reports Cache
CREATE POLICY "supplier_reports_cache_select_own" ON supplier_reports_cache
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "supplier_reports_cache_insert_own" ON supplier_reports_cache
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Delivery Routes (via order -> user)
CREATE POLICY "delivery_routes_select" ON delivery_routes
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_orders.id = delivery_routes.order_id AND supplier_orders.user_id = auth.uid())
    );
CREATE POLICY "delivery_routes_insert" ON delivery_routes
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_orders.id = delivery_routes.order_id AND supplier_orders.user_id = auth.uid())
    );
CREATE POLICY "delivery_routes_update" ON delivery_routes
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM supplier_orders WHERE supplier_orders.id = delivery_routes.order_id AND supplier_orders.user_id = auth.uid())
    );

-- Accounting tables
CREATE POLICY "accounting_coa_select_own" ON accounting_chart_of_accounts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounting_coa_insert_own" ON accounting_chart_of_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounting_coa_update_own" ON accounting_chart_of_accounts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounting_coa_delete_own" ON accounting_chart_of_accounts
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "accounting_entries_select_own" ON accounting_entries
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounting_entries_insert_own" ON accounting_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounting_entries_update_own" ON accounting_entries
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounting_entries_delete_own" ON accounting_entries
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "accounting_mappings_select_own" ON accounting_mappings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounting_mappings_insert_own" ON accounting_mappings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounting_mappings_update_own" ON accounting_mappings
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounting_mappings_delete_own" ON accounting_mappings
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "accounting_tax_rates_select_own" ON accounting_tax_rates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounting_tax_rates_insert_own" ON accounting_tax_rates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounting_tax_rates_update_own" ON accounting_tax_rates
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounting_tax_rates_delete_own" ON accounting_tax_rates
    FOR DELETE USING (auth.uid() = user_id);

-- Product Barcodes (via product -> supplier)
CREATE POLICY "product_barcodes_select" ON product_barcodes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM supplier_products sp
            JOIN suppliers s ON s.id = sp.supplier_id
            WHERE sp.id = product_barcodes.product_id AND s.user_id = auth.uid()
        )
    );
CREATE POLICY "product_barcodes_insert" ON product_barcodes
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM supplier_products sp
            JOIN suppliers s ON s.id = sp.supplier_id
            WHERE sp.id = product_barcodes.product_id AND s.user_id = auth.uid()
        )
    );

-- Barcode Scan Logs
CREATE POLICY "barcode_scan_logs_select_own" ON barcode_scan_logs
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "barcode_scan_logs_insert_own" ON barcode_scan_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Biometric Credentials
CREATE POLICY "biometric_credentials_select_own" ON biometric_credentials
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "biometric_credentials_insert_own" ON biometric_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "biometric_credentials_delete_own" ON biometric_credentials
    FOR DELETE USING (auth.uid() = user_id);

-- Push Subscriptions
CREATE POLICY "push_subscriptions_select_own" ON push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_insert_own" ON push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_subscriptions_delete_own" ON push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

-- Push Notification Logs
CREATE POLICY "push_notification_logs_select_own" ON push_notification_logs
    FOR SELECT USING (auth.uid() = user_id);

-- Report Templates
CREATE POLICY "report_templates_select_own" ON report_templates
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "report_templates_insert_own" ON report_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "report_templates_update_own" ON report_templates
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "report_templates_delete_own" ON report_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Offline Sync Queue
CREATE POLICY "offline_sync_queue_select_own" ON offline_sync_queue
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "offline_sync_queue_insert_own" ON offline_sync_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "offline_sync_queue_update_own" ON offline_sync_queue
    FOR UPDATE USING (auth.uid() = user_id);

-- Audit Log (read-only for own entries)
CREATE POLICY "audit_log_select_own" ON audit_log
    FOR SELECT USING (auth.uid() = user_id);

-- User Roles
CREATE POLICY "user_roles_select_own" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Role Permissions (readable by all authenticated users)
CREATE POLICY "role_permissions_select_all" ON role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. HOMOGENEISATION DES UUID DEFAULTS
-- ============================================================

-- Migrate extensions.uuid_generate_v4() to gen_random_uuid()
ALTER TABLE push_subscriptions ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE push_notification_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE offline_sync_queue ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE accounting_chart_of_accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE accounting_entries ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE accounting_mappings ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE accounting_tax_rates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE product_barcodes ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE barcode_scan_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE biometric_credentials ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE report_templates ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE supplier_locations ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE supplier_reports_cache ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE delivery_routes ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ============================================================
-- 5. HOMOGENEISATION DES TIMESTAMPS DEFAULTS
-- ============================================================

-- Standardize to now() for all created_at columns
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE profiles ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE profiles ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE clients ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE invoices ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE invoice_items ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE quotes ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE expenses ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE projects ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE tasks ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE timesheets ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE recurring_invoices ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE role_permissions ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE audit_log ALTER COLUMN created_at SET DEFAULT now();

-- ============================================================
-- 6. INDEX POUR LES PERFORMANCES
-- ============================================================

-- Index sur user_id pour toutes les tables multi-tenant
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_company_user_id ON company(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON quotes(client_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_user_id ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_project_id ON timesheets(project_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_products_category_id ON supplier_products(category_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_user_id ON supplier_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_supplier_id ON supplier_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_status ON supplier_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_order_id ON supplier_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_status ON supplier_invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_user_id ON accounting_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_date ON accounting_entries(transaction_date);
CREATE INDEX IF NOT EXISTS idx_accounting_entries_account ON accounting_entries(account_code);
CREATE INDEX IF NOT EXISTS idx_accounting_coa_user_id ON accounting_chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_logs_user_id ON barcode_scan_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_logs_product_id ON barcode_scan_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_product_barcodes_product_id ON product_barcodes(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id ON purchase_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_user_id ON recurring_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_terms_user_id ON payment_terms(user_id);

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
