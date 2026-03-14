import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260314042000_budget_professional_curves_and_simulation.sql',
);

describe('analytical budget professional curves and simulation migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('upgrades bootstrap logic to avoid identical planned vs actual values', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_bootstrap_analytical_from_seed/i);
    expect(sql).toMatch(/v_center_fallback_monthly/i);
    expect(sql).toMatch(/CASE EXTRACT\(MONTH FROM bl\.period_month\)::INT/i);
  });

  it('adds db-first simulation curve rpc', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_analytical_budget_simulation_curve/i);
    expect(sql).toMatch(/simulated_baseline/i);
    expect(sql).toMatch(/simulated_optimistic/i);
    expect(sql).toMatch(/simulated_prudent/i);
  });
});

