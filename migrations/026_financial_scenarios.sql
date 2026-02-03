-- Migration 026: Financial Scenarios & Simulations System
-- Enables users to create financial projections and what-if scenarios

-- ============================================================================
-- EXTENSION: Ensure UUID generation is available
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: financial_scenarios
-- Stores simulation scenarios created by users
-- ============================================================================

CREATE TABLE IF NOT EXISTS financial_scenarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_date DATE NOT NULL, -- Start date of simulation
  end_date DATE NOT NULL,   -- End date of simulation
  status TEXT DEFAULT 'draft', -- draft, active, archived, completed
  is_baseline BOOLEAN DEFAULT false, -- Reference scenario for comparisons

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_date_range CHECK (end_date > base_date),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'archived', 'completed'))
);

-- Index for performance
CREATE INDEX idx_financial_scenarios_user ON financial_scenarios(user_id);
CREATE INDEX idx_financial_scenarios_status ON financial_scenarios(status);

-- ============================================================================
-- TABLE: scenario_assumptions
-- Stores assumptions/hypotheses for each scenario
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_assumptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES financial_scenarios(id) ON DELETE CASCADE,

  -- Assumption metadata
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'revenue', 'expense', 'investment', 'hiring', 'payment_terms'
  assumption_type TEXT NOT NULL, -- 'growth_rate', 'fixed_amount', 'recurring', 'one_time'

  -- Flexible parameters stored as JSONB
  parameters JSONB NOT NULL DEFAULT '{}',

  -- Date range for this assumption
  start_date DATE,
  end_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_assumption_type CHECK (
    assumption_type IN ('growth_rate', 'fixed_amount', 'recurring', 'one_time', 'percentage_change', 'conditional')
  )
);

-- Index for performance
CREATE INDEX idx_scenario_assumptions_scenario ON scenario_assumptions(scenario_id);
CREATE INDEX idx_scenario_assumptions_category ON scenario_assumptions(category);

-- ============================================================================
-- TABLE: scenario_results
-- Stores calculated results for each scenario
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scenario_id UUID NOT NULL REFERENCES financial_scenarios(id) ON DELETE CASCADE,

  -- Calculation period
  calculation_date DATE NOT NULL,
  period_label TEXT, -- 'Jan 2026', 'Q1 2026', etc.

  -- All calculated metrics stored as JSONB for flexibility
  metrics JSONB NOT NULL DEFAULT '{}',

  -- Metadata
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scenario_id, calculation_date)
);

-- Index for performance
CREATE INDEX idx_scenario_results_scenario ON scenario_results(scenario_id);
CREATE INDEX idx_scenario_results_date ON scenario_results(calculation_date);
CREATE INDEX idx_scenario_results_combined ON scenario_results(scenario_id, calculation_date);

-- ============================================================================
-- TABLE: scenario_comparisons
-- Stores comparisons between scenarios
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_comparisons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scenario_ids UUID[] NOT NULL, -- Array of scenario IDs being compared

  -- Comparison results
  comparison_metrics JSONB DEFAULT '{}',

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_scenario_comparisons_user ON scenario_comparisons(user_id);

-- ============================================================================
-- TABLE: scenario_templates
-- Pre-defined scenario templates for common use cases
-- ============================================================================

CREATE TABLE IF NOT EXISTS scenario_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'growth', 'hiring', 'investment', 'optimization'
  icon TEXT, -- Icon name for UI

  -- Template structure
  default_assumptions JSONB NOT NULL DEFAULT '[]',
  suggested_duration_months INTEGER DEFAULT 12,

  -- Public or user-specific
  is_public BOOLEAN DEFAULT true,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX idx_scenario_templates_category ON scenario_templates(category);
CREATE INDEX idx_scenario_templates_public ON scenario_templates(is_public);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE financial_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_templates ENABLE ROW LEVEL SECURITY;

-- Policies for financial_scenarios
CREATE POLICY "Users can view their own scenarios"
  ON financial_scenarios FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scenarios"
  ON financial_scenarios FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenarios"
  ON financial_scenarios FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenarios"
  ON financial_scenarios FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for scenario_assumptions
CREATE POLICY "Users can view assumptions for their scenarios"
  ON scenario_assumptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM financial_scenarios
      WHERE id = scenario_assumptions.scenario_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create assumptions for their scenarios"
  ON scenario_assumptions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM financial_scenarios
      WHERE id = scenario_assumptions.scenario_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assumptions for their scenarios"
  ON scenario_assumptions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM financial_scenarios
      WHERE id = scenario_assumptions.scenario_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assumptions for their scenarios"
  ON scenario_assumptions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM financial_scenarios
      WHERE id = scenario_assumptions.scenario_id
        AND user_id = auth.uid()
    )
  );

-- Policies for scenario_results
CREATE POLICY "Users can view results for their scenarios"
  ON scenario_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM financial_scenarios
      WHERE id = scenario_results.scenario_id
        AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create results for their scenarios"
  ON scenario_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM financial_scenarios
      WHERE id = scenario_results.scenario_id
        AND user_id = auth.uid()
    )
  );

-- Policies for scenario_comparisons
CREATE POLICY "Users can view their own comparisons"
  ON scenario_comparisons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own comparisons"
  ON scenario_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comparisons"
  ON scenario_comparisons FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comparisons"
  ON scenario_comparisons FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for scenario_templates
CREATE POLICY "Everyone can view public templates"
  ON scenario_templates FOR SELECT
  USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can create their own templates"
  ON scenario_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates"
  ON scenario_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates"
  ON scenario_templates FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS: Helper functions for scenarios
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_financial_scenarios_updated_at
  BEFORE UPDATE ON financial_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenario_assumptions_updated_at
  BEFORE UPDATE ON scenario_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenario_comparisons_updated_at
  BEFORE UPDATE ON scenario_comparisons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA: Insert common scenario templates
-- ============================================================================

INSERT INTO scenario_templates (name, description, category, icon, default_assumptions, is_public) VALUES
('Croissance CA +10%', 'Simulation d''une croissance du chiffre d''affaires de 10% mensuelle', 'growth', 'TrendingUp',
 '[{"type": "growth_rate", "category": "revenue", "parameters": {"rate": 10, "frequency": "monthly"}}]'::jsonb, true),

('Embauche 1 personne', 'Impact financier de l''embauche d''un salarié', 'hiring', 'Users',
 '[{"type": "recurring", "category": "salaries", "parameters": {"amount": 3000, "frequency": "monthly"}},
   {"type": "recurring", "category": "social_charges", "parameters": {"amount": 1350, "frequency": "monthly"}}]'::jsonb, true),

('Investissement matériel', 'Achat d''équipement avec amortissement', 'investment', 'DollarSign',
 '[{"type": "one_time", "category": "equipment", "parameters": {"amount": 50000}},
   {"type": "recurring", "category": "maintenance", "parameters": {"amount": 500, "frequency": "monthly"}}]'::jsonb, true),

('Optimisation BFR', 'Amélioration des délais de paiement client/fournisseur', 'optimization', 'Zap',
 '[{"type": "payment_terms", "category": "working_capital", "parameters": {"customer_days": 45, "supplier_days": 60}}]'::jsonb, true),

('Augmentation prix +15%', 'Impact d''une hausse tarifaire de 15%', 'growth', 'ArrowUp',
 '[{"type": "percentage_change", "category": "pricing", "parameters": {"rate": 15, "apply_to": "all_products"}}]'::jsonb, true);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE financial_scenarios IS 'Stores financial simulation scenarios created by users';
COMMENT ON TABLE scenario_assumptions IS 'Stores assumptions and hypotheses for each scenario';
COMMENT ON TABLE scenario_results IS 'Stores calculated results for scenario simulations';
COMMENT ON TABLE scenario_comparisons IS 'Stores comparisons between multiple scenarios';
COMMENT ON TABLE scenario_templates IS 'Pre-defined scenario templates for common use cases';

COMMENT ON COLUMN scenario_assumptions.parameters IS 'Flexible JSONB field for storing assumption parameters based on type';
COMMENT ON COLUMN scenario_results.metrics IS 'All calculated financial metrics stored as JSONB';
