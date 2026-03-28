-- BUY-03: Supplier performance score (quality, delivery, cost)
-- Scope: company-owned supplier analytics with RLS and server-side refresh logic.

CREATE TABLE IF NOT EXISTS public.supplier_performance_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  quality_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  delivery_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  cost_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  global_score NUMERIC(5, 2) NOT NULL DEFAULT 100,
  score_band TEXT NOT NULL DEFAULT 'A',
  total_orders_count INTEGER NOT NULL DEFAULT 0,
  delivered_orders_count INTEGER NOT NULL DEFAULT 0,
  matched_invoices_count INTEGER NOT NULL DEFAULT 0,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT supplier_performance_scores_company_supplier_unique UNIQUE (company_id, supplier_id),
  CONSTRAINT supplier_performance_scores_quality_score_chk CHECK (quality_score BETWEEN 0 AND 100),
  CONSTRAINT supplier_performance_scores_delivery_score_chk CHECK (delivery_score BETWEEN 0 AND 100),
  CONSTRAINT supplier_performance_scores_cost_score_chk CHECK (cost_score BETWEEN 0 AND 100),
  CONSTRAINT supplier_performance_scores_global_score_chk CHECK (global_score BETWEEN 0 AND 100),
  CONSTRAINT supplier_performance_scores_score_band_chk CHECK (score_band IN ('A', 'B', 'C', 'D', 'E'))
);

CREATE INDEX IF NOT EXISTS idx_supplier_performance_scores_company_id
  ON public.supplier_performance_scores(company_id);

CREATE INDEX IF NOT EXISTS idx_supplier_performance_scores_supplier_id
  ON public.supplier_performance_scores(supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_performance_scores_global_score
  ON public.supplier_performance_scores(global_score DESC);

CREATE INDEX IF NOT EXISTS idx_supplier_performance_scores_score_band
  ON public.supplier_performance_scores(score_band);

CREATE OR REPLACE FUNCTION public.supplier_score_band_from_global(p_global NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_global NUMERIC := GREATEST(0, LEAST(100, COALESCE(p_global, 0)));
BEGIN
  IF v_global >= 90 THEN
    RETURN 'A';
  ELSIF v_global >= 80 THEN
    RETURN 'B';
  ELSIF v_global >= 70 THEN
    RETURN 'C';
  ELSIF v_global >= 60 THEN
    RETURN 'D';
  END IF;

  RETURN 'E';
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_compute_global_score(
  p_quality NUMERIC,
  p_delivery NUMERIC,
  p_cost NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_global NUMERIC;
BEGIN
  v_global := (
    COALESCE(p_quality, 0) * 0.40
    + COALESCE(p_delivery, 0) * 0.30
    + COALESCE(p_cost, 0) * 0.30
  );

  RETURN ROUND(GREATEST(0, LEAST(100, v_global)), 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_performance_scores_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_refresh_performance_score(
  p_supplier_id UUID,
  p_skip_auth BOOLEAN DEFAULT FALSE
)
RETURNS public.supplier_performance_scores
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_supplier public.suppliers%ROWTYPE;
  v_company_owner_id UUID;
  v_total_orders_count INTEGER := 0;
  v_delivered_orders_count INTEGER := 0;
  v_delivery_eval_count INTEGER := 0;
  v_delivery_on_time_count INTEGER := 0;
  v_delivery_score NUMERIC := 100;
  v_quality_score NUMERIC := 100;
  v_quality_count INTEGER := 0;
  v_matched_invoices_count INTEGER := 0;
  v_cost_score NUMERIC := 100;
  v_cost_count INTEGER := 0;
  v_cost_penalty_avg NUMERIC := NULL;
  v_global_score NUMERIC := 100;
  v_score_band TEXT := 'A';
  v_details JSONB := '{}'::jsonb;
  v_result public.supplier_performance_scores%ROWTYPE;
BEGIN
  SELECT *
  INTO v_supplier
  FROM public.suppliers
  WHERE id = p_supplier_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier % not found', p_supplier_id;
  END IF;

  SELECT c.user_id
  INTO v_company_owner_id
  FROM public.company c
  WHERE c.id = v_supplier.company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company % not found for supplier %', v_supplier.company_id, p_supplier_id;
  END IF;

  IF NOT p_skip_auth THEN
    IF auth.uid() IS NULL OR auth.uid() <> v_company_owner_id THEN
      RAISE EXCEPTION 'Not authorized to refresh performance score for supplier %', p_supplier_id;
    END IF;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE so.actual_delivery_date IS NOT NULL)::INTEGER,
    COUNT(*) FILTER (
      WHERE so.expected_delivery_date IS NOT NULL
        AND so.actual_delivery_date IS NOT NULL
        AND so.actual_delivery_date::date <= so.expected_delivery_date::date
    )::INTEGER,
    COUNT(*) FILTER (WHERE so.expected_delivery_date IS NOT NULL)::INTEGER
  INTO
    v_total_orders_count,
    v_delivered_orders_count,
    v_delivery_on_time_count,
    v_delivery_eval_count
  FROM public.supplier_orders so
  WHERE so.supplier_id = p_supplier_id
    AND so.company_id = v_supplier.company_id;

  IF v_delivery_eval_count > 0 THEN
    v_delivery_score := ROUND((v_delivery_on_time_count::NUMERIC / v_delivery_eval_count::NUMERIC) * 100, 2);
  ELSE
    v_delivery_score := 100;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE si.three_way_match_score IS NOT NULL)::INTEGER,
    COALESCE(ROUND(AVG(si.three_way_match_score)::NUMERIC, 2), 100),
    COUNT(*) FILTER (WHERE si.three_way_match_status = 'matched')::INTEGER
  INTO
    v_quality_count,
    v_quality_score,
    v_matched_invoices_count
  FROM public.supplier_invoices si
  WHERE si.supplier_id = p_supplier_id
    AND si.company_id = v_supplier.company_id;

  IF v_quality_count = 0 THEN
    v_quality_score := 100;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE m.ordered_total_amount > 0)::INTEGER,
    COALESCE(
      ROUND(
        AVG(
          CASE
            WHEN m.ordered_total_amount > 0 THEN
              LEAST(
                100,
                ABS(COALESCE(m.invoiced_total_amount, 0) - COALESCE(m.ordered_total_amount, 0)) * 100
                / NULLIF(m.ordered_total_amount, 0)
              )
            ELSE NULL
          END
        )::NUMERIC,
        2
      ),
      NULL
    )
  INTO
    v_cost_count,
    v_cost_penalty_avg
  FROM public.supplier_invoice_three_way_matches m
  JOIN public.supplier_invoices si ON si.id = m.supplier_invoice_id
  WHERE si.supplier_id = p_supplier_id
    AND m.company_id = v_supplier.company_id;

  IF v_cost_count > 0 AND v_cost_penalty_avg IS NOT NULL THEN
    v_cost_score := GREATEST(0, ROUND(100 - v_cost_penalty_avg, 2));
  ELSE
    v_cost_score := 100;
  END IF;

  v_global_score := public.supplier_compute_global_score(
    v_quality_score,
    v_delivery_score,
    v_cost_score
  );
  v_score_band := public.supplier_score_band_from_global(v_global_score);

  v_details := jsonb_build_object(
    'quality', jsonb_build_object(
      'sample_count', v_quality_count,
      'average_three_way_match_score', v_quality_score
    ),
    'delivery', jsonb_build_object(
      'evaluated_orders_count', v_delivery_eval_count,
      'on_time_orders_count', v_delivery_on_time_count,
      'delivery_score', v_delivery_score
    ),
    'cost', jsonb_build_object(
      'sample_count', v_cost_count,
      'average_amount_penalty', v_cost_penalty_avg,
      'cost_score', v_cost_score
    ),
    'counts', jsonb_build_object(
      'total_orders_count', v_total_orders_count,
      'delivered_orders_count', v_delivered_orders_count,
      'matched_invoices_count', v_matched_invoices_count
    ),
    'global_score', v_global_score,
    'score_band', v_score_band
  );

  INSERT INTO public.supplier_performance_scores (
    user_id,
    company_id,
    supplier_id,
    quality_score,
    delivery_score,
    cost_score,
    global_score,
    score_band,
    total_orders_count,
    delivered_orders_count,
    matched_invoices_count,
    evaluated_at,
    details,
    created_at,
    updated_at
  ) VALUES (
    v_company_owner_id,
    v_supplier.company_id,
    p_supplier_id,
    v_quality_score,
    v_delivery_score,
    v_cost_score,
    v_global_score,
    v_score_band,
    v_total_orders_count,
    v_delivered_orders_count,
    v_matched_invoices_count,
    NOW(),
    v_details,
    NOW(),
    NOW()
  )
  ON CONFLICT (company_id, supplier_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    quality_score = EXCLUDED.quality_score,
    delivery_score = EXCLUDED.delivery_score,
    cost_score = EXCLUDED.cost_score,
    global_score = EXCLUDED.global_score,
    score_band = EXCLUDED.score_band,
    total_orders_count = EXCLUDED.total_orders_count,
    delivered_orders_count = EXCLUDED.delivered_orders_count,
    matched_invoices_count = EXCLUDED.matched_invoices_count,
    evaluated_at = EXCLUDED.evaluated_at,
    details = EXCLUDED.details,
    updated_at = NOW()
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_refresh_all_performance_scores(
  p_skip_auth BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_supplier_id UUID;
BEGIN
  FOR v_supplier_id IN
    SELECT s.id
    FROM public.suppliers s
    JOIN public.company c ON c.id = s.company_id
    WHERE p_skip_auth OR c.user_id = auth.uid()
  LOOP
    PERFORM public.supplier_refresh_performance_score(v_supplier_id, p_skip_auth);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_order_refresh_performance_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.supplier_id IS NOT NULL THEN
      PERFORM public.supplier_refresh_performance_score(OLD.supplier_id, TRUE);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
    IF OLD.supplier_id IS NOT NULL THEN
      PERFORM public.supplier_refresh_performance_score(OLD.supplier_id, TRUE);
    END IF;
  END IF;

  IF NEW.supplier_id IS NOT NULL THEN
    PERFORM public.supplier_refresh_performance_score(NEW.supplier_id, TRUE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_invoice_refresh_performance_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.supplier_id IS NOT NULL THEN
      PERFORM public.supplier_refresh_performance_score(OLD.supplier_id, TRUE);
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.supplier_id IS DISTINCT FROM OLD.supplier_id THEN
    IF OLD.supplier_id IS NOT NULL THEN
      PERFORM public.supplier_refresh_performance_score(OLD.supplier_id, TRUE);
    END IF;
  END IF;

  IF NEW.supplier_id IS NOT NULL THEN
    PERFORM public.supplier_refresh_performance_score(NEW.supplier_id, TRUE);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_invoice_three_way_match_refresh_performance_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_supplier_id UUID;
  v_old_supplier_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT si.supplier_id
    INTO v_supplier_id
    FROM public.supplier_invoices si
    WHERE si.id = OLD.supplier_invoice_id;

    IF v_supplier_id IS NOT NULL THEN
      PERFORM public.supplier_refresh_performance_score(v_supplier_id, TRUE);
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.supplier_invoice_id IS DISTINCT FROM OLD.supplier_invoice_id THEN
    SELECT si.supplier_id
    INTO v_old_supplier_id
    FROM public.supplier_invoices si
    WHERE si.id = OLD.supplier_invoice_id;

    IF v_old_supplier_id IS NOT NULL THEN
      PERFORM public.supplier_refresh_performance_score(v_old_supplier_id, TRUE);
    END IF;
  END IF;

  SELECT si.supplier_id
  INTO v_supplier_id
  FROM public.supplier_invoices si
  WHERE si.id = NEW.supplier_invoice_id;

  IF v_supplier_id IS NOT NULL THEN
    PERFORM public.supplier_refresh_performance_score(v_supplier_id, TRUE);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_performance_scores_set_updated_at ON public.supplier_performance_scores;
CREATE TRIGGER trg_supplier_performance_scores_set_updated_at
BEFORE UPDATE ON public.supplier_performance_scores
FOR EACH ROW
EXECUTE FUNCTION public.trg_supplier_performance_scores_set_updated_at();

DROP TRIGGER IF EXISTS trg_supplier_order_refresh_performance_score ON public.supplier_orders;
CREATE TRIGGER trg_supplier_order_refresh_performance_score
AFTER INSERT OR UPDATE OF supplier_id, order_status, expected_delivery_date, actual_delivery_date, total_amount, company_id
OR DELETE ON public.supplier_orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_supplier_order_refresh_performance_score();

DROP TRIGGER IF EXISTS trg_supplier_invoice_refresh_performance_score ON public.supplier_invoices;
CREATE TRIGGER trg_supplier_invoice_refresh_performance_score
AFTER INSERT OR UPDATE OF supplier_id, supplier_order_id, three_way_match_status, three_way_match_score, total_amount, total_ttc, total_ht, company_id
OR DELETE ON public.supplier_invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_supplier_invoice_refresh_performance_score();

DROP TRIGGER IF EXISTS trg_supplier_invoice_three_way_match_refresh_performance_score ON public.supplier_invoice_three_way_matches;
CREATE TRIGGER trg_supplier_invoice_three_way_match_refresh_performance_score
AFTER INSERT OR UPDATE OF supplier_invoice_id, supplier_order_id, match_status, amount_variance, invoiced_total_amount, ordered_total_amount, company_id
OR DELETE ON public.supplier_invoice_three_way_matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_supplier_invoice_three_way_match_refresh_performance_score();

ALTER TABLE public.supplier_performance_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_performance_scores_owner_access ON public.supplier_performance_scores;
CREATE POLICY supplier_performance_scores_owner_access
ON public.supplier_performance_scores
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_performance_scores.company_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_performance_scores.company_id
      AND c.user_id = auth.uid()
  )
);

COMMENT ON TABLE public.supplier_performance_scores IS
'Company-scoped supplier performance score tracking quality, delivery, cost and global band.';

COMMENT ON FUNCTION public.supplier_refresh_performance_score(UUID, BOOLEAN) IS
'Refreshes the company-owned supplier performance score from supplier_orders, supplier_invoices and supplier_invoice_three_way_matches.';

COMMENT ON FUNCTION public.supplier_refresh_all_performance_scores(BOOLEAN) IS
'Refreshes all supplier performance scores, optionally limited to the current authenticated company owner.';

SELECT public.supplier_refresh_all_performance_scores(TRUE);
