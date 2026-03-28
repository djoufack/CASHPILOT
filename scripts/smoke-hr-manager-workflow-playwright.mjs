import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-hr-manager-workflow');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '60000', 10);

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
  const json = process.env.HR_MANAGER_WORKFLOW_SMOKE_ACCOUNTS_JSON;
  if (json && String(json).trim()) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('HR_MANAGER_WORKFLOW_SMOKE_ACCOUNTS_JSON must be a non-empty array');
    }

    return parsed.map((account, index) => {
      if (!account?.email || !account?.password) {
        throw new Error(`HR_MANAGER_WORKFLOW_SMOKE_ACCOUNTS_JSON entry ${index} must include email and password`);
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
      email: process.env.HR_MANAGER_WORKFLOW_SMOKE_FR_EMAIL || process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
      password: requirePassword('HR_MANAGER_WORKFLOW_SMOKE_FR_PASSWORD', 'PILOTAGE_FR_PASSWORD'),
    },
    {
      key: 'BE',
      email: process.env.HR_MANAGER_WORKFLOW_SMOKE_BE_EMAIL || process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
      password: requirePassword('HR_MANAGER_WORKFLOW_SMOKE_BE_PASSWORD', 'PILOTAGE_BE_PASSWORD'),
    },
    {
      key: 'OHADA',
      email:
        process.env.HR_MANAGER_WORKFLOW_SMOKE_OHADA_EMAIL ||
        process.env.PILOTAGE_OHADA_EMAIL ||
        'pilotage.ohada.demo@cashpilot.cloud',
      password: requirePassword('HR_MANAGER_WORKFLOW_SMOKE_OHADA_PASSWORD', 'PILOTAGE_OHADA_PASSWORD'),
    },
  ];

  const accounts = fallbackAccounts.filter((account) => account.password);
  if (accounts.length === 0) {
    throw new Error(
      'No HR-02 smoke accounts configured. Set HR_MANAGER_WORKFLOW_SMOKE_ACCOUNTS_JSON or demo password env vars.'
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

    await page.goto(`${BASE_URL}/app/rh/entretiens`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await page.getByRole('heading', { name: /Entretiens de performance/i }).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    result.checks.push('performance-review-opened');

    const workflowTab = page.getByRole('tab', { name: /Workflow managers/i }).first();
    await workflowTab.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await workflowTab.click();
    result.checks.push('manager-workflow-tab-opened');

    const panel = page.getByTestId('hr-manager-workflow-panel').first();
    await panel.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await page.getByText(/Workflow managers avance/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    result.checks.push('manager-workflow-panel-visible');

    await page.getByText(/A traiter manager/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await page.getByText(/Actions prioritaires managers/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    result.checks.push('manager-workflow-kpis-visible');

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
          // Ignore storage hydration failures in smoke context.
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
