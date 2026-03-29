#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const BASE_URL = (process.env.ALL_MODULES_BASE_URL || 'http://127.0.0.1:4173').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'all-modules-smoke');
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());

const AUTH_ROUTES = [
  { key: 'app-dashboard', path: '/app' },
  { key: 'app-onboarding', path: '/app/onboarding' },
  { key: 'clients', path: '/app/clients' },
  { key: 'client-profile', path: '/app/clients/:id' },
  { key: 'crm', path: '/app/crm' },
  { key: 'crm-section', path: '/app/crm/:section' },
  { key: 'ged-hub', path: '/app/ged-hub' },
  { key: 'projects', path: '/app/projects' },
  { key: 'project-detail', path: '/app/projects/:projectId' },
  { key: 'hr-material', path: '/app/hr-material' },
  { key: 'rh-employes', path: '/app/rh/employes' },
  { key: 'rh-paie', path: '/app/rh/paie' },
  { key: 'rh-absences', path: '/app/rh/absences' },
  { key: 'rh-recrutement', path: '/app/rh/recrutement' },
  { key: 'rh-onboarding', path: '/app/rh/onboarding' },
  { key: 'rh-formation', path: '/app/rh/formation' },
  { key: 'rh-competences', path: '/app/rh/competences' },
  { key: 'rh-qvt', path: '/app/rh/qvt' },
  { key: 'rh-entretiens', path: '/app/rh/entretiens' },
  { key: 'rh-people-review', path: '/app/rh/people-review' },
  { key: 'rh-bilan-social', path: '/app/rh/bilan-social' },
  { key: 'rh-analytics', path: '/app/rh/analytics' },
  { key: 'timesheets', path: '/app/timesheets' },
  { key: 'invoices', path: '/app/invoices' },
  { key: 'recurring-invoices', path: '/app/recurring-invoices' },
  { key: 'credit-notes', path: '/app/credit-notes' },
  { key: 'delivery-notes', path: '/app/delivery-notes' },
  { key: 'quotes', path: '/app/quotes' },
  { key: 'expenses', path: '/app/expenses' },
  { key: 'purchase-orders', path: '/app/purchase-orders' },
  { key: 'purchases', path: '/app/purchases' },
  { key: 'supplier-invoices', path: '/app/supplier-invoices' },
  { key: 'peppol', path: '/app/peppol' },
  { key: 'stock', path: '/app/stock' },
  { key: 'services', path: '/app/services' },
  { key: 'categories', path: '/app/categories' },
  { key: 'suppliers-stock-redirect', path: '/app/suppliers/stock' },
  { key: 'suppliers', path: '/app/suppliers' },
  { key: 'suppliers-reports', path: '/app/suppliers/reports' },
  { key: 'suppliers-accounting', path: '/app/suppliers/accounting' },
  { key: 'supplier-profile', path: '/app/suppliers/:supplierId' },
  { key: 'suppliers-map', path: '/app/suppliers/map' },
  { key: 'products-barcode', path: '/app/products/barcode' },
  { key: 'reports-generator', path: '/app/reports/generator' },
  { key: 'notifications', path: '/app/notifications' },
  { key: 'debt-manager', path: '/app/debt-manager' },
  { key: 'scenarios', path: '/app/scenarios' },
  { key: 'scenario-detail', path: '/app/scenarios/:scenarioId' },
  { key: 'cash-flow', path: '/app/cash-flow' },
  { key: 'audit-comptable', path: '/app/audit-comptable' },
  { key: 'pilotage', path: '/app/pilotage' },
  { key: 'bank-connections', path: '/app/bank-connections' },
  { key: 'financial-instruments', path: '/app/financial-instruments' },
  { key: 'portfolio', path: '/app/portfolio' },
  { key: 'integrations', path: '/app/integrations' },
  { key: 'bank-callback', path: '/app/bank-callback' },
  { key: 'analytics', path: '/app/analytics' },
  { key: 'security', path: '/app/security' },
  { key: 'webhooks', path: '/app/webhooks' },
  { key: 'api-mcp', path: '/app/api-mcp' },
  { key: 'cfo-agent', path: '/app/cfo-agent' },
  { key: 'tafire', path: '/app/tafire' },
  { key: 'syscohada-balance-sheet', path: '/app/syscohada/balance-sheet' },
  { key: 'syscohada-income-statement', path: '/app/syscohada/income-statement' },
  { key: 'mobile-money', path: '/app/mobile-money' },
  { key: 'cash-flow-forecast', path: '/app/cash-flow-forecast' },
  { key: 'accountant-portal', path: '/app/accountant-portal' },
  { key: 'accountant-dashboard', path: '/app/accountant-dashboard' },
  { key: 'embedded-banking', path: '/app/embedded-banking' },
  { key: 'consolidation', path: '/app/consolidation' },
  { key: 'smart-dunning', path: '/app/smart-dunning' },
  { key: 'employee-portal', path: '/app/employee-portal' },
  { key: 'recon-ia', path: '/app/recon-ia' },
  { key: 'tax-filing', path: '/app/tax-filing' },
  { key: 'regulatory-intel', path: '/app/regulatory-intel' },
  { key: 'inter-company', path: '/app/inter-company' },
  { key: 'open-api', path: '/app/open-api' },
  { key: 'pdp-compliance', path: '/app/pdp-compliance' },
  { key: 'settings', path: '/app/settings' },
];

const PUBLIC_ROUTES = [
  { key: 'landing', path: '/' },
  { key: 'login', path: '/login' },
  { key: 'signup', path: '/signup' },
  { key: 'forgot-password', path: '/forgot-password' },
  { key: 'reset-password', path: '/reset-password' },
  { key: 'pricing', path: '/pricing' },
  { key: 'peppol-guide', path: '/peppol-guide' },
  { key: 'privacy', path: '/privacy' },
  { key: 'legal', path: '/legal' },
  { key: 'quote-sign', path: '/quote-sign/:token' },
  { key: 'payment-success', path: '/payment-success?invoice=:invoiceId' },
  { key: 'shared-snapshot', path: '/shared/:token' },
  { key: 'dashboard-legacy-redirect', path: '/dashboard' },
  { key: 'client-portal', path: '/client-portal' },
  { key: 'admin', path: '/admin' },
  { key: 'admin-seed-data', path: '/admin/seed-data' },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

function substitutePath(template, context) {
  return template
    .replace(':id', context.clientId)
    .replace(':projectId', context.projectId)
    .replace(':scenarioId', context.scenarioId)
    .replace(':supplierId', context.supplierId)
    .replace(':section', 'support')
    .replace(':token', 'demo-token')
    .replace(':invoiceId', context.invoiceId);
}

function hasFatalUiError(pageText) {
  const fatalPatterns = [
    /unexpected application error/i,
    /something went wrong/i,
    /une erreur est survenue/i,
    /cannot read properties of undefined/i,
  ];
  return fatalPatterns.some((pattern) => pattern.test(pageText));
}

async function dismissOverlays(page) {
  const cookieAccept = page.getByRole('button', { name: /tout accepter|accept all|accept|accepter/i }).first();
  if (await cookieAccept.isVisible().catch(() => false)) {
    await cookieAccept.click().catch(() => {});
  }
  const skip = page.getByRole('button', { name: /passer|skip|ignorer/i }).first();
  if (await skip.isVisible().catch(() => false)) {
    await skip.click().catch(() => {});
  }
}

async function getUserByEmail(client, email) {
  for (let page = 1; page <= 30; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = (data?.users || []).find(
      (entry) => String(entry.email || '').toLowerCase() === String(email).toLowerCase(),
    );
    if (found) return found;
    if (!(data?.users || []).length) break;
  }
  return null;
}

async function getRuntimeContext(serviceClient, email) {
  const user = await getUserByEmail(serviceClient, email);
  if (!user) throw new Error(`User not found: ${email}`);

  const { data: companies, error: companiesError } = await serviceClient
    .from('company')
    .select('id, company_name')
    .eq('user_id', user.id)
    .order('company_name', { ascending: true });
  if (companiesError) throw companiesError;
  if (!companies?.length) throw new Error(`No company for user ${email}`);

  const { data: prefs, error: prefsError } = await serviceClient
    .from('user_company_preferences')
    .select('active_company_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (prefsError && prefsError.code !== 'PGRST116') throw prefsError;

  const activeCompany =
    companies.find((company) => company.id === prefs?.active_company_id) ||
    companies.find((company) => /SRL|SAS|SARL|BV/i.test(company.company_name || '')) ||
    companies[0];

  const [clients, suppliers, projects, scenarios, invoices] = await Promise.all([
    serviceClient.from('clients').select('id').eq('company_id', activeCompany.id).limit(1),
    serviceClient.from('suppliers').select('id').eq('company_id', activeCompany.id).limit(1),
    serviceClient.from('projects').select('id').eq('company_id', activeCompany.id).limit(1),
    serviceClient.from('financial_scenarios').select('id').eq('company_id', activeCompany.id).limit(1),
    serviceClient.from('invoices').select('id').eq('company_id', activeCompany.id).limit(1),
  ]);

  for (const entry of [clients, suppliers, projects, scenarios, invoices]) {
    if (entry.error) throw entry.error;
  }

  return {
    userId: user.id,
    companyId: activeCompany.id,
    companyName: activeCompany.company_name,
    clientId: clients.data?.[0]?.id || '',
    supplierId: suppliers.data?.[0]?.id || '',
    projectId: projects.data?.[0]?.id || '',
    scenarioId: scenarios.data?.[0]?.id || '',
    invoiceId: invoices.data?.[0]?.id || '',
  };
}

async function testRoute(page, route, context, bucket) {
  const resolvedPath = substitutePath(route.path, context);
  const url = `${BASE_URL}${resolvedPath}`;
  const result = {
    bucket,
    key: route.key,
    path: route.path,
    resolvedPath,
    passed: false,
    finalPath: null,
    error: null,
  };

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await dismissOverlays(page);

    const finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
    const text = (await page.locator('body').innerText().catch(() => '')) || '';

    result.finalPath = finalPath;
    if (hasFatalUiError(text)) {
      throw new Error('Fatal UI error text detected');
    }
    result.passed = true;
  } catch (error) {
    result.error = error?.message || String(error);
    await ensureDir(OUTPUT_DIR);
    const shot = path.join(OUTPUT_DIR, `${bucket}-${route.key}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    result.screenshot = shot;
  }

  return result;
}

async function login(page, email, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await dismissOverlays(page);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('form button[type=\"submit\"]').click();
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);
}

async function main() {
  const email = process.env.MODULE_TEST_EMAIL || 'smoke.be.user.20260324@cashpilot.cloud';
  const password = process.env.MODULE_TEST_PASSWORD || 'SmokeBE#2026!A9';
  const serviceClient = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const runtime = await getRuntimeContext(serviceClient, email);
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({ headless: HEADLESS });
  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    email,
    runtime,
    totals: {
      public: PUBLIC_ROUTES.length,
      auth: AUTH_ROUTES.length,
      total: PUBLIC_ROUTES.length + AUTH_ROUTES.length,
      passed: 0,
      failed: 0,
    },
    consoleErrors: [],
    pageErrors: [],
    results: [],
  };

  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 960 }, ignoreHTTPSErrors: true, locale: 'fr-BE' });
    const publicPage = await publicContext.newPage();
    publicPage.setDefaultTimeout(DEFAULT_TIMEOUT);
    publicPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        summary.consoleErrors.push({ bucket: 'public', text: msg.text() });
      }
    });
    publicPage.on('pageerror', (error) => {
      summary.pageErrors.push({ bucket: 'public', message: error.message });
    });

    for (const route of PUBLIC_ROUTES) {
      summary.results.push(await testRoute(publicPage, route, runtime, 'public'));
    }
    await publicContext.close();

    const authContext = await browser.newContext({ viewport: { width: 1440, height: 960 }, ignoreHTTPSErrors: true, locale: 'fr-BE' });
    const authPage = await authContext.newPage();
    authPage.setDefaultTimeout(DEFAULT_TIMEOUT);
    authPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        summary.consoleErrors.push({ bucket: 'auth', text: msg.text() });
      }
    });
    authPage.on('pageerror', (error) => {
      summary.pageErrors.push({ bucket: 'auth', message: error.message });
    });

    await login(authPage, email, password);
    await authPage.evaluate((activeCompanyId) => {
      window.localStorage.setItem('cashpilot.activeCompanyId', activeCompanyId);
      window.dispatchEvent(new CustomEvent('cashpilot:active-company-changed', { detail: activeCompanyId }));
    }, runtime.companyId);
    await authPage.reload({ waitUntil: 'domcontentloaded' });
    await authPage.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});

    for (const route of AUTH_ROUTES) {
      summary.results.push(await testRoute(authPage, route, runtime, 'auth'));
    }
    await authContext.close();
  } finally {
    await browser.close();
  }

  summary.totals.passed = summary.results.filter((item) => item.passed).length;
  summary.totals.failed = summary.results.filter((item) => !item.passed).length;
  summary.passed = summary.totals.failed === 0;

  const summaryPath = path.join(OUTPUT_DIR, 'summary.json');
  await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ summaryPath, passed: summary.passed, totals: summary.totals }, null, 2));
  if (!summary.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[smoke-all-modules-playwright] fatal:', error?.stack || error?.message || String(error));
  process.exitCode = 1;
});

