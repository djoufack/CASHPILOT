import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workflowPath = path.resolve(process.cwd(), '.github/workflows/load-tests.yml');
const commonPath = path.resolve(process.cwd(), 'scripts/load-test-common.js');
const peakScriptPath = path.resolve(process.cwd(), 'scripts/load-test-cashpilot.js');
const soakScriptPath = path.resolve(process.cwd(), 'scripts/load-test-soak.js');
const docsPath = path.resolve(process.cwd(), 'docs/LOAD_TEST_ENTERPRISE.md');

describe('Enterprise load test contract', () => {
  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const common = fs.readFileSync(commonPath, 'utf8');
  const peakScript = fs.readFileSync(peakScriptPath, 'utf8');
  const soakScript = fs.readFileSync(soakScriptPath, 'utf8');
  const docs = fs.readFileSync(docsPath, 'utf8');

  it('keeps the workflow secret-free and dual-triggered', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('schedule:');
    expect(workflow).toContain('grafana/k6:0.53.0');
    expect(workflow).toContain('BASE_URL');
    expect(workflow).toContain('LOAD_TEST_REPORT_DIR');
    expect(workflow).not.toMatch(/secrets\./);
  });

  it('keeps both load test scripts base-url aware and reportable', () => {
    expect(common).toContain('resolveBaseUrl');
    expect(common).toContain('buildLoadTestSummary');
    expect(common).toContain('resolveReportDir');
    expect(peakScript).toContain('resolveBaseUrl');
    expect(peakScript).toContain('LOAD_TEST_P95_MS');
    expect(peakScript).toContain('buildReportPaths');
    expect(soakScript).toContain('resolveBaseUrl');
    expect(soakScript).toContain('K6_TARGET_VUS');
    expect(soakScript).toContain('buildReportPaths');
  });

  it('documents the enterprise execution path and thresholds', () => {
    expect(docs).toContain('Enterprise Load Tests');
    expect(docs).toContain('docker run --rm');
    expect(docs).toContain('.github/workflows/load-tests.yml');
    expect(docs).toContain('No secrets are required');
  });
});
