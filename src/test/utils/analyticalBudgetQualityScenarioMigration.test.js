import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260314080000_analytical_budget_quality_and_scenarios.sql',
);

describe('analytical budget quality and scenario migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('adds db guardrail for active budget validity', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.validate_analytical_budget_activation/i);
    expect(sql).toMatch(/Active budget requires at least one budget line or one valid imputation source/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_validate_analytical_budget_activation/i);
  });

  it('creates persisted scenarios table with audit trigger', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.analytical_budget_scenarios/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_audit_analytical_budget_scenarios_crud/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.validate_analytical_budget_scenario_scope/i);
  });

  it('adds db-first quality and scenario comparison rpc functions', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_analytical_budget_data_quality/i);
    expect(sql).toMatch(/real_coverage_percent/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_analytical_budget_scenario_summaries/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_analytical_budget_scenario_curve/i);
  });
});
