import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = path.resolve(process.cwd(), 'scripts/run-demo-test-campaign.mjs');

describe('run-demo-test-campaign script contract', () => {
  const source = fs.readFileSync(scriptPath, 'utf8');

  it('defines optionalEnv before using it for cleanup env wiring', () => {
    expect(source).toMatch(/function optionalEnv\(\.\.\.names\)/);
    expect(source).toMatch(/SMOKE_CLEANUP_MIN_AGE_MINUTES:\s*optionalEnv\('CAMPAIGN_SMOKE_CLEANUP_MIN_AGE_MINUTES',\s*'0'\)/);
  });
});
