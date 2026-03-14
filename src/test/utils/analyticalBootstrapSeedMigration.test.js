import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260314024000_bootstrap_analytical_from_existing_seed.sql',
);

describe('analytical bootstrap from existing seed migration', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('creates a bootstrap rpc for analytical data', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_bootstrap_analytical_from_seed/i);
    expect(sql).toMatch(/RETURNS JSONB/i);
  });

  it('reuses seeded accounting entries to hydrate dimensions', () => {
    expect(sql).toMatch(/accounting_entries\.cost_center/i);
    expect(sql).toMatch(/accounting_entries\.department/i);
    expect(sql).toMatch(/accounting_entries\.product_line/i);
  });

  it('builds budgets and monthly lines from allocations', () => {
    expect(sql).toMatch(/INSERT INTO public\.analytical_budgets/i);
    expect(sql).toMatch(/f_generate_budget_lines/i);
    expect(sql).toMatch(/UPDATE public\.analytical_budget_lines/i);
  });
});

