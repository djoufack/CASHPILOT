import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-sales-payment-link');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '45000', 10);

function requirePassword(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function loadAccounts() {
  const json = process.env.SALES_PAYMENT_SMOKE_ACCOUNTS_JSON;
  if (json && String(json).trim()) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('SALES_PAYMENT_SMOKE_ACCOUNTS_JSON must be a non-empty array');
    }

    return parsed.map((account, index) => {
      if (!account?.email || !account?.password) {
        throw new Error(`SALES_PAYMENT_SMOKE_ACCOUNTS_JSON entry ${index} must include email and password`);
      }

      return {
        key: String(account.key || `account-${index + 1}`),
        email: String(account.email).trim(),
        password: String(account.password),
      };
    });
  }

  const fallbackAccounts = [
    {
      key: 'FR',
      email: process.env.SALES_PAYMENT_SMOKE_FR_EMAIL || process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
      password: requirePassword('SALES_PAYMENT_SMOKE_FR_PASSWORD', 'PILOTAGE_FR_PASSWORD'),
    },
    {
      key: 'BE',
      email: process.env.SALES_PAYMENT_SMOKE_BE_EMAIL || process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
      password: requirePassword('SALES_PAYMENT_SMOKE_BE_PASSWORD', 'PILOTAGE_BE_PASSWORD'),
    },
    {
      key: 'OHADA',
      email:
        process.env.SALES_PAYMENT_SMOKE_OHADA_EMAIL || process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
      password: requirePassword('SALES_PAYMENT_SMOKE_OHADA_PASSWORD', 'PILOTAGE_OHADA_PASSWORD'),
    },
  ];

  const accounts = fallbackAccounts.filter((account) => account.password);
  if (accounts.length === 0) {
    throw new Error('No sales payment smoke accounts configured. Set SALES_PAYMENT_SMOKE_ACCOUNTS_JSON or demo password env vars.');
  }

  return accounts;
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
}

async function launchBrowser() {
  return chromium.launch({ headless: HEADLESS });
}

async function dismissOverlays(page) {
  const buttons = [
    page.getByRole('button', { name: /Passer|Skip/i }).first(),
    page.getByRole('button', { name: /Tout accepter|Accept all/i }).first(),
    page.getByRole('button', { name: /Accepter|Accept/i }).first(),
  ];

  for (const button of buttons) {
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => {});
    }
  }
}

async function login(page, account) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await dismissOverlays(page);
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await dismissOverlays(page);
  await page.locator('form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
}

async function openInvoices(page) {
  await page.goto(`${BASE_URL}/app/invoices`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await page.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
}

async function firstDataRow(page) {
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  if (count === 0) {
    throw new Error('No invoice rows available for sales payment-link smoke');
  }
  return rows.first();
}

async function firstVisible(locatorCandidates) {
  for (const locator of locatorCandidates) {
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  return null;
}

async function hasPaymentAction(scope) {
  const action = await firstVisible([
    scope.locator(
      'button[aria-label="Générer lien de paiement"], button[aria-label="Generate payment link"], button[aria-label="Betaallink genereren"], button[title="Générer lien de paiement"], button[title="Generate payment link"], button[title="Betaallink genereren"]'
    ).first(),
    scope.locator(
      'button[aria-label="Copier le lien"], button[aria-label="Copy link"], button[aria-label="Link kopiëren"], button[title="Copier le lien"], button[title="Copy link"], button[title="Link kopiëren"]'
    ).first(),
    scope.locator(
      'button[aria-label="Ouvrir le lien"], button[aria-label="Open link"], button[aria-label="Link openen"], button[title="Ouvrir le lien"], button[title="Open link"], button[title="Link openen"]'
    ).first(),
  ]);

  return Boolean(action);
}

async function findRowWithPaymentAction(page) {
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    if (await hasPaymentAction(row)) {
      return row;
    }
  }
  return null;
}

async function runAccount(page, account) {
  const result = {
    key: account.key,
    email: account.email,
    passed: false,
    checks: [],
    failures: [],
  };

  try {
    await login(page, account);
    await openInvoices(page);

    await page.getByText(/Factures|Invoices/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    result.checks.push('invoices-page-visible');

    await page.getByText(/Paiement|Payment|Betaling/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    result.checks.push('payment-column-visible');

    const row = (await findRowWithPaymentAction(page)) || (await firstDataRow(page));
    if (!(await hasPaymentAction(row))) {
      throw new Error('No invoice row with payment-link action available');
    }
    result.checks.push('row-payment-action-visible');

    const viewButton = await firstVisible([
      row.locator(
        'button[title="Visualiser"], button[title="View"], button[title="Bekijken"], button[aria-label="Visualiser"], button[aria-label="View"], button[aria-label="Bekijken"]'
      ).first(),
      row.getByRole('button', { name: /Visualiser|View|Bekijken/i }).first(),
    ]);

    if (!viewButton) {
      throw new Error('No invoice preview action visible in invoice row');
    }

    await viewButton.click();

    const dialog = page.getByRole('dialog').last();
    await dialog.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    if (!(await hasPaymentAction(dialog))) {
      throw new Error('No payment-link action visible in invoice preview');
    }
    result.checks.push('preview-payment-action-visible');
    result.passed = true;
  } catch (error) {
    result.failures.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

async function main() {
  const accounts = loadAccounts();
  const startedAt = new Date().toISOString();
  const browser = await launchBrowser();

  try {
    const results = [];
    for (const account of accounts) {
      const context = await browser.newContext({
        locale: 'fr-BE',
        ignoreHTTPSErrors: true,
      });
      await context.addInitScript(() => {
        try {
          window.localStorage.setItem('cashpilot_language', 'fr');
          window.localStorage.setItem('cashpilot-onboarding-done', 'true');
          window.localStorage.setItem('cookie-consent', 'accepted');
          window.localStorage.setItem(
            'cashpilot_gdpr_consent',
            JSON.stringify({
              necessary: true,
              cookies: true,
              analytics: true,
              marketing: true,
            })
          );
        } catch {
          // No-op in smoke context.
        }
      });

      const page = await context.newPage();
      page.setDefaultTimeout(DEFAULT_TIMEOUT);

      const result = await runAccount(page, account);
      results.push(result);
      await context.close();
    }

    const summary = {
      baseUrl: BASE_URL,
      startedAt,
      finishedAt: new Date().toISOString(),
      passed: results.every((entry) => entry.passed),
      results,
    };

    await ensureDir(OUTPUT_DIR);
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
