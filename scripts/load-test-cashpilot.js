/**
 * CashPilot — Load Test (k6)
 * Target: https://cashpilot.tech
 * Scenario: 500 virtual users, realistic traffic mix
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 VUs
    { duration: '1m', target: 200 },   // Ramp up to 200 VUs
    { duration: '1m', target: 500 },   // Peak: 500 VUs
    { duration: '30s', target: 500 },  // Hold at 500 VUs
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],  // 95% of requests under 3s
    http_req_failed: ['rate<0.05'],     // Error rate < 5%
    errors: ['rate<0.05'],
  },
};

const BASE_URL = 'https://cashpilot.tech';

const PAGES = [
  '/',
  '/pricing',
  '/guide',
];

const API_ENDPOINTS = [
  '/api/v1/health',  // lightweight health check
];

export default function () {
  // 70% — Static page loads (landing, pricing)
  const page = PAGES[Math.floor(Math.random() * PAGES.length)];
  const pageRes = http.get(`${BASE_URL}${page}`, {
    headers: { 'Accept': 'text/html' },
    tags: { type: 'page' },
  });

  const pageOk = check(pageRes, {
    'page status 200': (r) => r.status === 200,
    'page response < 5s': (r) => r.timings.duration < 5000,
  });
  errorRate.add(!pageOk);

  sleep(Math.random() * 2 + 0.5); // 0.5–2.5s think time

  // 30% — API endpoint checks
  if (Math.random() < 0.3) {
    const apiRes = http.get(`${BASE_URL}/api/v1/health`, {
      headers: { 'Accept': 'application/json' },
      tags: { type: 'api' },
    });
    apiLatency.add(apiRes.timings.duration);

    check(apiRes, {
      'api responds': (r) => r.status !== 500,
    });
  }

  sleep(Math.random() * 1 + 0.2);
}
