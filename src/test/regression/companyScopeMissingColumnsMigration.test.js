import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260327123000_fix_accounting_mappings_bank_statements_company_scope.sql',
);

describe('company scope hardening for accounting_mappings and bank_statements', () => {
  const sql = fs.readFileSync(migrationPath, 'utf8');

  it('adds company_id to accounting_mappings and bank_statements', () => {
    expect(sql).toMatch(/ALTER TABLE public\.accounting_mappings[\s\S]*ADD COLUMN IF NOT EXISTS company_id/i);
    expect(sql).toMatch(/ALTER TABLE public\.bank_statements[\s\S]*ADD COLUMN IF NOT EXISTS company_id/i);
  });

  it('enforces strict company-scoped uniqueness for accounting_mappings', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uq_accounting_mappings_company_scope/i);
    expect(sql).toMatch(/company_id,\s*user_id,\s*source_type,\s*source_category/i);
  });

  it('installs company_id assignment triggers for future writes', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.assign_accounting_mappings_company_id/i);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.assign_bank_statements_company_id/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_assign_accounting_mappings_company_id/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_assign_bank_statements_company_id/i);
  });
});
