-- Migration: Add missing FK constraints and fix delete rules
-- Date: 2026-03-08

-- ============================================================
-- 0. CLEAN UP ORPHAN DATA (required before adding/revalidating FK constraints)
-- ============================================================

-- Nullify orphan product_id in stock_alerts
UPDATE stock_alerts SET product_id = NULL
WHERE product_id IS NOT NULL AND product_id NOT IN (SELECT id FROM products);

-- Nullify orphan user_product_id in stock_alerts
UPDATE stock_alerts SET user_product_id = NULL
WHERE user_product_id IS NOT NULL AND user_product_id NOT IN (SELECT id FROM products);

-- Nullify orphan product_id in product_stock_history
UPDATE product_stock_history SET product_id = NULL
WHERE product_id IS NOT NULL AND product_id NOT IN (SELECT id FROM products);

-- Nullify orphan user_product_id in product_stock_history
UPDATE product_stock_history SET user_product_id = NULL
WHERE user_product_id IS NOT NULL AND user_product_id NOT IN (SELECT id FROM products);

-- Nullify orphan order_id in product_stock_history
UPDATE product_stock_history SET order_id = NULL
WHERE order_id IS NOT NULL AND order_id NOT IN (SELECT id FROM supplier_orders);

-- ============================================================
-- 1. REMOVE DUPLICATE FK CONSTRAINTS ON user_product_id (do first to avoid revalidation issues)
-- ============================================================

-- product_stock_history: drop duplicate fk_stock_history_product (keep product_stock_history_user_product_id_fkey)
ALTER TABLE product_stock_history DROP CONSTRAINT IF EXISTS fk_stock_history_product;

-- stock_alerts: drop duplicate fk_stock_alerts_product (keep stock_alerts_user_product_id_fkey)
ALTER TABLE stock_alerts DROP CONSTRAINT IF EXISTS fk_stock_alerts_product;

-- ============================================================
-- 2. ADD MISSING FK CONSTRAINTS
-- ============================================================

-- stock_alerts.product_id → products(id) ON DELETE CASCADE
ALTER TABLE stock_alerts
  ADD CONSTRAINT fk_stock_alerts_product_id
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- product_stock_history.product_id → products(id) ON DELETE CASCADE
ALTER TABLE product_stock_history
  ADD CONSTRAINT fk_product_stock_history_product
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- product_stock_history.order_id → supplier_orders(id) ON DELETE SET NULL
ALTER TABLE product_stock_history
  ADD CONSTRAINT fk_product_stock_history_order
  FOREIGN KEY (order_id) REFERENCES supplier_orders(id) ON DELETE SET NULL;

-- deleted_data_snapshots.company_id → company(id) ON DELETE CASCADE
ALTER TABLE deleted_data_snapshots
  ADD CONSTRAINT fk_deleted_data_snapshots_company
  FOREIGN KEY (company_id) REFERENCES company(id) ON DELETE CASCADE;

-- ============================================================
-- 3. FIX DELETE RULES ON EXISTING FK CONSTRAINTS
-- ============================================================

-- tasks.project_id → projects: NO ACTION → CASCADE
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;

-- timesheets.task_id → tasks: NO ACTION → SET NULL
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_task_id_fkey;
ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL;

-- timesheets.project_id → projects: NO ACTION → SET NULL
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_project_id_fkey;
ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

-- delivery_routes.order_id → supplier_orders: NO ACTION → CASCADE
ALTER TABLE delivery_routes DROP CONSTRAINT IF EXISTS delivery_routes_order_id_fkey;
ALTER TABLE delivery_routes
  ADD CONSTRAINT delivery_routes_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES supplier_orders(id) ON DELETE CASCADE;

-- delivery_routes.supplier_location_id → supplier_locations: NO ACTION → SET NULL
ALTER TABLE delivery_routes DROP CONSTRAINT IF EXISTS delivery_routes_supplier_location_id_fkey;
ALTER TABLE delivery_routes
  ADD CONSTRAINT delivery_routes_supplier_location_id_fkey
  FOREIGN KEY (supplier_location_id) REFERENCES supplier_locations(id) ON DELETE SET NULL;

-- api_keys.superseded_by → api_keys: NO ACTION → SET NULL
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_superseded_by_fkey;
ALTER TABLE api_keys
  ADD CONSTRAINT api_keys_superseded_by_fkey
  FOREIGN KEY (superseded_by) REFERENCES api_keys(id) ON DELETE SET NULL;
