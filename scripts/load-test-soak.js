/**
 * CashPilot — Soak Test (k6)
 * Objectif : valider la stabilité sur la durée (Enterprise readiness)
 * Durée : 30 minutes à 100 VUs constants
 *
 * Classification explicite des statuts attendus :
 *   - 200 : succès normal
 *   - 401 : attendu sur /api/v1/* sans token (non compté comme erreur)
 *   - 404 : page non trouvée (erreur réelle)
 *   - 5xx : erreur serveur (erreur critique)
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Métriques personnalisées
const appErrorRate = new Rate('app_errors'); // Vraies erreurs (5xx, 404 inattendu)
const authExpected = new Counter('auth_401_expected'); // 401 attendus — NOT errors
const p95Latency = new Trend('p95_latency_tracker');

export const options = {
  // Soak test : montée progressive, palier long, descente
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '26m', target: 100 }, // Soak — 26 min à 100 VUs
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    // Seuils Enterprise — clés distinctes pour éviter l'écrasement JS
    app_errors: ['rate<0.01'], // < 1% d'erreurs applicatives réelles
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // p95 < 2s ET p99 < 5s (même clé, tableau)
    // NOTE: http_req_failed inclut les 401 attendus — on utilise app_errors à la place
  },
};

const BASE_URL = 'https://cashpilot.tech';

// Pages publiques (sans auth)
const PUBLIC_PAGES = ['/', '/pricing', '/status', '/legal', '/privacy'];

// Endpoints API (401 attendus sans token — comportement correct)
const API_ENDPOINTS = [
  { path: '/api/v1/health', expected401: true },
  { path: '/mcp', expected401: true }, // MCP endpoint — doit répondre JSON 401
];

export default function () {
  // ── 70% — Pages publiques ──────────────────────────────────────────────
  const page = PUBLIC_PAGES[Math.floor(Math.random() * PUBLIC_PAGES.length)];
  const res = http.get(`${BASE_URL}${page}`, {
    headers: { Accept: 'text/html,application/xhtml+xml' },
    tags: { type: 'page', path: page },
  });

  p95Latency.add(res.timings.duration);

  check(res, {
    'page: status 200': (r) => r.status === 200,
    'page: not 5xx': (r) => r.status < 500,
    'page: response < 5s': (r) => r.timings.duration < 5000,
    'page: has content': (r) => r.body && r.body.length > 100,
  });

  // Vraie erreur = 5xx ou 404 sur une page qui doit exister
  if (res.status >= 500 || res.status === 404) {
    appErrorRate.add(1);
  } else {
    appErrorRate.add(0);
  }

  sleep(Math.random() * 1.5 + 0.5);

  // ── 30% — Endpoints API ────────────────────────────────────────────────
  if (Math.random() < 0.3) {
    const ep = API_ENDPOINTS[Math.floor(Math.random() * API_ENDPOINTS.length)];
    const apiRes = http.get(`${BASE_URL}${ep.path}`, {
      headers: { Accept: 'application/json' },
      tags: { type: 'api', path: ep.path },
    });

    if (ep.expected401 && apiRes.status === 401) {
      // 401 attendu — classifier explicitement comme non-erreur
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
      if (apiRes.status >= 500) appErrorRate.add(1);
      else appErrorRate.add(0);
    }
  }

  sleep(Math.random() * 1 + 0.2);
}

export function handleSummary(data) {
  const duration = data.state?.testRunDurationMs || 0;
  const appErrRate = data.metrics?.app_errors?.values?.rate || 0;
  const p95 = data.metrics?.http_req_duration?.values?.['p(95)'] || 0;
  const p99 = data.metrics?.http_req_duration?.values?.['p(99)'] ?? null;
  const totalReqs = data.metrics?.http_reqs?.values?.count || 0;
  const auth401 = data.metrics?.auth_401_expected?.values?.count || 0;
  const throughput = data.metrics?.http_reqs?.values?.rate || 0;

  const report = `
================================================================================
  CASHPILOT — SOAK TEST REPORT (Enterprise Readiness)
  Date: ${new Date().toISOString()}
  Duration: ${Math.round(duration / 60000)} min | VUs: 100 constants
================================================================================

RÉSULTATS CLÉS
──────────────
  Total requêtes         : ${totalReqs.toLocaleString()}
  Débit moyen            : ${throughput.toFixed(1)} req/s
  401 attendus (auth)    : ${auth401.toLocaleString()} — CLASSIFIÉS NON-ERREURS ✓

LATENCES
────────
  p(95)                  : ${p95.toFixed(0)}ms  ${p95 < 2000 ? '✅ < 2s' : '❌ > 2s'}
  p(99)                  : ${p99 !== null ? p99.toFixed(0) + 'ms' : 'N/A (stat non collectée)'}  ${p99 === null ? '⚠️' : p99 < 5000 ? '✅ < 5s' : '❌ > 5s'}

FIABILITÉ
─────────
  Erreurs applicatives   : ${(appErrRate * 100).toFixed(2)}%  ${appErrRate < 0.01 ? '✅ < 1%' : '❌ > 1%'}

VERDICT ENTERPRISE
──────────────────
  ${appErrRate < 0.01 && p95 < 2000 ? '✅ GO Enterprise — SLA tenu sur 30 minutes' : '❌ NO GO — seuils non atteints'}
  Note: p(99) nécessite --out json pour collecte complète des percentiles

================================================================================
`;

  return {
    stdout: report,
    '/tmp/soak-test-report.txt': report,
  };
}
