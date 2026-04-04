import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/guard-hook-company-scope.mjs');
const docPath = path.resolve(process.cwd(), 'docs/HOOK_COMPANY_SCOPE_GUARD.md');

describe('ENF-2 hook company scope guard contract', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');
  const doc = fs.readFileSync(docPath, 'utf8');

  it('keeps the guard script and documentation in place', () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('documents the heuristic and remediation path', () => {
    expect(doc).toContain('node scripts/guard-hook-company-scope.mjs');
    expect(doc).toContain('useCompanyScope()');
    expect(doc).toContain('withCompanyScope()');
    expect(doc).toContain('Allowlist documentee');
    expect(doc).toContain('company_id');
    expect(doc).toContain('payment_instrument_bank_accounts');
    expect(doc).toContain('billing_info');
    expect(doc).toContain('credit_costs');
  });

  it('encodes the invariants needed for ENF-2 scope checks', () => {
    expect(script).toContain('HOOK_DIR');
    expect(script).toContain('HOOK_GLOB');
    expect(script).toContain('SAFE_TABLE_ALLOWLIST');
    expect(script).toContain('COMPANY_SCOPE_MARKERS');
    expect(script).toContain('Potentially unscoped Supabase table access detected');
    expect(script).toContain('useCompanyScope()');
    expect(script).toContain('company_id');
    expect(script).toContain('listHookFiles');
    expect(script).toContain('payment_instrument_');
  });

  it('passes on the current main-state hook inventory', () => {
    const output = execFileSync('node', [scriptPath], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    expect(output).toContain('ENF-2 hook company scope guard passed');
  });
});
