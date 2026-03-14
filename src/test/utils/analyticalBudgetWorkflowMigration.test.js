import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260314013000_analytical_budget_full_workflow.sql',
);

describe('analytical budget full workflow migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('adds a budget line normalization trigger', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.normalize_analytical_budget_line/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_normalize_analytical_budget_line/i);
  });

  it('adds monthly line generation rpc', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_generate_budget_lines/i);
    expect(sql).toMatch(/ON CONFLICT \(budget_id, period_month\)/i);
  });

  it('adds monthly budget variance rpc', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_analytical_budget_line_variances/i);
    expect(sql).toMatch(/variance_percent/i);
  });
});

