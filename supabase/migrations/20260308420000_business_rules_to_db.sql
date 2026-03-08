-- Migration: Move critical business rules from frontend JS to database
-- Source files: src/shared/canonicalDashboardSnapshot.js, src/utils/calculations.js

-- ============================================================
-- A. Invoice status classification (reference table)
-- Replaces hardcoded sets in canonicalDashboardSnapshot.js lines 1-4
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_status_config (
  status TEXT PRIMARY KEY,
  is_billable BOOLEAN NOT NULL DEFAULT false,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  is_collected BOOLEAN NOT NULL DEFAULT false,
  display_color TEXT,
  display_bg TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

ALTER TABLE invoice_status_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_status_config_read_all"
  ON invoice_status_config FOR SELECT
  USING (true);

INSERT INTO invoice_status_config (status, is_billable, is_booked, is_collected, display_color, display_bg, sort_order) VALUES
  ('draft',     false, false, false, 'text-gray-400',   'bg-gray-500/10',   1),
  ('sent',      true,  true,  false, 'text-blue-400',   'bg-blue-500/10',   2),
  ('partial',   true,  true,  false, 'text-yellow-400', 'bg-yellow-500/10', 3),
  ('paid',      true,  true,  true,  'text-green-400',  'bg-green-500/10',  4),
  ('overdue',   true,  true,  false, 'text-red-400',    'bg-red-500/10',    5),
  ('cancelled', false, false, false, 'text-gray-500',   'bg-gray-500/10',   6)
ON CONFLICT (status) DO NOTHING;

-- ============================================================
-- B. Invoice status transitions (state machine)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_status_transitions (
  from_status TEXT NOT NULL REFERENCES invoice_status_config(status),
  to_status TEXT NOT NULL REFERENCES invoice_status_config(status),
  PRIMARY KEY (from_status, to_status)
);

ALTER TABLE invoice_status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_status_transitions_read_all"
  ON invoice_status_transitions FOR SELECT
  USING (true);

INSERT INTO invoice_status_transitions (from_status, to_status) VALUES
  ('draft',   'sent'),      ('draft',   'cancelled'),
  ('sent',    'paid'),      ('sent',    'partial'),   ('sent',    'overdue'),  ('sent',    'cancelled'),
  ('partial', 'paid'),      ('partial', 'overdue'),   ('partial', 'cancelled'),
  ('overdue', 'paid'),      ('overdue', 'partial'),   ('overdue', 'cancelled')
ON CONFLICT DO NOTHING;

-- ============================================================
-- C. Payment status determination function
-- Mirrors getPaymentStatus() in src/utils/calculations.js lines 202-209
-- ============================================================
CREATE OR REPLACE FUNCTION determine_payment_status(p_amount_paid NUMERIC, p_total NUMERIC)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_amount_paid, 0) <= 0 THEN 'unpaid'
    WHEN p_amount_paid < p_total THEN 'partial'
    WHEN p_amount_paid = p_total THEN 'paid'
    ELSE 'overpaid'
  END;
$$;

-- ============================================================
-- D. Dashboard revenue views
-- Replaces inline computation in canonicalDashboardSnapshot.js
-- ============================================================
CREATE OR REPLACE VIEW v_booked_revenue AS
SELECT i.company_id, i.user_id,
  DATE_TRUNC('month', i.date) AS month,
  SUM(i.total_ttc) AS revenue
FROM invoices i
JOIN invoice_status_config isc ON i.status = isc.status
WHERE isc.is_booked = true
GROUP BY i.company_id, i.user_id, DATE_TRUNC('month', i.date);

CREATE OR REPLACE VIEW v_collected_revenue AS
SELECT i.company_id, i.user_id,
  DATE_TRUNC('month', i.date) AS month,
  SUM(i.amount_paid) AS revenue
FROM invoices i
JOIN invoice_status_config isc ON i.status = isc.status
WHERE isc.is_collected = true
GROUP BY i.company_id, i.user_id, DATE_TRUNC('month', i.date);
