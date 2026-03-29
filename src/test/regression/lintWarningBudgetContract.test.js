import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJsonPath = path.resolve(process.cwd(), 'package.json');
const scriptPath = path.resolve(process.cwd(), 'scripts/guard-eslint-warning-budget.mjs');

describe('ESLint warning budget contract', () => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scriptSource = fs.readFileSync(scriptPath, 'utf8');

  it('wires warning budget guard into npm guard chain', () => {
    expect(packageJson.scripts['guard:lint-warning-budget']).toBeDefined();
    expect(packageJson.scripts.guard).toContain('guard:lint-warning-budget');
  });

  it('defines progressive warning phases in the guard script', () => {
    expect(scriptSource).toContain("effectiveFrom: '2026-01-01'");
    expect(scriptSource).toContain("effectiveFrom: '2026-05-01'");
    expect(scriptSource).toContain("effectiveFrom: '2026-07-01'");
    expect(scriptSource).toContain("effectiveFrom: '2026-09-01'");
  });
});
