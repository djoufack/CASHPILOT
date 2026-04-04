/**
 * CashPilot - Peak/Light Load Test (k6)
 *
 * BASE_URL is configurable through __ENV.BASE_URL or __ENV.K6_BASE_URL.
 * PROFILE is configurable through __ENV.K6_PROFILE or __ENV.LOAD_TEST_PROFILE.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  buildLoadTestSummary,
  buildReportPaths,
  formatPercent,
  formatSeconds,
  parseFloatValue,
  parseInteger,
  resolveBaseUrl,
  resolveProfile,
} from './load-test-common.js';

const BASE_URL = resolveBaseUrl();
const PROFILE = resolveProfile(undefined, 'peak');
const REPORT_PATHS = buildReportPaths('load-test-cashpilot.js');

const peakStages = [
  { duration: '30s', target: 50 },
  { duration: '1m', target: 200 },
  { duration: '1m', target: 500 },
  { duration: '30s', target: 500 },
  { duration: '30s', target: 0 },
];

const lightStages = [
  { duration: '15s', target: 20 },
  { duration: '45s', target: 50 },
  { duration: '45s', target: 100 },
  { duration: '30s', target: 100 },
  { duration: '20s', target: 0 },
];

const PROFILE_STAGES = PROFILE === 'light' ? lightStages : peakStages;
const P95_LIMIT_MS = parseInteger(globalThis.__ENV?.LOAD_TEST_P95_MS, 3000);
const P99_LIMIT_MS = parseInteger(globalThis.__ENV?.LOAD_TEST_P99_MS, 5000);
const HTTP_FAILED_LIMIT = parseFloatValue(globalThis.__ENV?.LOAD_TEST_HTTP_FAILED_RATE, 0.05);
const APP_ERROR_LIMIT = parseFloatValue(globalThis.__ENV?.LOAD_TEST_APP_ERROR_RATE, 0.05);

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: PROFILE_STAGES,
  thresholds: {
    http_req_duration: [`p(95)<${P95_LIMIT_MS}`, `p(99)<${P99_LIMIT_MS}`],
    http_req_failed: [`rate<${HTTP_FAILED_LIMIT}`],
    errors: [`rate<${APP_ERROR_LIMIT}`],
  },
};

const PAGES = ['/', '/pricing', '/guide'];
const API_ENDPOINTS = ['/api/v1/health'];

export default function () {
  const page = PAGES[Math.floor(Math.random() * PAGES.length)];
  const pageRes = http.get(`${BASE_URL}${page}`, {
    headers: { Accept: 'text/html' },
    tags: { type: 'page', profile: PROFILE, route: page },
  });

  const pageOk = check(pageRes, {
    'page status 200': (r) => r.status === 200,
    'page response < 5s': (r) => r.timings.duration < 5000,
  });
  errorRate.add(!pageOk);

  sleep(Math.random() * 2 + 0.5);

  if (Math.random() < 0.3) {
    const apiPath = API_ENDPOINTS[Math.floor(Math.random() * API_ENDPOINTS.length)];
    const apiRes = http.get(`${BASE_URL}${apiPath}`, {
      headers: { Accept: 'application/json' },
      tags: { type: 'api', profile: PROFILE, route: apiPath },
    });
    apiLatency.add(apiRes.timings.duration);

    check(apiRes, {
      'api responds': (r) => r.status !== 500,
    });
  }

  sleep(Math.random() * 1 + 0.2);
}

export function handleSummary(data) {
  const durationMs = data.state?.testRunDurationMs || 0;
  const totalRequests = data.metrics?.http_reqs?.values?.count || 0;
  const throughput = data.metrics?.http_reqs?.values?.rate || 0;
  const httpFailureRate = data.metrics?.http_req_failed?.values?.rate || 0;
  const p95 = data.metrics?.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics?.http_req_duration?.values?.['p(99)'] ?? null;
  const appErrorRate = data.metrics?.errors?.values?.rate || 0;
  const apiLatencyAvg = data.metrics?.api_latency?.values?.avg || 0;

  const verdict =
    appErrorRate <= APP_ERROR_LIMIT && p95 <= P95_LIMIT_MS
      ? 'PASS - peak load gate satisfied'
      : 'FAIL - thresholds not met';
  const report = buildLoadTestSummary({
    title: 'CASHPILOT PEAK/DAILY LOAD TEST REPORT',
    scriptName: 'load-test-cashpilot.js',
    baseUrl: BASE_URL,
    profile: PROFILE,
    stageSummary: {
      duration: formatSeconds(durationMs),
      totalRequests,
      throughput,
      httpFailureRate,
      p95,
      p99,
    },
    metrics: [
      { label: 'app_error_rate', value: formatPercent(appErrorRate) },
      { label: 'api_latency_avg', value: `${apiLatencyAvg.toFixed(0)}ms` },
    ],
    thresholds: {
      p95: P95_LIMIT_MS,
      p99: P99_LIMIT_MS,
      httpReqFailed: HTTP_FAILED_LIMIT,
      appErrorRate: APP_ERROR_LIMIT,
    },
    verdict,
    notes: [`profile=${PROFILE}`, `report_dir=${REPORT_PATHS.reportDir}`],
  });

  return {
    stdout: report,
    [REPORT_PATHS.textPath]: report,
    [REPORT_PATHS.jsonPath]: JSON.stringify(
      {
        script: 'load-test-cashpilot.js',
        profile: PROFILE,
        baseUrl: BASE_URL,
        thresholds: {
          p95: P95_LIMIT_MS,
          p99: P99_LIMIT_MS,
          httpReqFailed: HTTP_FAILED_LIMIT,
          appErrorRate: APP_ERROR_LIMIT,
        },
        metrics: {
          durationMs,
          totalRequests,
          throughput,
          httpFailureRate,
          p95,
          p99,
          appErrorRate,
          apiLatencyAvg,
        },
        verdict,
      },
      null,
      2
    ),
  };
}
