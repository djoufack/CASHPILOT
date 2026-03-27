import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/verify-accounting-company-scope.mjs');

describe('verify-accounting-company-scope script contract', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  it('fails on missing company scope rows for mappings and bank statements', () => {
    expect(source).toMatch(/mappingRowsMissingCompanyScope/);
    expect(source).toMatch(/bankStatementRowsMissingCompanyScope/);
    expect(source).toMatch(/from\('accounting_mappings'\)\.select\('\*', \{ count: 'exact', head: true \}\)\.is\('company_id', null\)/);
    expect(source).toMatch(/from\('bank_statements'\)\.select\('\*', \{ count: 'exact', head: true \}\)\.is\('company_id', null\)/);
  });

  it('validates per-company scoped queries on mappings and bank statements', () => {
    expect(source).toMatch(/mapping count for \$\{company\.company_name\}/);
    expect(source).toMatch(/bank statement count for \$\{company\.company_name\}/);
    expect(source).toMatch(/from\('accounting_mappings'\)[\s\S]*?\.eq\('company_id', company\.id\)/);
    expect(source).toMatch(/from\('bank_statements'\)[\s\S]*?\.eq\('company_id', company\.id\)/);
  });
});
