-- Migration: fn_hr_leave_balance + default_annual_entitlement
-- Replaces hardcoded 25-day entitlement and client-side computeBalance

ALTER TABLE public.hr_leave_types
  ADD COLUMN IF NOT EXISTS default_annual_entitlement NUMERIC(8,2) NOT NULL DEFAULT 25;

COMMENT ON COLUMN public.hr_leave_types.default_annual_entitlement
  IS 'Default annual entitlement in days for this leave type';

CREATE OR REPLACE FUNCTION public.fn_hr_leave_balance(
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  leave_type_id UUID,
  leave_type_name TEXT,
  entitled NUMERIC(8,2),
  used NUMERIC(8,2),
  pending NUMERIC(8,2),
  remaining NUMERIC(8,2)
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    e.id AS employee_id,
    e.full_name AS employee_name,
    lt.id AS leave_type_id,
    lt.name AS leave_type_name,
    lt.default_annual_entitlement AS entitled,
    COALESCE(SUM(lr.total_days) FILTER (
      WHERE lr.status = 'approved'
        AND EXTRACT(YEAR FROM lr.start_date) = p_year
    ), 0) AS used,
    COALESCE(SUM(lr.total_days) FILTER (
      WHERE lr.status = 'pending'
        AND EXTRACT(YEAR FROM lr.start_date) = p_year
    ), 0) AS pending,
    lt.default_annual_entitlement - COALESCE(SUM(lr.total_days) FILTER (
      WHERE lr.status = 'approved'
        AND EXTRACT(YEAR FROM lr.start_date) = p_year
    ), 0) AS remaining
  FROM hr_employees e
  CROSS JOIN hr_leave_types lt
  LEFT JOIN hr_leave_requests lr
    ON lr.employee_id = e.id
   AND lr.leave_type_id = lt.id
  WHERE e.status = 'active'
    AND lt.company_id = e.company_id
  GROUP BY e.id, e.full_name, lt.id, lt.name, lt.default_annual_entitlement;
$$;
