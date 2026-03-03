-- =====================================================================
-- Runtime fix: scope core business entities by company
-- Date: 2026-03-03
-- =====================================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.timesheets
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_company_id ON public.projects(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON public.expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_company_id ON public.timesheets(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);

ALTER TABLE public.clients DISABLE TRIGGER USER;
ALTER TABLE public.projects DISABLE TRIGGER USER;
ALTER TABLE public.invoices DISABLE TRIGGER USER;
ALTER TABLE public.quotes DISABLE TRIGGER USER;
ALTER TABLE public.expenses DISABLE TRIGGER USER;
ALTER TABLE public.timesheets DISABLE TRIGGER USER;
ALTER TABLE public.payments DISABLE TRIGGER USER;

WITH preferred_company AS (
  SELECT
    c.user_id,
    COALESCE(
      ucp.active_company_id,
      MIN(c.id::text)::UUID
    ) AS company_id
  FROM public.company c
  LEFT JOIN public.user_company_preferences ucp ON ucp.user_id = c.user_id
  GROUP BY c.user_id, ucp.active_company_id
)
UPDATE public.clients cl
SET company_id = pc.company_id
FROM preferred_company pc
WHERE cl.user_id = pc.user_id
  AND cl.company_id IS NULL;

WITH preferred_company AS (
  SELECT
    c.user_id,
    COALESCE(
      ucp.active_company_id,
      MIN(c.id::text)::UUID
    ) AS company_id
  FROM public.company c
  LEFT JOIN public.user_company_preferences ucp ON ucp.user_id = c.user_id
  GROUP BY c.user_id, ucp.active_company_id
)
UPDATE public.projects p
SET company_id = COALESCE(
  (
    SELECT cl.company_id
    FROM public.clients cl
    WHERE cl.id = p.client_id
  ),
  pc.company_id
)
FROM preferred_company pc
WHERE p.user_id = pc.user_id
  AND p.company_id IS NULL;

WITH preferred_company AS (
  SELECT
    c.user_id,
    COALESCE(
      ucp.active_company_id,
      MIN(c.id::text)::UUID
    ) AS company_id
  FROM public.company c
  LEFT JOIN public.user_company_preferences ucp ON ucp.user_id = c.user_id
  GROUP BY c.user_id, ucp.active_company_id
)
UPDATE public.invoices i
SET company_id = COALESCE(
  (
    SELECT cl.company_id
    FROM public.clients cl
    WHERE cl.id = i.client_id
  ),
  pc.company_id
)
FROM preferred_company pc
WHERE i.user_id = pc.user_id
  AND i.company_id IS NULL;

WITH preferred_company AS (
  SELECT
    c.user_id,
    COALESCE(
      ucp.active_company_id,
      MIN(c.id::text)::UUID
    ) AS company_id
  FROM public.company c
  LEFT JOIN public.user_company_preferences ucp ON ucp.user_id = c.user_id
  GROUP BY c.user_id, ucp.active_company_id
)
UPDATE public.quotes q
SET company_id = COALESCE(
  (
    SELECT cl.company_id
    FROM public.clients cl
    WHERE cl.id = q.client_id
  ),
  pc.company_id
)
FROM preferred_company pc
WHERE q.user_id = pc.user_id
  AND q.company_id IS NULL;

WITH preferred_company AS (
  SELECT
    c.user_id,
    COALESCE(
      ucp.active_company_id,
      MIN(c.id::text)::UUID
    ) AS company_id
  FROM public.company c
  LEFT JOIN public.user_company_preferences ucp ON ucp.user_id = c.user_id
  GROUP BY c.user_id, ucp.active_company_id
)
UPDATE public.expenses e
SET company_id = COALESCE(
  (
    SELECT cl.company_id
    FROM public.clients cl
    WHERE cl.id = e.client_id
  ),
  pc.company_id
)
FROM preferred_company pc
WHERE e.user_id = pc.user_id
  AND e.company_id IS NULL;

WITH preferred_company AS (
  SELECT
    c.user_id,
    COALESCE(
      ucp.active_company_id,
      MIN(c.id::text)::UUID
    ) AS company_id
  FROM public.company c
  LEFT JOIN public.user_company_preferences ucp ON ucp.user_id = c.user_id
  GROUP BY c.user_id, ucp.active_company_id
)
UPDATE public.timesheets t
SET company_id = COALESCE(
  (
    SELECT p.company_id
    FROM public.projects p
    WHERE p.id = t.project_id
  ),
  (
    SELECT cl.company_id
    FROM public.clients cl
    WHERE cl.id = t.client_id
  ),
  pc.company_id
)
FROM preferred_company pc
WHERE t.user_id = pc.user_id
  AND t.company_id IS NULL;

WITH preferred_company AS (
  SELECT
    c.user_id,
    COALESCE(
      ucp.active_company_id,
      MIN(c.id::text)::UUID
    ) AS company_id
  FROM public.company c
  LEFT JOIN public.user_company_preferences ucp ON ucp.user_id = c.user_id
  GROUP BY c.user_id, ucp.active_company_id
)
UPDATE public.payments p
SET company_id = COALESCE(
  (
    SELECT inv.company_id
    FROM public.invoices inv
    WHERE inv.id = p.invoice_id
  ),
  (
    SELECT cl.company_id
    FROM public.clients cl
    WHERE cl.id = p.client_id
  ),
  pc.company_id
)
FROM preferred_company pc
WHERE p.user_id = pc.user_id
  AND p.company_id IS NULL;

ALTER TABLE public.clients ENABLE TRIGGER USER;
ALTER TABLE public.projects ENABLE TRIGGER USER;
ALTER TABLE public.invoices ENABLE TRIGGER USER;
ALTER TABLE public.quotes ENABLE TRIGGER USER;
ALTER TABLE public.expenses ENABLE TRIGGER USER;
ALTER TABLE public.timesheets ENABLE TRIGGER USER;
ALTER TABLE public.payments ENABLE TRIGGER USER;
