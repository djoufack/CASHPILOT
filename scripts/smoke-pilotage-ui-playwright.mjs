import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-smoke');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const BROWSER_CHANNELS = [
  process.env.PLAYWRIGHT_CHANNEL || 'msedge',
  'chrome',
].filter(Boolean);

const DEMO_ACCOUNTS = [
  {
    key: 'FR',
    email: process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_FR_PASSWORD || 'PilotageFR#2026!',
    primaryCompany: 'CashPilot Demo France SAS',
    secondaryCompany: 'CashPilot Demo France Portfolio SARL',
    checks: {
      purchases: 'SO-FR-2026-901',
      supplierInvoices: 'SUP-FR-2026-901',
      stock: 'FR-PORT-001',
      bank: 'Banque Demo France',
      peppol: 'FR-PORT-2026-001',
    },
  },
  {
    key: 'BE',
    email: process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_BE_PASSWORD || 'PilotageBE#2026!',
    primaryCompany: 'CashPilot Demo Belgium SRL',
    secondaryCompany: 'CashPilot Demo Belgium Portfolio BV',
    checks: {
      purchases: 'SO-BE-2026-901',
      supplierInvoices: 'SUP-BE-2026-901',
      stock: 'BE-PORT-001',
      bank: 'Banque Demo Belgique',
      peppol: 'BE-PORT-2026-001',
    },
  },
  {
    key: 'OHADA',
    email: process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
    password: process.env.PILOTAGE_OHADA_PASSWORD || 'PilotageOHADA#2026!',
    primaryCompany: 'CashPilot Demo Afrique SARL',
    secondaryCompany: 'CashPilot Demo Afrique Portfolio SARL',
    checks: {
      purchases: 'SO-OHADA-2026-901',
      supplierInvoices: 'SUP-OHADA-2026-901',
      stock: 'OHADA-PORT-001',
      bank: 'Banque Demo Afrique',
      peppol: 'OHADA-PORT-2026-001',
    },
  },
];

const PAGE_CHECKS = [
  {
    key: 'purchases',
    path: '/app/purchases',
    expectedText: (account) => account.checks.purchases,
  },
  {
    key: 'supplierInvoices',
    path: '/app/supplier-invoices',
    expectedText: (account) => account.checks.supplierInvoices,
  },
  {
    key: 'stock',
    path: '/app/stock',
    expectedText: (account) => account.checks.stock,
  },
  {
    key: 'bankConnections',
    path: '/app/bank-connections',
    expectedText: (account) => account.checks.bank,
  },
  {
    key: 'peppol',
    path: '/app/peppol',
    expectedText: (account) => account.checks.peppol,
  },
];

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

async function launchBrowser() {
  const launchErrors = [];

  for (const channel of BROWSER_CHANNELS) {
    try {
      return await chromium.launch({
        headless: HEADLESS,
        channel,
      });
    } catch (error) {
      launchErrors.push(`${channel}: ${error.message}`);
    }
  }

  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return chromium.launch({
      headless: HEADLESS,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
  }

  throw new Error(`Unable to launch Playwright browser. Tried ${launchErrors.join(' | ')}`);
}

async function waitForText(page, text, timeout = DEFAULT_TIMEOUT) {
  await page.locator(`text=${text}`).first().waitFor({ state: 'visible', timeout });
}

async function captureFailure(page, accountKey, label) {
  const screenshotPath = path.join(OUTPUT_DIR, `${accountKey}-${label}.png`);
  await ensureDir(OUTPUT_DIR);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function login(page, account) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await page.locator('main').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
}

async function dismissInterferingOverlays(page) {
  const skipTourButton = page.getByRole('button', { name: /Passer|Skip/i }).first();
  if (await skipTourButton.isVisible().catch(() => false)) {
    await skipTourButton.click();
  }

  const acceptCookiesButton = page.getByRole('button', { name: /Tout accepter|Accept all/i }).first();
  if (await acceptCookiesButton.isVisible().catch(() => false)) {
    await acceptCookiesButton.click();
  }
}

async function switchToSecondaryCompany(page, account) {
  await dismissInterferingOverlays(page);

  const trigger = page.getByRole('button', { name: new RegExp(escapeRegex(account.primaryCompany)) }).first();
  await trigger.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await trigger.click();

  const target = page.getByRole('button', { name: new RegExp(escapeRegex(account.secondaryCompany)) }).first();
  await target.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await target.click();

  const activeButton = page.getByRole('button', { name: new RegExp(escapeRegex(account.secondaryCompany)) }).first();
  await activeButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
}

async function runPageCheck(page, account, check) {
  const result = {
    key: check.key,
    path: check.path,
    expectedText: check.expectedText(account),
    passed: false,
    screenshot: null,
    error: null,
  };

  try {
    await page.goto(`${BASE_URL}${check.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(new RegExp(`${escapeRegex(check.path)}(?:[?#].*)?$`), { timeout: DEFAULT_TIMEOUT });
    await waitForText(page, result.expectedText);
    result.passed = true;
  } catch (error) {
    result.error = error.message;
    result.screenshot = await captureFailure(page, account.key, check.key);
  }

  return result;
}

async function smokeAccount(browser, account) {
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

  const accountResult = {
    key: account.key,
    email: account.email,
    passed: false,
    login: false,
    switchedCompany: false,
    pageChecks: [],
    failures: [],
  };

  try {
    await login(page, account);
    accountResult.login = true;

    await switchToSecondaryCompany(page, account);
    accountResult.switchedCompany = true;

    for (const check of PAGE_CHECKS) {
      const pageResult = await runPageCheck(page, account, check);
      accountResult.pageChecks.push(pageResult);
      if (!pageResult.passed) {
        accountResult.failures.push(`${check.key}: ${pageResult.error}`);
      }
    }

    accountResult.passed = accountResult.pageChecks.every((check) => check.passed);
  } catch (error) {
    accountResult.failures.push(error.message);
    accountResult.screenshot = await captureFailure(page, account.key, 'fatal');
  } finally {
    await context.close();
  }

  return accountResult;
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  const startedAt = new Date().toISOString();
  const browser = await launchBrowser();

  try {
    const accounts = [];
    for (const account of DEMO_ACCOUNTS) {
      accounts.push(await smokeAccount(browser, account));
    }

    const summary = {
      baseUrl: BASE_URL,
      startedAt,
      finishedAt: new Date().toISOString(),
      passed: accounts.every((account) => account.passed),
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
