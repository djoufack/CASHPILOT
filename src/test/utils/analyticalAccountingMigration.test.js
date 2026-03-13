import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260313210000_analytical_accounting_company_scope_full.sql',
);

describe('analytical accounting migration hard requirements', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('enforces company scope on accounting_analytical_axes', () => {
    expect(sql).toMatch(/accounting_analytical_axes[\s\S]*ADD COLUMN IF NOT EXISTS company_id/i);
    expect(sql).toMatch(/ALTER COLUMN company_id SET NOT NULL/i);
    expect(sql).toMatch(/uq_accounting_analytical_axes_scope_code/i);
  });

  it('creates relational analytical allocation model', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.analytical_allocations/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.analytical_allocation_rules/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.cost_centers/i);
  });

  it('contains blocking 100% allocation validation', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.enforce_entry_allocation_balance/i);
    expect(sql).toMatch(/CREATE CONSTRAINT TRIGGER trg_enforce_entry_allocation_balance/i);
    expect(sql).toMatch(/Allocation percent mismatch/i);
  });

  it('contains DB-first KPI and budget variance RPCs', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_analytical_kpis/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_analytical_budget_variances/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.f_redistribute_auxiliary_centers/i);
  });

  it('contains accounting audit CRUD triggering', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.log_analytical_financial_crud_audit/i);
    expect(sql).toMatch(/'data_access'/i);
    expect(sql).toMatch(/trg_audit_analytical_allocations_crud/i);
  });
});
