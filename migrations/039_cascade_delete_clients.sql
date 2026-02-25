-- Migration: Change all FK constraints referencing clients to ON DELETE CASCADE
-- When a client is deleted, all related records (invoices, projects, etc.) are also deleted

-- 1. projects_client_id_fkey (NO ACTION → CASCADE)
ALTER TABLE projects DROP CONSTRAINT projects_client_id_fkey;
ALTER TABLE projects ADD CONSTRAINT projects_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 2. invoices_client_id_fkey (NO ACTION → CASCADE)
ALTER TABLE invoices DROP CONSTRAINT invoices_client_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 3. quotes_client_id_fkey (NO ACTION → CASCADE)
ALTER TABLE quotes DROP CONSTRAINT quotes_client_id_fkey;
ALTER TABLE quotes ADD CONSTRAINT quotes_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 4. expenses_client_id_fkey (NO ACTION → CASCADE)
ALTER TABLE expenses DROP CONSTRAINT expenses_client_id_fkey;
ALTER TABLE expenses ADD CONSTRAINT expenses_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 5. recurring_invoices_client_id_fkey (NO ACTION → CASCADE)
ALTER TABLE recurring_invoices DROP CONSTRAINT recurring_invoices_client_id_fkey;
ALTER TABLE recurring_invoices ADD CONSTRAINT recurring_invoices_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 6. timesheets_client_id_fkey (NO ACTION → CASCADE)
ALTER TABLE timesheets DROP CONSTRAINT timesheets_client_id_fkey;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 7. delivery_routes_delivery_location_id_fkey (NO ACTION → CASCADE)
ALTER TABLE delivery_routes DROP CONSTRAINT delivery_routes_delivery_location_id_fkey;
ALTER TABLE delivery_routes ADD CONSTRAINT delivery_routes_delivery_location_id_fkey
  FOREIGN KEY (delivery_location_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 8. payments_client_id_fkey (SET NULL → CASCADE)
ALTER TABLE payments DROP CONSTRAINT payments_client_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 9. credit_notes_client_id_fkey (SET NULL → CASCADE)
ALTER TABLE credit_notes DROP CONSTRAINT credit_notes_client_id_fkey;
ALTER TABLE credit_notes ADD CONSTRAINT credit_notes_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 10. delivery_notes_client_id_fkey (SET NULL → CASCADE)
ALTER TABLE delivery_notes DROP CONSTRAINT delivery_notes_client_id_fkey;
ALTER TABLE delivery_notes ADD CONSTRAINT delivery_notes_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 11. purchase_orders_client_id_fkey (SET NULL → CASCADE)
ALTER TABLE purchase_orders DROP CONSTRAINT purchase_orders_client_id_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
