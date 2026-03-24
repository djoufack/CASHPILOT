CREATE OR REPLACE FUNCTION public.compute_cashflow_forecast(
    p_company_id UUID,
    p_days INTEGER DEFAULT 90
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_today DATE := CURRENT_DATE;
    v_end_date DATE;
    v_starting_balance NUMERIC(15,2) := 0;
    v_total_inflows NUMERIC(15,2) := 0;
    v_total_outflows NUMERIC(15,2) := 0;
    v_daily_projections JSONB := '[]'::JSONB;
    v_alerts JSONB := '[]'::JSONB;
    v_scenarios JSONB;
    v_running_balance NUMERIC(15,2);
    v_day_inflow NUMERIC(15,2);
    v_day_outflow NUMERIC(15,2);
    v_day DATE;
    v_avg_daily_inflow NUMERIC(15,2) := 0;
    v_avg_daily_outflow NUMERIC(15,2) := 0;
    v_historical_days INTEGER := 90;
    v_hist_total_inflows NUMERIC(15,2) := 0;
    v_hist_total_outflows NUMERIC(15,2) := 0;
    v_pending_receivables NUMERIC(15,2) := 0;
    v_pending_payables NUMERIC(15,2) := 0;
    v_overdraft_day DATE := NULL;
    v_min_balance NUMERIC(15,2) := 0;
    v_min_balance_day DATE := NULL;
    v_rec RECORD;
BEGIN
    -- Verify ownership
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify company belongs to user
    IF NOT EXISTS (
        SELECT 1 FROM public.company
        WHERE id = p_company_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'Company not found or access denied';
    END IF;

    v_end_date := v_today + p_days;

    -- Step 1: Calculate starting balance from accounting entries
    SELECT COALESCE(SUM(debit) - SUM(credit), 0) INTO v_starting_balance
    FROM public.accounting_entries
    WHERE company_id = p_company_id
      AND user_id = v_user_id
      AND account_code LIKE '5%'
      AND transaction_date <= v_today;

    -- Step 2: Compute historical averages (last 90 days)
    SELECT COALESCE(SUM(amount), 0) INTO v_hist_total_inflows
    FROM public.payments
    WHERE company_id = p_company_id
      AND user_id = v_user_id
      AND payment_date >= (v_today - v_historical_days)
      AND payment_date <= v_today;

    SELECT COALESCE(SUM(amount), 0) INTO v_hist_total_outflows
    FROM public.expenses
    WHERE company_id = p_company_id
      AND user_id = v_user_id
      AND created_at >= (v_today - v_historical_days)::TIMESTAMPTZ
      AND created_at <= v_today::TIMESTAMPTZ;

    SELECT COALESCE(SUM(amount), 0) INTO v_pending_payables
    FROM public.payables
    WHERE company_id = p_company_id
      AND user_id = v_user_id
      AND status IN ('pending', 'approved')
      AND due_date >= v_today
      AND due_date <= v_end_date;

    SELECT COALESCE(SUM(COALESCE(balance_due, total_ttc)), 0) INTO v_pending_receivables
    FROM public.invoices
    WHERE company_id = p_company_id
      AND user_id = v_user_id
      AND payment_status != 'paid'
      AND status IN ('sent', 'overdue', 'accepted')
      AND due_date >= v_today
      AND due_date <= v_end_date;

    IF v_historical_days > 0 THEN
        v_avg_daily_inflow := v_hist_total_inflows / v_historical_days;
        v_avg_daily_outflow := v_hist_total_outflows / v_historical_days;
    END IF;

    -- Step 3: Build daily projections (baseline scenario)
    v_running_balance := v_starting_balance;
    v_min_balance := v_starting_balance;
    v_min_balance_day := v_today;

    FOR i IN 1..p_days LOOP
        v_day := v_today + i;
        v_day_inflow := v_avg_daily_inflow;
        v_day_outflow := v_avg_daily_outflow;

        -- Add specific known inflows (invoices due this day)
        SELECT COALESCE(SUM(COALESCE(balance_due, total_ttc)), 0) INTO v_day_inflow
        FROM (
            SELECT COALESCE(balance_due, total_ttc) AS balance_due, total_ttc
            FROM public.invoices
            WHERE company_id = p_company_id
              AND user_id = v_user_id
              AND payment_status != 'paid'
              AND status IN ('sent', 'overdue', 'accepted')
              AND due_date = v_day
        ) sub;

        IF v_day_inflow = 0 THEN
            v_day_inflow := v_avg_daily_inflow;
        END IF;

        -- Add specific known outflows (payables due this day)
        SELECT COALESCE(SUM(amount), 0) INTO v_day_outflow
        FROM (
            SELECT amount
            FROM public.payables
            WHERE company_id = p_company_id
              AND user_id = v_user_id
              AND status IN ('pending', 'approved')
              AND due_date = v_day
        ) sub;

        IF v_day_outflow = 0 THEN
            v_day_outflow := v_avg_daily_outflow;
        END IF;

        v_running_balance := v_running_balance + v_day_inflow - v_day_outflow;
        v_total_inflows := v_total_inflows + v_day_inflow;
        v_total_outflows := v_total_outflows + v_day_outflow;

        IF v_running_balance < v_min_balance THEN
            v_min_balance := v_running_balance;
            v_min_balance_day := v_day;
        END IF;

        IF v_running_balance < 0 AND v_overdraft_day IS NULL THEN
            v_overdraft_day := v_day;
        END IF;

        v_daily_projections := v_daily_projections || jsonb_build_object(
            'date', v_day::TEXT,
            'day', i,
            'inflow', ROUND(v_day_inflow, 2),
            'outflow', ROUND(v_day_outflow, 2),
            'balance', ROUND(v_running_balance, 2),
            'cumulative_inflows', ROUND(v_total_inflows, 2),
            'cumulative_outflows', ROUND(v_total_outflows, 2)
        );
    END LOOP;

    -- Step 4: Build scenario variants
    v_scenarios := jsonb_build_object(
        'optimistic', jsonb_build_object(
            'label', 'Optimiste',
            'description', 'Encaissements +20%, decaissements -10%',
            'projected_balance', ROUND(v_starting_balance + (v_total_inflows * 1.2) - (v_total_outflows * 0.9), 2),
            'projected_inflows', ROUND(v_total_inflows * 1.2, 2),
            'projected_outflows', ROUND(v_total_outflows * 0.9, 2),
            'multiplier_inflows', 1.2,
            'multiplier_outflows', 0.9
        ),
        'baseline', jsonb_build_object(
            'label', 'Base',
            'description', 'Tendance actuelle maintenue',
            'projected_balance', ROUND(v_starting_balance + v_total_inflows - v_total_outflows, 2),
            'projected_inflows', ROUND(v_total_inflows, 2),
            'projected_outflows', ROUND(v_total_outflows, 2),
            'multiplier_inflows', 1.0,
            'multiplier_outflows', 1.0
        ),
        'pessimistic', jsonb_build_object(
            'label', 'Pessimiste',
            'description', 'Encaissements -20%, decaissements +15%',
            'projected_balance', ROUND(v_starting_balance + (v_total_inflows * 0.8) - (v_total_outflows * 1.15), 2),
            'projected_inflows', ROUND(v_total_inflows * 0.8, 2),
            'projected_outflows', ROUND(v_total_outflows * 1.15, 2),
            'multiplier_inflows', 0.8,
            'multiplier_outflows', 1.15
        )
    );

    -- Step 5: Build alerts
    IF v_overdraft_day IS NOT NULL THEN
        v_alerts := v_alerts || jsonb_build_object(
            'type', 'overdraft_risk',
            'severity', 'critical',
            'date', v_overdraft_day::TEXT,
            'days_until', (v_overdraft_day - v_today),
            'projected_balance', ROUND(v_min_balance, 2),
            'message', format(
                'Risque de decouvert dans %s jours (le %s). Solde projete: %s EUR.',
                (v_overdraft_day - v_today),
                v_overdraft_day::TEXT,
                ROUND(v_min_balance, 2)::TEXT
            )
        );
    END IF;

    IF v_min_balance >= 0 AND v_min_balance < GREATEST(v_starting_balance * 0.1, 1000) AND v_min_balance_day IS NOT NULL THEN
        v_alerts := v_alerts || jsonb_build_object(
            'type', 'low_balance',
            'severity', 'warning',
            'date', v_min_balance_day::TEXT,
            'days_until', (v_min_balance_day - v_today),
            'projected_balance', ROUND(v_min_balance, 2),
            'message', format(
                'Solde bas prevu le %s (%s EUR). Considerez les actions pour maintenir la tresorerie.',
                v_min_balance_day::TEXT,
                ROUND(v_min_balance, 2)::TEXT
            )
        );
    END IF;

    IF v_running_balance > v_starting_balance * 1.2 AND v_starting_balance > 0 THEN
        v_alerts := v_alerts || jsonb_build_object(
            'type', 'growth_opportunity',
            'severity', 'info',
            'date', v_end_date::TEXT,
            'days_until', p_days,
            'projected_balance', ROUND(v_running_balance, 2),
            'message', format(
                'Tresorerie en croissance de %s%%. Opportunite d''investissement ou de placement.',
                ROUND(((v_running_balance - v_starting_balance) / NULLIF(v_starting_balance, 0)) * 100, 1)::TEXT
            )
        );
    END IF;

    -- Step 6: Save forecast to table
    INSERT INTO public.cashflow_forecasts (
        user_id, company_id, forecast_date, period_days, scenario,
        starting_balance, projected_inflows, projected_outflows, projected_balance,
        alert_type, alert_message, data_points
    ) VALUES (
        v_user_id, p_company_id, v_today, p_days, 'baseline',
        v_starting_balance, v_total_inflows, v_total_outflows, v_running_balance,
        CASE WHEN v_overdraft_day IS NOT NULL THEN 'overdraft_risk'
             WHEN v_min_balance < GREATEST(v_starting_balance * 0.1, 1000) THEN 'low_balance'
             WHEN v_running_balance > v_starting_balance * 1.2 THEN 'growth_opportunity'
             ELSE NULL END,
        CASE WHEN jsonb_array_length(v_alerts) > 0 THEN v_alerts->0->>'message' ELSE NULL END,
        jsonb_build_object('daily_count', p_days, 'historical_days', v_historical_days)
    );

    -- Return complete forecast
    RETURN jsonb_build_object(
        'starting_balance', ROUND(v_starting_balance, 2),
        'ending_balance', ROUND(v_running_balance, 2),
        'total_inflows', ROUND(v_total_inflows, 2),
        'total_outflows', ROUND(v_total_outflows, 2),
        'period_days', p_days,
        'forecast_date', v_today::TEXT,
        'end_date', v_end_date::TEXT,
        'pending_receivables', ROUND(v_pending_receivables, 2),
        'pending_payables', ROUND(v_pending_payables, 2),
        'avg_daily_inflow', ROUND(v_avg_daily_inflow, 2),
        'avg_daily_outflow', ROUND(v_avg_daily_outflow, 2),
        'daily_projections', v_daily_projections,
        'scenarios', v_scenarios,
        'alerts', v_alerts,
        'metadata', jsonb_build_object(
            'historical_days_analyzed', v_historical_days,
            'company_id', p_company_id,
            'computed_at', now()::TEXT
        )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_cashflow_forecast(UUID, INTEGER) TO authenticated;;
