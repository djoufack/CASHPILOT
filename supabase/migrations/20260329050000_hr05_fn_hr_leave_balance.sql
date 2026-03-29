-- HR-05: Create fn_hr_leave_balance RPC function
-- useAbsences.js calls supabase.rpc('fn_hr_leave_balance', { p_year }) to populate
-- the Soldes (leave balance) tab in AbsencesPage.jsx.
-- This function was missing from the DB, causing a silent empty result.
-- Returns one row per (employee, leave_type) for the current company of the caller.

CREATE OR REPLACE FUNCTION public.fn_hr_leave_balance(
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  employee_id    UUID,
  leave_type_id  UUID,
  year           INTEGER,
  entitled       NUMERIC,
  used           NUMERIC,
  remaining      NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID;
  v_company_id UUID;
BEGIN
  -- Resolve caller → company (ENF-2: company scope via auth.uid())
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_company_id
  FROM public.company c
  WHERE c.user_id = v_user_id
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    e.id                                          AS employee_id,
    lt.id                                         AS leave_type_id,
    p_year                                        AS year,
    -- Entitled: use explicit entitlement record if exists, else default from leave_type
    COALESCE(
      (SELECT SUM(lbe.entitled_days)
       FROM public.hr_leave_balance_entries lbe
       WHERE lbe.employee_id = e.id
         AND lbe.leave_type_id = lt.id
         AND lbe.year = p_year),
      lt.default_annual_entitlement,
      0
    )::NUMERIC                                    AS entitled,
    -- Used: sum of approved leave days this year
    COALESCE(
      (SELECT SUM(lr.total_days)
       FROM public.hr_leave_requests lr
       WHERE lr.employee_id = e.id
         AND lr.leave_type_id = lt.id
         AND lr.status = 'approved'
         AND EXTRACT(YEAR FROM lr.start_date) = p_year),
      0
    )::NUMERIC                                    AS used,
    -- Remaining
    GREATEST(
      0,
      COALESCE(
        (SELECT SUM(lbe.entitled_days)
         FROM public.hr_leave_balance_entries lbe
         WHERE lbe.employee_id = e.id
           AND lbe.leave_type_id = lt.id
           AND lbe.year = p_year),
        lt.default_annual_entitlement,
        0
      ) - COALESCE(
        (SELECT SUM(lr.total_days)
         FROM public.hr_leave_requests lr
         WHERE lr.employee_id = e.id
           AND lr.leave_type_id = lt.id
           AND lr.status = 'approved'
           AND EXTRACT(YEAR FROM lr.start_date) = p_year),
        0
      )
    )::NUMERIC                                    AS remaining
  FROM public.hr_employees e
  CROSS JOIN public.hr_leave_types lt
  WHERE e.company_id = v_company_id
    AND e.status = 'active'
    AND lt.company_id = v_company_id
  ORDER BY e.full_name, lt.name;
END;
$$;

-- Create a lightweight entitlement override table used by fn_hr_leave_balance
-- (allows HR to manually adjust entitlements per employee/year).
CREATE TABLE IF NOT EXISTS public.hr_leave_balance_entries (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  employee_id     UUID NOT NULL REFERENCES public.hr_employees(id) ON DELETE CASCADE,
  leave_type_id   UUID NOT NULL REFERENCES public.hr_leave_types(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  entitled_days   NUMERIC NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, leave_type_id, year)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_balance_entries_company
  ON public.hr_leave_balance_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_balance_entries_employee
  ON public.hr_leave_balance_entries(employee_id);

ALTER TABLE public.hr_leave_balance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hr_leave_balance_entries_company_access"
  ON public.hr_leave_balance_entries FOR ALL
  USING (
    company_id IN (
      SELECT c.id FROM public.company c WHERE c.user_id = auth.uid()
    )
  );

COMMENT ON FUNCTION public.fn_hr_leave_balance(INTEGER)
  IS 'Returns leave balances (entitled/used/remaining) per active employee × leave type '
     'for the active company of the calling user. Year defaults to current year.';

COMMENT ON TABLE public.hr_leave_balance_entries
  IS 'Optional manual entitlement overrides per employee/leave_type/year. '
     'fn_hr_leave_balance falls back to hr_leave_types.default_annual_entitlement when absent. (ENF-1)';
