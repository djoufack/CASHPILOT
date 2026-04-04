const DEFAULT_BASE_URL = 'https://cashpilot.tech';
const DEFAULT_REPORT_DIR = 'artifacts/load-tests';

const getRuntimeEnv = () => globalThis.__ENV ?? {};

export const normalizeBaseUrl = (value, fallback = DEFAULT_BASE_URL) => {
  const normalized = String(value ?? '')
    .trim()
    .replace(/\/+$/, '');
  return normalized || fallback;
};

export const resolveBaseUrl = (env = getRuntimeEnv(), fallback = DEFAULT_BASE_URL) =>
  normalizeBaseUrl(env.BASE_URL || env.K6_BASE_URL || env.LOAD_TEST_BASE_URL || fallback, fallback);

export const resolveProfile = (env = getRuntimeEnv(), fallback = 'peak') =>
  String(env.K6_PROFILE || env.LOAD_TEST_PROFILE || fallback)
    .trim()
    .toLowerCase() || fallback;

export const resolveReportDir = (env = getRuntimeEnv(), fallback = DEFAULT_REPORT_DIR) =>
  String(env.LOAD_TEST_REPORT_DIR || env.K6_REPORT_DIR || fallback)
    .trim()
    .replace(/\/+$/, '') || fallback;

export const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const parseFloatValue = (value, fallback) => {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const formatSeconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

export const formatPercent = (value) => `${(value * 100).toFixed(2)}%`;

export const buildReportPaths = (scriptName, env = getRuntimeEnv()) => {
  const reportDir = resolveReportDir(env);
  const profile = resolveProfile(env);
  const baseName = String(scriptName).replace(/\.js$/i, '');
  return {
    reportDir,
    profile,
    textPath: `${reportDir}/${baseName}-${profile}.txt`,
    jsonPath: `${reportDir}/${baseName}-${profile}.json`,
  };
};

export const buildLoadTestSummary = ({
  title,
  scriptName,
  baseUrl,
  profile,
  stageSummary,
  metrics,
  thresholds,
  verdict,
  notes = [],
}) => {
  const lines = [
    '='.repeat(80),
    `  ${title}`,
    `  Script: ${scriptName}`,
    `  Base URL: ${baseUrl}`,
    `  Profile: ${profile}`,
    `  Date: ${new Date().toISOString()}`,
    '='.repeat(80),
    '',
    'EXECUTION',
    '---------',
    `  Duration          : ${stageSummary.duration}`,
    `  Total requests    : ${stageSummary.totalRequests.toLocaleString()}`,
    `  Throughput        : ${stageSummary.throughput.toFixed(1)} req/s`,
    `  HTTP failure rate  : ${formatPercent(stageSummary.httpFailureRate)}`,
    '',
    'LATENCY',
    '-------',
    `  p(95)             : ${stageSummary.p95.toFixed(0)}ms ${stageSummary.p95 < thresholds.p95 ? 'OK' : 'FAIL'}`,
    `  p(99)             : ${stageSummary.p99 === null ? 'N/A' : `${stageSummary.p99.toFixed(0)}ms`}`,
    '',
    'APP CHECKS',
    '----------',
  ];

  for (const item of metrics) {
    lines.push(`  ${item.label.padEnd(18)}: ${item.value}`);
  }

  lines.push('', 'THRESHOLDS', '----------');
  lines.push(`  p95 < ${thresholds.p95}ms`);
  lines.push(`  p99 < ${thresholds.p99 === null ? 'n/a' : `${thresholds.p99}ms`}`);
  lines.push(`  http_req_failed < ${formatPercent(thresholds.httpReqFailed)}`);
  lines.push(`  app_error_rate < ${formatPercent(thresholds.appErrorRate)}`);
  lines.push('', 'VERDICT', '-------');
  lines.push(`  ${verdict}`);

  if (notes.length > 0) {
    lines.push('', 'NOTES', '-----');
    for (const note of notes) {
      lines.push(`  - ${note}`);
    }
  }

  lines.push('', '='.repeat(80), '');
  return lines.join('\n');
};
