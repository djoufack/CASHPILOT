import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const packageJsonPath = path.resolve(process.cwd(), 'package.json');

describe('Runtime security dependencies contract', () => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  it('pins jsPDF above the vulnerable range', () => {
    expect(packageJson.dependencies.jspdf).toBeDefined();
    expect(packageJson.dependencies.jspdf).not.toMatch(/^(\^|~)?4\.2\.0$/);
  });

  it('uses a patched xlsx package source', () => {
    expect(packageJson.dependencies.xlsx).toMatch(/^npm:@e965\/xlsx@/);
  });

  it('installs Vitest coverage provider used by test:coverage', () => {
    expect(packageJson.devDependencies['@vitest/coverage-v8']).toBeDefined();
  });
});
