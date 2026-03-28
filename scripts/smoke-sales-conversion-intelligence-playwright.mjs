import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-sales-conversion-intelligence');
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
  const json = process.env.SALES_CONVERSION_SMOKE_ACCOUNTS_JSON;
  if (json && String(json).trim()) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('SALES_CONVERSION_SMOKE_ACCOUNTS_JSON must be a non-empty array');
    }

    return parsed.map((account, index) => {
      if (!account?.email || !account?.password) {
        throw new Error(`SALES_CONVERSION_SMOKE_ACCOUNTS_JSON entry ${index} must include email and password`);
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
      email:
        process.env.SALES_CONVERSION_SMOKE_FR_EMAIL || process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
      password: requirePassword('SALES_CONVERSION_SMOKE_FR_PASSWORD', 'PILOTAGE_FR_PASSWORD'),
    },
    {
      key: 'BE',
      email:
        process.env.SALES_CONVERSION_SMOKE_BE_EMAIL || process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
      password: requirePassword('SALES_CONVERSION_SMOKE_BE_PASSWORD', 'PILOTAGE_BE_PASSWORD'),
    },
    {
      key: 'OHADA',
      email:
        process.env.SALES_CONVERSION_SMOKE_OHADA_EMAIL ||
        process.env.PILOTAGE_OHADA_EMAIL ||
        'pilotage.ohada.demo@cashpilot.cloud',
      password: requirePassword('SALES_CONVERSION_SMOKE_OHADA_PASSWORD', 'PILOTAGE_OHADA_PASSWORD'),
    },
  ];

  const accounts = fallbackAccounts.filter((account) => account.password);
  if (accounts.length === 0) {
    throw new Error(
      'No sales conversion smoke accounts configured. Set SALES_CONVERSION_SMOKE_ACCOUNTS_JSON or demo password env vars.'
    );
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

async function firstVisible(locators) {
  for (const locator of locators) {
    if (await locator.isVisible().catch(() => false)) {
      return locator;
    }
  }
  return null;
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

async function openQuotes(page) {
  await page.goto(`${BASE_URL}/app/quotes`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await page.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
}

async function findRowWithLossAction(page) {
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const action = await firstVisible([
      row.locator(
        'button[aria-label="Marquer perdu"], button[aria-label="Mark as lost"], button[aria-label="Markeren als verloren"], button[title="Marquer perdu"], button[title="Mark as lost"], button[title="Markeren als verloren"]'
      ).first(),
    ]);
    if (action) {
      return { row, action };
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
    await openQuotes(page);

    await page.getByText(/Devis|Quotes|Offertes/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    result.checks.push('quotes-page-visible');

    await page.getByText(/Motif de perte|Loss reason|Verliesreden/i).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    await page.getByText(/Next best action/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    result.checks.push('intelligence-columns-visible');

    const rowAction = await findRowWithLossAction(page);
    if (!rowAction) {
      result.checks.push('loss-action-not-required');
      result.passed = true;
      return result;
    }

    await rowAction.action.click();
    const dialog = page.getByRole('dialog').last();
    await dialog.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await dialog.getByText(/Capturer le motif de perte|Capture loss reason|Verliesreden vastleggen/i).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    result.checks.push('loss-dialog-opened');

    const categoryTrigger = dialog.getByRole('combobox').first();
    await categoryTrigger.click();
    const budgetOption = await firstVisible([
      page.getByRole('option', { name: /Budget insuffisant|Budget constraints|Budgetbeperking/i }).first(),
      page.getByText(/Budget insuffisant|Budget constraints|Budgetbeperking/i).first(),
    ]);
    if (!budgetOption) {
      throw new Error('Budget category option not found in loss reason dialog');
    }
    await budgetOption.click();

    const detailsInput = dialog.locator('textarea').first();
    await detailsInput.fill(`Smoke conversion reason ${account.key}`);
    await dialog.getByRole('button', { name: /Enregistrer|Save|Opslaan/i }).click();

    await dialog.waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT });
    result.checks.push('loss-reason-saved');

    await page.getByText(/Budget insuffisant|Budget constraints|Budgetbeperking/i).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    result.checks.push('loss-reason-visible');

    result.passed = true;
  } catch (error) {
    result.failures.push(error instanceof Error ? error.message : String(error));
  }

  return result;
}

async function main() {
  const accounts = loadAccounts();
  const startedAt = new Date().toISOString();
  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    const results = [];
    for (const account of accounts) {
      const context = await browser.newContext({
        locale: 'fr-BE',
        ignoreHTTPSErrors: true,
        viewport: { width: 1440, height: 1000 },
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
