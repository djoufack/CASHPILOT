-- ============================================================================
-- Feature 11: Rapprochement Bancaire IA
-- Tables: recon_match_rules, recon_match_history
-- RPC: auto_reconcile_ia(p_company_id, p_session_id)
-- ============================================================================

-- ============================================================================
-- 1. recon_match_rules — Learned matching rules per company
-- ============================================================================
CREATE TABLE IF NOT EXISTS recon_match_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  rule_name TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('exact_amount', 'fuzzy_amount', 'reference', 'label_pattern', 'recurring')),
  conditions JSONB NOT NULL DEFAULT '{}',
  confidence_threshold NUMERIC(3,2) DEFAULT 0.80,
  is_active BOOLEAN DEFAULT true,
  times_used INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recon_match_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_rules' AND policyname = 'recon_match_rules_select_own') THEN
    CREATE POLICY "recon_match_rules_select_own" ON recon_match_rules FOR SELECT
      USING ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_rules' AND policyname = 'recon_match_rules_insert_own') THEN
    CREATE POLICY "recon_match_rules_insert_own" ON recon_match_rules FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_rules' AND policyname = 'recon_match_rules_update_own') THEN
    CREATE POLICY "recon_match_rules_update_own" ON recon_match_rules FOR UPDATE
      USING ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_rules' AND policyname = 'recon_match_rules_delete_own') THEN
    CREATE POLICY "recon_match_rules_delete_own" ON recon_match_rules FOR DELETE
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recon_match_rules_company ON recon_match_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_recon_match_rules_user ON recon_match_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_recon_match_rules_active ON recon_match_rules(company_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recon_match_rules_type ON recon_match_rules(company_id, match_type);

-- ============================================================================
-- 2. recon_match_history — History of all match attempts (accepted/rejected)
-- ============================================================================
CREATE TABLE IF NOT EXISTS recon_match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  bank_line_id UUID,
  matched_entity_type TEXT CHECK (matched_entity_type IN ('invoice', 'payment', 'expense', 'payable')),
  matched_entity_id UUID,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  match_method TEXT NOT NULL,
  was_accepted BOOLEAN,
  rule_id UUID REFERENCES recon_match_rules(id) ON DELETE SET NULL,
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recon_match_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_history' AND policyname = 'recon_match_history_select_own') THEN
    CREATE POLICY "recon_match_history_select_own" ON recon_match_history FOR SELECT
      USING ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_history' AND policyname = 'recon_match_history_insert_own') THEN
    CREATE POLICY "recon_match_history_insert_own" ON recon_match_history FOR INSERT
      WITH CHECK ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_history' AND policyname = 'recon_match_history_update_own') THEN
    CREATE POLICY "recon_match_history_update_own" ON recon_match_history FOR UPDATE
      USING ((SELECT auth.uid()) = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'recon_match_history' AND policyname = 'recon_match_history_delete_own') THEN
    CREATE POLICY "recon_match_history_delete_own" ON recon_match_history FOR DELETE
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_recon_match_history_company ON recon_match_history(company_id);
CREATE INDEX IF NOT EXISTS idx_recon_match_history_user ON recon_match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_recon_match_history_line ON recon_match_history(bank_line_id);
CREATE INDEX IF NOT EXISTS idx_recon_match_history_rule ON recon_match_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_recon_match_history_session ON recon_match_history(session_id);
CREATE INDEX IF NOT EXISTS idx_recon_match_history_accepted ON recon_match_history(company_id, was_accepted);

-- ============================================================================
-- 3. RPC: auto_reconcile_ia — AI-powered auto-reconciliation
-- For each unmatched bank statement line, applies matching rules by confidence:
--   1. Exact match amount + reference
--   2. Fuzzy amount match (within 1% tolerance)
--   3. Label pattern match
--   4. Recurring pattern match
-- Returns: { matched, total, suggestions: [{line_id, match_id, entity_type, confidence, method}] }
-- ============================================================================
CREATE OR REPLACE FUNCTION auto_reconcile_ia(
  p_company_id UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_line RECORD;
  v_candidate RECORD;
  v_rule RECORD;
  v_suggestions JSONB := '[]'::jsonb;
  v_matched_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_best_match_id UUID;
  v_best_confidence NUMERIC(3,2);
  v_best_method TEXT;
  v_best_entity_type TEXT;
  v_best_rule_id UUID;
  v_used_entity_ids UUID[] := '{}';
  v_score NUMERIC(3,2);
  v_amount_diff NUMERIC;
  v_amount_ratio NUMERIC;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify company ownership
  IF NOT EXISTS (
    SELECT 1 FROM company WHERE id = p_company_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Company not found or access denied';
  END IF;

  -- ============================================================================
  -- Iterate over each unmatched bank statement line for this company
  -- ============================================================================
  FOR v_line IN
    SELECT bsl.id AS line_id,
           bsl.amount,
           bsl.description,
           bsl.reference,
           bsl.transaction_date
    FROM bank_statement_lines bsl
    WHERE bsl.company_id = p_company_id
      AND bsl.reconciliation_status = 'unmatched'
    ORDER BY bsl.transaction_date DESC
  LOOP
    v_total_count := v_total_count + 1;
    v_best_match_id := NULL;
    v_best_confidence := 0;
    v_best_method := NULL;
    v_best_entity_type := NULL;
    v_best_rule_id := NULL;

    -- ========================================================================
    -- PASS 1: Exact amount + reference match against invoices
    -- ========================================================================
    FOR v_candidate IN
      SELECT i.id, i.total_ttc AS amount, i.invoice_number, i.status,
             c.company_name AS client_name
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.company_id = p_company_id
        AND i.status IN ('sent', 'overdue')
        AND i.id != ALL(v_used_entity_ids)
    LOOP
      v_score := 0;

      -- Amount comparison
      v_amount_diff := ABS(ABS(v_line.amount) - COALESCE(v_candidate.amount, 0));
      IF COALESCE(v_candidate.amount, 0) > 0 THEN
        v_amount_ratio := v_amount_diff / GREATEST(ABS(v_line.amount), v_candidate.amount, 1);
      ELSE
        v_amount_ratio := 1;
      END IF;

      -- Exact amount match
      IF v_amount_ratio = 0 THEN
        v_score := 0.50;
      ELSIF v_amount_ratio < 0.01 THEN
        v_score := 0.40;
      ELSIF v_amount_ratio < 0.05 THEN
        v_score := 0.20;
      END IF;

      -- Reference / invoice number match
      IF v_candidate.invoice_number IS NOT NULL
         AND LOWER(COALESCE(v_line.reference, '') || ' ' || COALESCE(v_line.description, ''))
             LIKE '%' || LOWER(v_candidate.invoice_number) || '%' THEN
        v_score := v_score + 0.30;
      END IF;

      -- Client name match in description
      IF v_candidate.client_name IS NOT NULL
         AND LENGTH(v_candidate.client_name) > 2
         AND LOWER(COALESCE(v_line.description, ''))
             LIKE '%' || LOWER(v_candidate.client_name) || '%' THEN
        v_score := v_score + 0.15;
      END IF;

      -- Date proximity bonus (within 7 days)
      IF v_line.transaction_date IS NOT NULL
         AND ABS(v_line.transaction_date - CURRENT_DATE) < 30 THEN
        v_score := LEAST(v_score + 0.05, 1.00);
      END IF;

      IF v_score > v_best_confidence THEN
        v_best_confidence := v_score;
        v_best_match_id := v_candidate.id;
        v_best_entity_type := 'invoice';
        IF v_amount_ratio = 0 AND v_score >= 0.80 THEN
          v_best_method := 'exact_amount';
        ELSIF v_amount_ratio < 0.01 THEN
          v_best_method := 'fuzzy_amount';
        ELSIF v_score >= 0.30 THEN
          v_best_method := 'reference';
        ELSE
          v_best_method := 'label_pattern';
        END IF;
      END IF;
    END LOOP;

    -- ========================================================================
    -- PASS 2: Match against expenses (negative amounts / outflows)
    -- ========================================================================
    IF v_line.amount < 0 THEN
      FOR v_candidate IN
        SELECT e.id, e.amount, e.description AS expense_desc, e.supplier_name
        FROM expenses e
        WHERE e.company_id = p_company_id
          AND e.id != ALL(v_used_entity_ids)
          AND e.amount > 0
      LOOP
        v_score := 0;

        v_amount_diff := ABS(ABS(v_line.amount) - v_candidate.amount);
        IF v_candidate.amount > 0 THEN
          v_amount_ratio := v_amount_diff / GREATEST(ABS(v_line.amount), v_candidate.amount, 1);
        ELSE
          v_amount_ratio := 1;
        END IF;

        IF v_amount_ratio = 0 THEN
          v_score := 0.50;
        ELSIF v_amount_ratio < 0.01 THEN
          v_score := 0.40;
        ELSIF v_amount_ratio < 0.05 THEN
          v_score := 0.20;
        END IF;

        -- Supplier name match
        IF v_candidate.supplier_name IS NOT NULL
           AND LENGTH(v_candidate.supplier_name) > 2
           AND LOWER(COALESCE(v_line.description, ''))
               LIKE '%' || LOWER(v_candidate.supplier_name) || '%' THEN
          v_score := v_score + 0.30;
        END IF;

        IF v_score > v_best_confidence THEN
          v_best_confidence := v_score;
          v_best_match_id := v_candidate.id;
          v_best_entity_type := 'expense';
          IF v_amount_ratio = 0 AND v_score >= 0.80 THEN
            v_best_method := 'exact_amount';
          ELSIF v_amount_ratio < 0.01 THEN
            v_best_method := 'fuzzy_amount';
          ELSE
            v_best_method := 'label_pattern';
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- ========================================================================
    -- PASS 3: Match against payables (supplier invoices, negative amounts)
    -- ========================================================================
    IF v_line.amount < 0 THEN
      FOR v_candidate IN
        SELECT si.id, si.total_ttc AS amount, si.invoice_number, si.supplier_name
        FROM supplier_invoices si
        WHERE si.company_id = p_company_id
          AND si.status IN ('pending', 'approved', 'overdue')
          AND si.id != ALL(v_used_entity_ids)
      LOOP
        v_score := 0;

        v_amount_diff := ABS(ABS(v_line.amount) - COALESCE(v_candidate.amount, 0));
        IF COALESCE(v_candidate.amount, 0) > 0 THEN
          v_amount_ratio := v_amount_diff / GREATEST(ABS(v_line.amount), v_candidate.amount, 1);
        ELSE
          v_amount_ratio := 1;
        END IF;

        IF v_amount_ratio = 0 THEN
          v_score := 0.50;
        ELSIF v_amount_ratio < 0.01 THEN
          v_score := 0.40;
        ELSIF v_amount_ratio < 0.05 THEN
          v_score := 0.20;
        END IF;

        IF v_candidate.invoice_number IS NOT NULL
           AND LOWER(COALESCE(v_line.reference, '') || ' ' || COALESCE(v_line.description, ''))
               LIKE '%' || LOWER(v_candidate.invoice_number) || '%' THEN
          v_score := v_score + 0.30;
        END IF;

        IF v_candidate.supplier_name IS NOT NULL
           AND LENGTH(v_candidate.supplier_name) > 2
           AND LOWER(COALESCE(v_line.description, ''))
               LIKE '%' || LOWER(v_candidate.supplier_name) || '%' THEN
          v_score := v_score + 0.15;
        END IF;

        IF v_score > v_best_confidence THEN
          v_best_confidence := v_score;
          v_best_match_id := v_candidate.id;
          v_best_entity_type := 'payable';
          IF v_amount_ratio = 0 AND v_score >= 0.80 THEN
            v_best_method := 'exact_amount';
          ELSIF v_amount_ratio < 0.01 THEN
            v_best_method := 'fuzzy_amount';
          ELSE
            v_best_method := 'label_pattern';
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- ========================================================================
    -- PASS 4: Apply learned rules from recon_match_rules
    -- ========================================================================
    FOR v_rule IN
      SELECT r.id AS rule_id, r.match_type, r.conditions, r.confidence_threshold
      FROM recon_match_rules r
      WHERE r.company_id = p_company_id
        AND r.is_active = true
      ORDER BY r.success_rate DESC NULLS LAST, r.times_used DESC
    LOOP
      -- Label pattern rules
      IF v_rule.match_type = 'label_pattern' AND v_rule.conditions ? 'label_pattern' THEN
        IF LOWER(COALESCE(v_line.description, '')) LIKE '%' || LOWER(v_rule.conditions->>'label_pattern') || '%' THEN
          -- Check if the rule has a preferred entity
          IF v_rule.conditions ? 'preferred_entity_type' AND v_rule.conditions ? 'preferred_entity_id' THEN
            v_score := GREATEST(v_rule.confidence_threshold, 0.75);
            IF v_score > v_best_confidence THEN
              v_best_confidence := v_score;
              v_best_match_id := (v_rule.conditions->>'preferred_entity_id')::UUID;
              v_best_entity_type := v_rule.conditions->>'preferred_entity_type';
              v_best_method := 'recurring';
              v_best_rule_id := v_rule.rule_id;
            END IF;
          END IF;
        END IF;
      END IF;

      -- Recurring amount rules
      IF v_rule.match_type = 'recurring' AND v_rule.conditions ? 'amount' THEN
        IF ABS(ABS(v_line.amount) - (v_rule.conditions->>'amount')::NUMERIC) < 0.01 THEN
          IF v_rule.conditions ? 'preferred_entity_type' AND v_rule.conditions ? 'preferred_entity_id' THEN
            v_score := GREATEST(v_rule.confidence_threshold, 0.80);
            IF v_score > v_best_confidence THEN
              v_best_confidence := v_score;
              v_best_match_id := (v_rule.conditions->>'preferred_entity_id')::UUID;
              v_best_entity_type := v_rule.conditions->>'preferred_entity_type';
              v_best_method := 'recurring';
              v_best_rule_id := v_rule.rule_id;
            END IF;
          END IF;
        END IF;
      END IF;
    END LOOP;

    -- ========================================================================
    -- Record suggestion if confidence >= 0.50
    -- ========================================================================
    IF v_best_match_id IS NOT NULL AND v_best_confidence >= 0.50 THEN
      v_suggestions := v_suggestions || jsonb_build_object(
        'line_id', v_line.line_id,
        'match_id', v_best_match_id,
        'entity_type', v_best_entity_type,
        'confidence', v_best_confidence,
        'method', v_best_method,
        'rule_id', v_best_rule_id,
        'amount', v_line.amount,
        'description', v_line.description
      );

      -- Auto-apply if confidence >= 0.80
      IF v_best_confidence >= 0.80 THEN
        UPDATE bank_statement_lines
        SET reconciliation_status = 'matched',
            matched_source_type = v_best_entity_type,
            matched_source_id = v_best_match_id,
            matched_at = now(),
            matched_by = 'ai',
            match_confidence = v_best_confidence
        WHERE id = v_line.line_id;

        v_matched_count := v_matched_count + 1;
        v_used_entity_ids := v_used_entity_ids || v_best_match_id;

        -- Record in history
        INSERT INTO recon_match_history (
          user_id, company_id, bank_line_id, matched_entity_type,
          matched_entity_id, confidence, match_method, was_accepted,
          rule_id, session_id
        ) VALUES (
          v_user_id, p_company_id, v_line.line_id, v_best_entity_type,
          v_best_match_id, v_best_confidence, v_best_method, true,
          v_best_rule_id, p_session_id
        );

        -- Update rule usage stats
        IF v_best_rule_id IS NOT NULL THEN
          UPDATE recon_match_rules
          SET times_used = times_used + 1,
              updated_at = now()
          WHERE id = v_best_rule_id;
        END IF;
      ELSE
        -- Record as pending suggestion in history
        INSERT INTO recon_match_history (
          user_id, company_id, bank_line_id, matched_entity_type,
          matched_entity_id, confidence, match_method, was_accepted,
          rule_id, session_id
        ) VALUES (
          v_user_id, p_company_id, v_line.line_id, v_best_entity_type,
          v_best_match_id, v_best_confidence, v_best_method, NULL,
          v_best_rule_id, p_session_id
        );
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'matched', v_matched_count,
    'total', v_total_count,
    'suggestions', v_suggestions
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION auto_reconcile_ia(UUID, UUID) TO authenticated;
