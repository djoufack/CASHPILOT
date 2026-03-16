-- ENF-2 fix: Add company_id to consolidation_snapshots
-- For consolidation, company_id represents the parent/holding company owning the portfolio

ALTER TABLE public.consolidation_snapshots
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id) ON DELETE CASCADE;

-- Backfill company_id from portfolio's first member (if any exist)
UPDATE public.consolidation_snapshots cs
SET company_id = (
  SELECT cpm.company_id
  FROM public.company_portfolio_members cpm
  WHERE cpm.portfolio_id = cs.portfolio_id
  LIMIT 1
)
WHERE cs.company_id IS NULL;

-- Create index on company_id
CREATE INDEX IF NOT EXISTS idx_consolidation_snapshots_company_id
  ON public.consolidation_snapshots (company_id)
  WHERE company_id IS NOT NULL;
