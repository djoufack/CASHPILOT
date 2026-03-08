-- ============================================================================
-- PORTFOLIO CROSS-COMPANY RPC FUNCTIONS
-- The company_scope_guard RESTRICTIVE RLS policies prevent the portfolio page
-- from reading data across multiple companies. These SECURITY DEFINER functions
-- bypass RLS to return data for ALL companies belonging to the authenticated user.
-- ============================================================================

-- 1. Portfolio invoices — returns all invoices for all user companies
CREATE OR REPLACE FUNCTION get_portfolio_invoices()
RETURNS TABLE (
  id UUID,
  company_id UUID,
  invoice_number TEXT,
  total_ttc NUMERIC,
  balance_due NUMERIC,
  status TEXT,
  payment_status TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ,
  client_company_name TEXT,
  client_contact_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.company_id, i.invoice_number, i.total_ttc, i.balance_due,
    i.status, i.payment_status, i.due_date, i.created_at,
    c.company_name AS client_company_name,
    c.contact_name AS client_contact_name
  FROM invoices i
  LEFT JOIN clients c ON c.id = i.client_id
  WHERE i.user_id = auth.uid();
END;
$$;

-- 2. Portfolio payments — returns all payments for all user companies
CREATE OR REPLACE FUNCTION get_portfolio_payments()
RETURNS TABLE (
  id UUID,
  company_id UUID,
  amount NUMERIC,
  payment_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.company_id, p.amount, p.payment_date
  FROM payments p
  WHERE p.user_id = auth.uid();
END;
$$;

-- 3. Portfolio projects — returns all projects for all user companies
CREATE OR REPLACE FUNCTION get_portfolio_projects()
RETURNS TABLE (
  id UUID,
  company_id UUID,
  name TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pr.id, pr.company_id, pr.name, pr.status, pr.created_at
  FROM projects pr
  WHERE pr.user_id = auth.uid();
END;
$$;

-- 4. Portfolio quotes — returns all quotes for all user companies
CREATE OR REPLACE FUNCTION get_portfolio_quotes()
RETURNS TABLE (
  id UUID,
  company_id UUID,
  quote_number TEXT,
  total_ttc NUMERIC,
  status TEXT,
  created_at TIMESTAMPTZ,
  client_company_name TEXT,
  client_contact_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id, q.company_id, q.quote_number, q.total_ttc, q.status, q.created_at,
    c.company_name AS client_company_name,
    c.contact_name AS client_contact_name
  FROM quotes q
  LEFT JOIN clients c ON c.id = q.client_id
  WHERE q.user_id = auth.uid();
END;
$$;

COMMENT ON FUNCTION get_portfolio_invoices() IS 'Returns all invoices across all companies for the authenticated user, bypassing company_scope_guard RLS';
COMMENT ON FUNCTION get_portfolio_payments() IS 'Returns all payments across all companies for the authenticated user, bypassing company_scope_guard RLS';
COMMENT ON FUNCTION get_portfolio_projects() IS 'Returns all projects across all companies for the authenticated user, bypassing company_scope_guard RLS';
COMMENT ON FUNCTION get_portfolio_quotes() IS 'Returns all quotes across all companies for the authenticated user, bypassing company_scope_guard RLS';
