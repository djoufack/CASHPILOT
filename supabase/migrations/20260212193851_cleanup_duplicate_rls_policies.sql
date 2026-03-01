
-- =====================================================
-- NETTOYAGE DES POLICIES RLS REDONDANTES
-- =====================================================
-- Type 1: Tables avec policy ALL -> supprimer les CRUD spécifiques redondantes
-- Type 2: Doublons purs -> garder le nommage snake_case, supprimer l'ancien

-- =====================================================
-- TYPE 1: Policy ALL rend les CRUD spécifiques inutiles
-- =====================================================

-- accounting_chart_of_accounts (garder ALL, supprimer 4 CRUD)
DROP POLICY IF EXISTS "accounting_coa_select_own" ON accounting_chart_of_accounts;
DROP POLICY IF EXISTS "accounting_coa_insert_own" ON accounting_chart_of_accounts;
DROP POLICY IF EXISTS "accounting_coa_update_own" ON accounting_chart_of_accounts;
DROP POLICY IF EXISTS "accounting_coa_delete_own" ON accounting_chart_of_accounts;

-- accounting_entries (garder ALL, supprimer 4 CRUD)
DROP POLICY IF EXISTS "accounting_entries_select_own" ON accounting_entries;
DROP POLICY IF EXISTS "accounting_entries_insert_own" ON accounting_entries;
DROP POLICY IF EXISTS "accounting_entries_update_own" ON accounting_entries;
DROP POLICY IF EXISTS "accounting_entries_delete_own" ON accounting_entries;

-- accounting_mappings (garder ALL, supprimer 4 CRUD)
DROP POLICY IF EXISTS "accounting_mappings_select_own" ON accounting_mappings;
DROP POLICY IF EXISTS "accounting_mappings_insert_own" ON accounting_mappings;
DROP POLICY IF EXISTS "accounting_mappings_update_own" ON accounting_mappings;
DROP POLICY IF EXISTS "accounting_mappings_delete_own" ON accounting_mappings;

-- accounting_tax_rates (garder ALL, supprimer 4 CRUD)
DROP POLICY IF EXISTS "accounting_tax_rates_select_own" ON accounting_tax_rates;
DROP POLICY IF EXISTS "accounting_tax_rates_insert_own" ON accounting_tax_rates;
DROP POLICY IF EXISTS "accounting_tax_rates_update_own" ON accounting_tax_rates;
DROP POLICY IF EXISTS "accounting_tax_rates_delete_own" ON accounting_tax_rates;

-- barcode_scan_logs (garder ALL, supprimer INSERT+SELECT)
DROP POLICY IF EXISTS "barcode_scan_logs_insert_own" ON barcode_scan_logs;
DROP POLICY IF EXISTS "barcode_scan_logs_select_own" ON barcode_scan_logs;

-- biometric_credentials (garder ALL, supprimer DELETE+INSERT+SELECT)
DROP POLICY IF EXISTS "biometric_credentials_delete_own" ON biometric_credentials;
DROP POLICY IF EXISTS "biometric_credentials_insert_own" ON biometric_credentials;
DROP POLICY IF EXISTS "biometric_credentials_select_own" ON biometric_credentials;

-- offline_sync_queue (garder ALL, supprimer INSERT+SELECT+UPDATE)
DROP POLICY IF EXISTS "offline_sync_queue_insert_own" ON offline_sync_queue;
DROP POLICY IF EXISTS "offline_sync_queue_select_own" ON offline_sync_queue;
DROP POLICY IF EXISTS "offline_sync_queue_update_own" ON offline_sync_queue;

-- push_subscriptions (garder ALL, supprimer DELETE+INSERT+SELECT)
DROP POLICY IF EXISTS "push_subscriptions_delete_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_insert_own" ON push_subscriptions;
DROP POLICY IF EXISTS "push_subscriptions_select_own" ON push_subscriptions;

-- report_templates (garder ALL, supprimer 4 CRUD)
DROP POLICY IF EXISTS "report_templates_select_own" ON report_templates;
DROP POLICY IF EXISTS "report_templates_insert_own" ON report_templates;
DROP POLICY IF EXISTS "report_templates_update_own" ON report_templates;
DROP POLICY IF EXISTS "report_templates_delete_own" ON report_templates;

-- supplier_locations (garder ALL, supprimer 4 CRUD)
DROP POLICY IF EXISTS "supplier_locations_select" ON supplier_locations;
DROP POLICY IF EXISTS "supplier_locations_insert" ON supplier_locations;
DROP POLICY IF EXISTS "supplier_locations_update" ON supplier_locations;
DROP POLICY IF EXISTS "supplier_locations_delete" ON supplier_locations;

-- supplier_reports_cache (garder ALL, supprimer INSERT+SELECT)
DROP POLICY IF EXISTS "supplier_reports_cache_insert_own" ON supplier_reports_cache;
DROP POLICY IF EXISTS "supplier_reports_cache_select_own" ON supplier_reports_cache;

-- credit_note_items (garder ALL, supprimer SELECT redondant)
DROP POLICY IF EXISTS "Users can view own credit note items" ON credit_note_items;

-- delivery_note_items (garder ALL, supprimer SELECT redondant)
DROP POLICY IF EXISTS "Users can view own delivery note items" ON delivery_note_items;

-- delivery_routes (garder les CRUD spécifiques qui sont plus précis, supprimer ALL trop permissif)
DROP POLICY IF EXISTS "Users can manage delivery routes" ON delivery_routes;

-- product_barcodes (garder les CRUD spécifiques, supprimer ALL+ancien SELECT)
DROP POLICY IF EXISTS "Users can manage barcodes" ON product_barcodes;
DROP POLICY IF EXISTS "Authenticated users can view barcodes" ON product_barcodes;

-- =====================================================
-- TYPE 2: Doublons purs (garder snake_case, supprimer ancien nommage)
-- =====================================================

-- clients
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

-- company (garder snake_case, supprimer ancien - pas de doublon DELETE)
DROP POLICY IF EXISTS "Users can view own company" ON company;
DROP POLICY IF EXISTS "Users can insert own company" ON company;
DROP POLICY IF EXISTS "Users can update own company" ON company;

-- invoices
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON invoices;

-- invoice_items
DROP POLICY IF EXISTS "Users can view invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can insert invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items" ON invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items" ON invoice_items;

-- notifications
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;

-- payment_terms
DROP POLICY IF EXISTS "Users can view own payment terms" ON payment_terms;
DROP POLICY IF EXISTS "Users can insert own payment terms" ON payment_terms;
DROP POLICY IF EXISTS "Users can update own payment terms" ON payment_terms;
DROP POLICY IF EXISTS "Users can delete own payment terms" ON payment_terms;

-- projects
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
DROP POLICY IF EXISTS "Users can insert own projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON projects;

-- purchase_orders
DROP POLICY IF EXISTS "Users can view own purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can insert own purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can update own purchase_orders" ON purchase_orders;
DROP POLICY IF EXISTS "Users can delete own purchase_orders" ON purchase_orders;

-- quotes
DROP POLICY IF EXISTS "Users can view own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can update own quotes" ON quotes;
DROP POLICY IF EXISTS "Users can delete own quotes" ON quotes;

-- subtasks
DROP POLICY IF EXISTS "Users can view subtasks for their project tasks" ON subtasks;
DROP POLICY IF EXISTS "Users can insert subtasks for their project tasks" ON subtasks;
DROP POLICY IF EXISTS "Users can update subtasks for their project tasks" ON subtasks;
DROP POLICY IF EXISTS "Users can delete subtasks for their project tasks" ON subtasks;

-- tasks
DROP POLICY IF EXISTS "Users can view tasks for their projects" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks for their projects" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks for their projects" ON tasks;
DROP POLICY IF EXISTS "Users can delete tasks for their projects" ON tasks;

-- timesheets
DROP POLICY IF EXISTS "Users can view own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can insert own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can update own timesheets" ON timesheets;
DROP POLICY IF EXISTS "Users can delete own timesheets" ON timesheets;

-- suppliers
DROP POLICY IF EXISTS "Users can view own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can insert own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can update own suppliers" ON suppliers;
DROP POLICY IF EXISTS "Users can delete own suppliers" ON suppliers;

-- supplier_invoices
DROP POLICY IF EXISTS "Users can view invoices of own suppliers" ON supplier_invoices;
DROP POLICY IF EXISTS "Users can insert invoices for own suppliers" ON supplier_invoices;
DROP POLICY IF EXISTS "Users can update invoices for own suppliers" ON supplier_invoices;
DROP POLICY IF EXISTS "Users can delete invoices for own suppliers" ON supplier_invoices;

-- supplier_orders
DROP POLICY IF EXISTS "Users can view own supplier orders" ON supplier_orders;
DROP POLICY IF EXISTS "Users can insert own supplier orders" ON supplier_orders;
DROP POLICY IF EXISTS "Users can update own supplier orders" ON supplier_orders;
DROP POLICY IF EXISTS "Users can delete own supplier orders" ON supplier_orders;

-- supplier_order_items
DROP POLICY IF EXISTS "Users can view items of own orders" ON supplier_order_items;
DROP POLICY IF EXISTS "Users can insert items for own orders" ON supplier_order_items;
DROP POLICY IF EXISTS "Users can update items for own orders" ON supplier_order_items;
DROP POLICY IF EXISTS "Users can delete items for own orders" ON supplier_order_items;

-- supplier_product_categories
DROP POLICY IF EXISTS "Users can view own product categories" ON supplier_product_categories;
DROP POLICY IF EXISTS "Users can insert own product categories" ON supplier_product_categories;
DROP POLICY IF EXISTS "Users can update own product categories" ON supplier_product_categories;
DROP POLICY IF EXISTS "Users can delete own product categories" ON supplier_product_categories;

-- supplier_products
DROP POLICY IF EXISTS "Users can view products of own suppliers" ON supplier_products;
DROP POLICY IF EXISTS "Users can insert products for own suppliers" ON supplier_products;
DROP POLICY IF EXISTS "Users can update products for own suppliers" ON supplier_products;
DROP POLICY IF EXISTS "Users can delete products for own suppliers" ON supplier_products;

-- supplier_services
DROP POLICY IF EXISTS "Users can view services of own suppliers" ON supplier_services;
DROP POLICY IF EXISTS "Users can insert services for own suppliers" ON supplier_services;
DROP POLICY IF EXISTS "Users can update services for own suppliers" ON supplier_services;
DROP POLICY IF EXISTS "Users can delete services for own suppliers" ON supplier_services;

-- push_notification_logs (doublon SELECT)
DROP POLICY IF EXISTS "Users can view own push logs" ON push_notification_logs;

-- =====================================================
-- TYPE 3: profiles - nettoyage des doublons multiples
-- Garder: profiles_select_own, profiles_insert_own, profiles_update_own, profiles_delete_own
-- Garder: "Admins can view all profiles (roles)" (policy admin spéciale)
-- Supprimer les anciennes avec nommage différent
-- =====================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "read_own_profile" ON profiles;
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
;
