-- BUY-02: 3-way match (commande / reception / facture) for supplier invoices

CREATE TABLE IF NOT EXISTS public.supplier_invoice_three_way_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE RESTRICT,
  supplier_invoice_id UUID NOT NULL REFERENCES public.supplier_invoices(id) ON DELETE CASCADE,
  supplier_order_id UUID REFERENCES public.supplier_orders(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('matched', 'mismatch', 'partial', 'pending', 'unmatched')),
  ordered_total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  received_total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  invoiced_total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  amount_variance NUMERIC(15, 2) NOT NULL DEFAULT 0,
  ordered_total_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
  received_total_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
  invoiced_total_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
  quantity_variance NUMERIC(15, 3) NOT NULL DEFAULT 0,
  tolerance_amount NUMERIC(15, 2) NOT NULL DEFAULT 1,
  tolerance_quantity NUMERIC(15, 3) NOT NULL DEFAULT 0.1,
  match_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT supplier_invoice_three_way_matches_invoice_unique UNIQUE (supplier_invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoice_three_way_matches_company_status
  ON public.supplier_invoice_three_way_matches(company_id, match_status);
CREATE INDEX IF NOT EXISTS idx_supplier_invoice_three_way_matches_order
  ON public.supplier_invoice_three_way_matches(supplier_order_id);

ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS three_way_match_status TEXT NOT NULL DEFAULT 'unmatched';
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS three_way_match_score NUMERIC(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS three_way_match_checked_at TIMESTAMPTZ;

ALTER TABLE public.supplier_invoices
  DROP CONSTRAINT IF EXISTS supplier_invoices_three_way_match_status_check;
ALTER TABLE public.supplier_invoices
  ADD CONSTRAINT supplier_invoices_three_way_match_status_check
  CHECK (three_way_match_status IN ('matched', 'mismatch', 'partial', 'pending', 'unmatched'));

CREATE OR REPLACE FUNCTION public.compute_supplier_invoice_three_way_score(
  p_match_status TEXT,
  p_amount_variance NUMERIC,
  p_quantity_variance NUMERIC,
  p_tolerance_amount NUMERIC,
  p_tolerance_quantity NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_amount_ratio NUMERIC := 5;
  v_quantity_ratio NUMERIC := 5;
  v_penalty NUMERIC := 0;
BEGIN
  IF p_match_status = 'matched' THEN
    RETURN 100;
  END IF;

  IF p_match_status = 'unmatched' THEN
    RETURN 0;
  END IF;

  IF p_match_status = 'pending' THEN
    RETURN 45;
  END IF;

  IF p_match_status = 'partial' THEN
    RETURN 65;
  END IF;

  IF COALESCE(p_tolerance_amount, 0) > 0 THEN
    v_amount_ratio := LEAST(5, ABS(COALESCE(p_amount_variance, 0)) / p_tolerance_amount);
  END IF;

  IF COALESCE(p_tolerance_quantity, 0) > 0 THEN
    v_quantity_ratio := LEAST(5, ABS(COALESCE(p_quantity_variance, 0)) / p_tolerance_quantity);
  END IF;

  v_penalty := GREATEST(v_amount_ratio, v_quantity_ratio) * 20;
  RETURN GREATEST(0, 100 - v_penalty);
END;
$$;

CREATE OR REPLACE FUNCTION public.supplier_invoice_run_three_way_match(
  p_invoice_id UUID,
  p_supplier_order_id UUID DEFAULT NULL,
  p_skip_auth BOOLEAN DEFAULT FALSE
)
RETURNS public.supplier_invoice_three_way_matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.supplier_invoices%ROWTYPE;
  v_selected_order_id UUID;
  v_order public.supplier_orders%ROWTYPE;
  v_now TIMESTAMPTZ := now();

  v_ordered_amount NUMERIC(15, 2) := 0;
  v_received_amount NUMERIC(15, 2) := 0;
  v_invoiced_amount NUMERIC(15, 2) := 0;
  v_ordered_qty NUMERIC(15, 3) := 0;
  v_received_qty NUMERIC(15, 3) := 0;
  v_invoiced_qty NUMERIC(15, 3) := 0;

  v_amount_variance NUMERIC(15, 2) := 0;
  v_quantity_variance NUMERIC(15, 3) := 0;
  v_match_status TEXT := 'unmatched';
  v_order_status TEXT := '';
  v_match_score NUMERIC(5, 2) := 0;
  v_actor_id UUID;

  v_match_row public.supplier_invoice_three_way_matches%ROWTYPE;

  v_amount_tolerance CONSTANT NUMERIC(15, 2) := 1;
  v_quantity_tolerance CONSTANT NUMERIC(15, 3) := 0.1;
BEGIN
  IF NOT p_skip_auth AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to run 3-way match';
  END IF;

  SELECT *
  INTO v_invoice
  FROM public.supplier_invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier invoice % not found', p_invoice_id;
  END IF;

  IF NOT p_skip_auth THEN
    PERFORM 1
    FROM public.company c
    WHERE c.id = v_invoice.company_id
      AND c.user_id = auth.uid();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Access denied for invoice %', p_invoice_id;
    END IF;
  END IF;

  v_actor_id := COALESCE(auth.uid(), v_invoice.user_id);

  v_invoiced_amount := COALESCE(v_invoice.total_ttc, v_invoice.total_amount, v_invoice.total_ht, 0);
  SELECT
    COALESCE(SUM(COALESCE(li.total, COALESCE(li.quantity, 0) * COALESCE(li.unit_price, 0))), 0),
    COALESCE(SUM(COALESCE(li.quantity, 0)), 0)
  INTO v_invoiced_amount, v_invoiced_qty
  FROM public.supplier_invoice_line_items li
  WHERE li.invoice_id = p_invoice_id;

  IF v_invoiced_amount = 0 THEN
    v_invoiced_amount := COALESCE(v_invoice.total_ttc, v_invoice.total_amount, v_invoice.total_ht, 0);
  END IF;

  v_selected_order_id := COALESCE(p_supplier_order_id, v_invoice.supplier_order_id);

  IF v_selected_order_id IS NULL THEN
    SELECT so.id
    INTO v_selected_order_id
    FROM public.supplier_orders so
    WHERE so.company_id = v_invoice.company_id
      AND so.supplier_id = v_invoice.supplier_id
    ORDER BY
      CASE
        WHEN so.order_status IN ('received', 'delivered') THEN 0
        WHEN so.order_status = 'partially_received' THEN 1
        WHEN so.order_status IN ('confirmed', 'shipped') THEN 2
        ELSE 3
      END,
      ABS(
        EXTRACT(
          EPOCH
          FROM (
            COALESCE(v_invoice.invoice_date, CURRENT_DATE)::timestamp
            - COALESCE(so.actual_delivery_date, so.expected_delivery_date, so.order_date, CURRENT_DATE)::timestamp
          )
        )
      ) ASC,
      so.created_at DESC
    LIMIT 1;
  END IF;

  IF v_selected_order_id IS NOT NULL THEN
    SELECT *
    INTO v_order
    FROM public.supplier_orders so
    WHERE so.id = v_selected_order_id
      AND so.company_id = v_invoice.company_id;
  END IF;

  IF FOUND THEN
    v_order_status := COALESCE(v_order.order_status, '');
    v_ordered_amount := COALESCE(v_order.total_amount, 0);

    SELECT
      COALESCE(SUM(COALESCE(soi.total_price, COALESCE(soi.quantity, 0) * COALESCE(soi.unit_price, 0))), 0),
      COALESCE(SUM(COALESCE(soi.quantity, 0)), 0)
    INTO v_ordered_amount, v_ordered_qty
    FROM public.supplier_order_items soi
    WHERE soi.order_id = v_order.id;

    IF v_ordered_amount = 0 THEN
      v_ordered_amount := COALESCE(v_order.total_amount, 0);
    END IF;

    IF v_order_status IN ('received', 'delivered') THEN
      v_received_amount := v_ordered_amount;
      v_received_qty := v_ordered_qty;
    ELSIF v_order_status = 'partially_received' THEN
      SELECT COALESCE(SUM(ABS(COALESCE(psh.change_quantity, 0))), 0)
      INTO v_received_qty
      FROM public.product_stock_history psh
      WHERE psh.order_id = v_order.id
        AND psh.reason = 'purchase_received';

      IF COALESCE(v_ordered_qty, 0) > 0 THEN
        v_received_amount := ROUND((LEAST(v_received_qty, v_ordered_qty) / v_ordered_qty) * v_ordered_amount, 2);
      ELSE
        v_received_amount := 0;
      END IF;
    ELSE
      v_received_amount := 0;
      v_received_qty := 0;
    END IF;

    v_amount_variance := ABS(COALESCE(v_received_amount, 0) - COALESCE(v_invoiced_amount, 0));
    v_quantity_variance := ABS(COALESCE(v_received_qty, 0) - COALESCE(v_invoiced_qty, 0));

    IF v_order_status IN ('draft', 'pending', 'sent', 'confirmed', 'shipped') THEN
      v_match_status := 'pending';
    ELSIF v_order_status = 'partially_received' THEN
      v_match_status := 'partial';
    ELSIF v_amount_variance <= v_amount_tolerance AND v_quantity_variance <= v_quantity_tolerance THEN
      v_match_status := 'matched';
    ELSE
      v_match_status := 'mismatch';
    END IF;
  ELSE
    v_selected_order_id := NULL;
    v_order_status := '';
    v_ordered_amount := 0;
    v_ordered_qty := 0;
    v_received_amount := 0;
    v_received_qty := 0;
    v_amount_variance := ABS(COALESCE(v_invoiced_amount, 0));
    v_quantity_variance := ABS(COALESCE(v_invoiced_qty, 0));
    v_match_status := 'unmatched';
  END IF;

  v_match_score := public.compute_supplier_invoice_three_way_score(
    v_match_status,
    v_amount_variance,
    v_quantity_variance,
    v_amount_tolerance,
    v_quantity_tolerance
  );

  INSERT INTO public.supplier_invoice_three_way_matches (
    user_id,
    company_id,
    supplier_invoice_id,
    supplier_order_id,
    match_status,
    ordered_total_amount,
    received_total_amount,
    invoiced_total_amount,
    amount_variance,
    ordered_total_quantity,
    received_total_quantity,
    invoiced_total_quantity,
    quantity_variance,
    tolerance_amount,
    tolerance_quantity,
    match_score,
    matched_at,
    matched_by,
    details,
    updated_at
  ) VALUES (
    COALESCE(v_invoice.user_id, v_actor_id),
    v_invoice.company_id,
    v_invoice.id,
    v_selected_order_id,
    v_match_status,
    v_ordered_amount,
    v_received_amount,
    v_invoiced_amount,
    v_amount_variance,
    v_ordered_qty,
    v_received_qty,
    v_invoiced_qty,
    v_quantity_variance,
    v_amount_tolerance,
    v_quantity_tolerance,
    v_match_score,
    v_now,
    v_actor_id,
    jsonb_build_object(
      'order_status', v_order_status,
      'matched_at', v_now,
      'auto_linked_order', (p_supplier_order_id IS NULL AND v_invoice.supplier_order_id IS NULL AND v_selected_order_id IS NOT NULL)
    ),
    v_now
  )
  ON CONFLICT (supplier_invoice_id) DO UPDATE
    SET supplier_order_id = EXCLUDED.supplier_order_id,
        match_status = EXCLUDED.match_status,
        ordered_total_amount = EXCLUDED.ordered_total_amount,
        received_total_amount = EXCLUDED.received_total_amount,
        invoiced_total_amount = EXCLUDED.invoiced_total_amount,
        amount_variance = EXCLUDED.amount_variance,
        ordered_total_quantity = EXCLUDED.ordered_total_quantity,
        received_total_quantity = EXCLUDED.received_total_quantity,
        invoiced_total_quantity = EXCLUDED.invoiced_total_quantity,
        quantity_variance = EXCLUDED.quantity_variance,
        tolerance_amount = EXCLUDED.tolerance_amount,
        tolerance_quantity = EXCLUDED.tolerance_quantity,
        match_score = EXCLUDED.match_score,
        matched_at = EXCLUDED.matched_at,
        matched_by = EXCLUDED.matched_by,
        details = EXCLUDED.details,
        updated_at = EXCLUDED.updated_at
  RETURNING *
  INTO v_match_row;

  UPDATE public.supplier_invoices si
  SET
    supplier_order_id = COALESCE(v_selected_order_id, si.supplier_order_id),
    three_way_match_status = v_match_status,
    three_way_match_score = v_match_score,
    three_way_match_checked_at = v_now
  WHERE si.id = p_invoice_id
    AND (
      si.supplier_order_id IS DISTINCT FROM COALESCE(v_selected_order_id, si.supplier_order_id)
      OR si.three_way_match_status IS DISTINCT FROM v_match_status
      OR si.three_way_match_score IS DISTINCT FROM v_match_score
      OR si.three_way_match_checked_at IS DISTINCT FROM v_now
    );

  RETURN v_match_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_invoice_refresh_three_way_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  PERFORM public.supplier_invoice_run_three_way_match(NEW.id, NEW.supplier_order_id, TRUE);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_invoice_line_item_refresh_three_way_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id UUID;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_invoice_id IS NOT NULL THEN
    PERFORM public.supplier_invoice_run_three_way_match(v_invoice_id, NULL, TRUE);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_order_refresh_three_way_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice RECORD;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  FOR v_invoice IN
    SELECT si.id
    FROM public.supplier_invoices si
    WHERE si.supplier_order_id = NEW.id
  LOOP
    PERFORM public.supplier_invoice_run_three_way_match(v_invoice.id, NEW.id, TRUE);
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_supplier_order_item_refresh_three_way_match()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_order_id UUID;
  v_invoice RECORD;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_order_id := COALESCE(NEW.order_id, OLD.order_id);
  IF v_order_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  FOR v_invoice IN
    SELECT si.id
    FROM public.supplier_invoices si
    WHERE si.supplier_order_id = v_order_id
  LOOP
    PERFORM public.supplier_invoice_run_three_way_match(v_invoice.id, v_order_id, TRUE);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_supplier_invoice_refresh_three_way_match ON public.supplier_invoices;
CREATE TRIGGER trg_supplier_invoice_refresh_three_way_match
  AFTER INSERT OR UPDATE OF supplier_order_id, total_amount, total_ttc, total_ht, supplier_id, status
  ON public.supplier_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_supplier_invoice_refresh_three_way_match();

DROP TRIGGER IF EXISTS trg_supplier_invoice_line_item_refresh_three_way_match ON public.supplier_invoice_line_items;
CREATE TRIGGER trg_supplier_invoice_line_item_refresh_three_way_match
  AFTER INSERT OR UPDATE OR DELETE
  ON public.supplier_invoice_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_supplier_invoice_line_item_refresh_three_way_match();

DROP TRIGGER IF EXISTS trg_supplier_order_refresh_three_way_match ON public.supplier_orders;
CREATE TRIGGER trg_supplier_order_refresh_three_way_match
  AFTER UPDATE OF order_status, total_amount, actual_delivery_date, expected_delivery_date
  ON public.supplier_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_supplier_order_refresh_three_way_match();

DROP TRIGGER IF EXISTS trg_supplier_order_item_refresh_three_way_match ON public.supplier_order_items;
CREATE TRIGGER trg_supplier_order_item_refresh_three_way_match
  AFTER INSERT OR UPDATE OR DELETE
  ON public.supplier_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_supplier_order_item_refresh_three_way_match();

ALTER TABLE public.supplier_invoice_three_way_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supplier_invoice_three_way_matches_owner_access ON public.supplier_invoice_three_way_matches;
CREATE POLICY supplier_invoice_three_way_matches_owner_access
ON public.supplier_invoice_three_way_matches
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_invoice_three_way_matches.company_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.company c
    WHERE c.id = supplier_invoice_three_way_matches.company_id
      AND c.user_id = auth.uid()
  )
);

DO $$
DECLARE
  v_invoice RECORD;
BEGIN
  FOR v_invoice IN
    SELECT id
    FROM public.supplier_invoices
  LOOP
    PERFORM public.supplier_invoice_run_three_way_match(v_invoice.id, NULL, TRUE);
  END LOOP;
END;
$$;

COMMENT ON TABLE public.supplier_invoice_three_way_matches IS
'BUY-02: persisted 3-way match results comparing supplier order, reception and supplier invoice.';

COMMENT ON FUNCTION public.supplier_invoice_run_three_way_match(UUID, UUID, BOOLEAN) IS
'Runs and persists 3-way match (purchase order / reception / invoice) for a supplier invoice.';
