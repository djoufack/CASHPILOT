/**
 * CashPilot - Soak Test (k6)
 *
 * BASE_URL is configurable through __ENV.BASE_URL or __ENV.K6_BASE_URL.
 * Soak duration and VUs can be tuned through environment variables.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
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
const PROFILE = resolveProfile(undefined, 'soak');
const REPORT_PATHS = buildReportPaths('load-test-soak.js');

const TARGET_VUS = parseInteger(globalThis.__ENV?.K6_TARGET_VUS || globalThis.__ENV?.LOAD_TEST_VUS, 100);
const RAMP_UP_MINUTES = parseInteger(
  globalThis.__ENV?.K6_RAMP_UP_MINUTES || globalThis.__ENV?.LOAD_TEST_RAMP_UP_MINUTES,
  2
);
const SOAK_MINUTES = parseInteger(
  globalThis.__ENV?.K6_SOAK_MINUTES || globalThis.__ENV?.LOAD_TEST_DURATION_MINUTES,
  26
);
const RAMP_DOWN_MINUTES = parseInteger(
  globalThis.__ENV?.K6_RAMP_DOWN_MINUTES || globalThis.__ENV?.LOAD_TEST_RAMP_DOWN_MINUTES,
  2
);
const P95_LIMIT_MS = parseInteger(globalThis.__ENV?.LOAD_TEST_P95_MS, 2000);
const P99_LIMIT_MS = parseInteger(globalThis.__ENV?.LOAD_TEST_P99_MS, 5000);
const HTTP_FAILED_LIMIT = parseFloatValue(globalThis.__ENV?.LOAD_TEST_HTTP_FAILED_RATE, 0.02);
const APP_ERROR_LIMIT = parseFloatValue(globalThis.__ENV?.LOAD_TEST_APP_ERROR_RATE, 0.01);

const appErrorRate = new Rate('app_errors');
const authExpected = new Counter('auth_401_expected');
const p95Latency = new Trend('p95_latency_tracker');

export const options = {
  stages: [
    { duration: `${RAMP_UP_MINUTES}m`, target: TARGET_VUS },
    { duration: `${SOAK_MINUTES}m`, target: TARGET_VUS },
    { duration: `${RAMP_DOWN_MINUTES}m`, target: 0 },
  ],
  thresholds: {
    app_errors: [`rate<${APP_ERROR_LIMIT}`],
    http_req_duration: [`p(95)<${P95_LIMIT_MS}`, `p(99)<${P99_LIMIT_MS}`],
    http_req_failed: [`rate<${HTTP_FAILED_LIMIT}`],
  },
};

const PUBLIC_PAGES = ['/', '/pricing', '/status', '/legal', '/privacy'];
const API_ENDPOINTS = [
  { path: '/api/v1/health', expected401: true },
  { path: '/mcp', expected401: true },
];

export default function () {
  const page = PUBLIC_PAGES[Math.floor(Math.random() * PUBLIC_PAGES.length)];
  const res = http.get(`${BASE_URL}${page}`, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    tags: { type: 'page', profile: PROFILE, route: page },
  });

  p95Latency.add(res.timings.duration);

  check(res, {
    'page: status 200': (r) => r.status === 200,
    'page: not 5xx': (r) => r.status < 500,
    'page: response < 5s': (r) => r.timings.duration < 5000,
    'page: has content': (r) => r.body && r.body.length > 100,
  });

  if (res.status >= 500 || res.status === 404) {
    appErrorRate.add(1);
  } else {
    appErrorRate.add(0);
  }

  sleep(Math.random() * 1.5 + 0.5);

  if (Math.random() < 0.3) {
    const ep = API_ENDPOINTS[Math.floor(Math.random() * API_ENDPOINTS.length)];
    const apiRes = http.get(`${BASE_URL}${ep.path}`, {
      headers: { Accept: 'application/json' },
      tags: { type: 'api', profile: PROFILE, route: ep.path },
    });

    if (ep.expected401 && apiRes.status === 401) {
      authExpected.add(1);
      check(apiRes, {
        'api: 401 correctly rejected (expected)': (r) => r.status === 401,
        'api: returns JSON error': (r) => {
          try {
            JSON.parse(r.body);
            return true;
          } catch {
            return false;
          }
        },
      });
    } else {
      check(apiRes, {
        'api: not 5xx': (r) => r.status < 500,
      });

      if (apiRes.status >= 500) {
        appErrorRate.add(1);
      } else {
        appErrorRate.add(0);
      }
    }
  }

  sleep(Math.random() * 1 + 0.2);
}

export function handleSummary(data) {
  const durationMs = data.state?.testRunDurationMs || 0;
  const appErrRate = data.metrics?.app_errors?.values?.rate || 0;
  const p95 = data.metrics?.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics?.http_req_duration?.values?.['p(99)'] ?? null;
  const totalRequests = data.metrics?.http_reqs?.values?.count || 0;
  const auth401 = data.metrics?.auth_401_expected?.values?.count || 0;
  const throughput = data.metrics?.http_reqs?.values?.rate || 0;
  const httpFailureRate = data.metrics?.http_req_failed?.values?.rate || 0;

  const verdict =
    appErrRate <= APP_ERROR_LIMIT && p95 <= P95_LIMIT_MS ? 'PASS - soak gate satisfied' : 'FAIL - thresholds not met';
  const report = buildLoadTestSummary({
    title: 'CASHPILOT SOAK TEST REPORT',
    scriptName: 'load-test-soak.js',
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
      { label: 'app_error_rate', value: formatPercent(appErrRate) },
      { label: 'auth_401_expected', value: auth401.toLocaleString() },
    ],
    thresholds: {
      p95: P95_LIMIT_MS,
      p99: P99_LIMIT_MS,
      httpReqFailed: HTTP_FAILED_LIMIT,
      appErrorRate: APP_ERROR_LIMIT,
    },
    verdict,
    notes: [
      `profile=${PROFILE}`,
      `vus=${TARGET_VUS}`,
      `ramp_up=${RAMP_UP_MINUTES}m`,
      `soak=${SOAK_MINUTES}m`,
      `ramp_down=${RAMP_DOWN_MINUTES}m`,
      `report_dir=${REPORT_PATHS.reportDir}`,
    ],
  });

  return {
    stdout: report,
    [REPORT_PATHS.textPath]: report,
    [REPORT_PATHS.jsonPath]: JSON.stringify(
      {
        script: 'load-test-soak.js',
        profile: PROFILE,
        baseUrl: BASE_URL,
        thresholds: {
          p95: P95_LIMIT_MS,
          p99: P99_LIMIT_MS,
          httpReqFailed: HTTP_FAILED_LIMIT,
          appErrorRate: APP_ERROR_LIMIT,
        },
        stages: {
          rampUpMinutes: RAMP_UP_MINUTES,
          soakMinutes: SOAK_MINUTES,
          rampDownMinutes: RAMP_DOWN_MINUTES,
          targetVus: TARGET_VUS,
        },
        metrics: {
          durationMs,
          totalRequests,
          throughput,
          httpFailureRate,
          p95,
          p99,
          appErrRate,
          auth401,
        },
        verdict,
      },
      null,
      2
    ),
  };
}
