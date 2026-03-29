import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guardsWorkflowPath = path.resolve(process.cwd(), '.github/workflows/guards.yml');
const prodDeployWorkflowPath = path.resolve(process.cwd(), '.github/workflows/vercel-prebuilt-prod.yml');
const shipMainScriptPath = path.resolve(process.cwd(), 'scripts/ship-main.ps1');

describe('Release governance contract', () => {
  const guardsWorkflow = fs.readFileSync(guardsWorkflowPath, 'utf8');
  const prodDeployWorkflow = fs.readFileSync(prodDeployWorkflowPath, 'utf8');
  const shipMainScript = fs.readFileSync(shipMainScriptPath, 'utf8');

  it('makes the security audit job blocking in CI', () => {
    expect(guardsWorkflow).toMatch(/security:\s*\n\s*runs-on:/);
    expect(guardsWorkflow).not.toMatch(/continue-on-error:\s*true/);
  });

  it('runs full quality gates before production deploy', () => {
    expect(prodDeployWorkflow).toContain('npm run verify:local');
    expect(prodDeployWorkflow).toContain('npm run test:coverage');
    expect(prodDeployWorkflow).toContain('npm audit --omit=dev --audit-level=high');
  });

  it('blocks local ship script when quality gates fail', () => {
    expect(shipMainScript).toContain('npm run verify:local');
    expect(shipMainScript).toContain('npm run test:coverage');
    expect(shipMainScript).toContain('npm audit --omit=dev --audit-level=high');
  });
});
