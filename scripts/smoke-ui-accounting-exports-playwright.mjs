import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-accounting-exports');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const BROWSER_CHANNELS = [
  process.env.PLAYWRIGHT_CHANNEL || 'msedge',
  'chrome',
].filter(Boolean);

const ACCOUNTS = [
  {
    key: 'FR',
    email: process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_FR_PASSWORD,
  },
  {
    key: 'BE',
    email: process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_BE_PASSWORD,
  },
  {
    key: 'OHADA',
    email: process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_OHADA_PASSWORD,
  },
];

function requirePasswords() {
  const missing = ACCOUNTS.filter((account) => !account.password).map((account) => `PILOTAGE_${account.key}_PASSWORD`);
  if (missing.length > 0) {
    throw new Error(`Missing environment variable(s): ${missing.join(', ')}`);
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

async function dismissOverlays(page) {
  const skipTourButton = page.getByRole('button', { name: /Passer|Skip/i }).first();
  if (await skipTourButton.isVisible().catch(() => false)) {
    await skipTourButton.click();
  }

  const acceptCookiesButton = page.getByRole('button', { name: /Tout accepter|Accept all/i }).first();
  if (await acceptCookiesButton.isVisible().catch(() => false)) {
    await acceptCookiesButton.click();
  }
}

async function login(page, account) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);
}

async function checkDashboardExports(page) {
  await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app(?:[?#].*)?$/, { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);

  const pdfButton = page.getByRole('button', { name: /PDF/i }).first();
  const htmlButton = page.getByRole('button', { name: /HTML/i }).first();
  await pdfButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await htmlButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  return { ok: true, page: '/app' };
}

async function checkAnalyticsExports(page) {
  await page.goto(`${BASE_URL}/app/analytics`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app\/analytics(?:[?#].*)?$/, { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);

  const pdfButton = page.getByRole('button', { name: /PDF/i }).first();
  const htmlButton = page.getByRole('button', { name: /HTML/i }).first();
  await pdfButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await htmlButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  return { ok: true, page: '/app/analytics' };
}

async function checkAccountingExports(page) {
  await page.goto(`${BASE_URL}/app/suppliers/accounting`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app\/suppliers\/accounting(?:[?#].*)?$/, { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);

  await page.getByRole('heading', { name: /Comptabilité/i }).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  const bilanTab = page.getByRole('tab', { name: /Bilan/i }).first();
  await bilanTab.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await bilanTab.click();

  const pdfButton = page.getByRole('button', { name: /^PDF$/i }).first();
  await pdfButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  return { ok: true, page: '/app/suppliers/accounting', tab: 'Bilan' };
}

async function checkAuditPage(page) {
  await page.goto(`${BASE_URL}/app/audit-comptable`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app\/audit-comptable(?:[?#].*)?$/, { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);

  await page.getByText(/Audit|comptable|Score|Conformité/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  return { ok: true, page: '/app/audit-comptable' };
}

async function captureFailure(page, accountKey, label) {
  const screenshotPath = path.join(OUTPUT_DIR, `${accountKey}-${label}.png`);
  await ensureDir(OUTPUT_DIR);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function runAccount(browser, account) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: 'fr-FR',
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript((language, gdprConsent) => {
    window.localStorage.setItem('cashpilot_language', language);
    window.localStorage.setItem('cashpilot-onboarding-done', 'true');
    window.localStorage.setItem('cashpilot_gdpr_consent', JSON.stringify(gdprConsent));
  }, 'fr', {
    necessary: true,
    cookies: true,
    analytics: true,
    marketing: true,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);

  const result = {
    key: account.key,
    email: account.email,
    passed: false,
    checks: [],
    failures: [],
  };

  const steps = [
    { key: 'dashboard_exports', fn: checkDashboardExports },
    { key: 'analytics_exports', fn: checkAnalyticsExports },
    { key: 'accounting_exports', fn: checkAccountingExports },
    { key: 'audit_page', fn: checkAuditPage },
  ];

  try {
    await login(page, account);

    for (const step of steps) {
      try {
        const detail = await step.fn(page);
        result.checks.push({ key: step.key, passed: true, detail });
      } catch (error) {
        const screenshot = await captureFailure(page, account.key, step.key);
        result.checks.push({
          key: step.key,
          passed: false,
          error: error.message,
          screenshot,
        });
        result.failures.push(`${step.key}: ${error.message}`);
      }
    }

    result.passed = result.checks.every((check) => check.passed);
  } catch (error) {
    const screenshot = await captureFailure(page, account.key, 'fatal');
    result.failures.push(`fatal: ${error.message}`);
    result.screenshot = screenshot;
    result.passed = false;
  } finally {
    await context.close();
  }

  return result;
}

async function launchBrowser() {
  const launchErrors = [];

  for (const channel of BROWSER_CHANNELS) {
    try {
      return await chromium.launch({ headless: HEADLESS, channel });
    } catch (error) {
      launchErrors.push(`${channel}: ${error.message}`);
    }
  }

  try {
    return await chromium.launch({ headless: HEADLESS });
  } catch (error) {
    launchErrors.push(`bundled: ${error.message}`);
    throw new Error(`Unable to launch Playwright browser. Tried ${launchErrors.join(' | ')}`);
  }
}

async function main() {
  requirePasswords();
  await ensureDir(OUTPUT_DIR);

  const startedAt = new Date().toISOString();
  const browser = await launchBrowser();

  try {
    const accounts = [];
    for (const account of ACCOUNTS) {
      accounts.push(await runAccount(browser, account));
    }

    const summary = {
      baseUrl: BASE_URL,
      startedAt,
      finishedAt: new Date().toISOString(),
      passed: accounts.every((entry) => entry.passed),
      accounts,
    };

    await writeJson(path.join(OUTPUT_DIR, 'summary.json'), summary);
    console.log(JSON.stringify(summary, null, 2));

    if (!summary.passed) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});