import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260314081000_analytical_budget_scenarios_backfill_base.sql',
);

describe('analytical budget scenario backfill migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('seeds a base scenario for active budgets missing scenarios', () => {
    expect(sql).toMatch(/INSERT INTO public\.analytical_budget_scenarios/i);
    expect(sql).toMatch(/'Base'/i);
    expect(sql).toMatch(/NOT EXISTS\s*\(\s*SELECT 1\s*FROM public\.analytical_budget_scenarios/i);
  });

  it('normalizes exactly one default scenario per budget', () => {
    expect(sql).toMatch(/row_number\(\) OVER\s*\(\s*PARTITION BY s\.budget_id/i);
    expect(sql).toMatch(/SET is_default = \(r\.rn = 1\)/i);
  });
});
