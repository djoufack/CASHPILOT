import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-cfo-weekly-briefing');
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
  const json = process.env.CFO_SMOKE_ACCOUNTS_JSON;
  if (json && String(json).trim()) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('CFO_SMOKE_ACCOUNTS_JSON must be a non-empty array');
    }

    return parsed.map((account, index) => {
      if (!account?.email || !account?.password) {
        throw new Error(`CFO_SMOKE_ACCOUNTS_JSON entry ${index} must include email and password`);
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
      email: process.env.CFO_SMOKE_FR_EMAIL || process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
      password: requirePassword('CFO_SMOKE_FR_PASSWORD', 'PILOTAGE_FR_PASSWORD'),
    },
    {
      key: 'BE',
      email: process.env.CFO_SMOKE_BE_EMAIL || process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
      password: requirePassword('CFO_SMOKE_BE_PASSWORD', 'PILOTAGE_BE_PASSWORD'),
    },
    {
      key: 'OHADA',
      email: process.env.CFO_SMOKE_OHADA_EMAIL || process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
      password: requirePassword('CFO_SMOKE_OHADA_PASSWORD', 'PILOTAGE_OHADA_PASSWORD'),
    },
  ];

  const accounts = fallbackAccounts.filter((account) => account.password);
  if (accounts.length === 0) {
    throw new Error('No CFO smoke accounts configured. Set CFO_SMOKE_ACCOUNTS_JSON or the demo password env vars.');
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

async function openCfoPage(page) {
  await page.goto(`${BASE_URL}/app/cfo-agent`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await page.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
}

async function waitForBriefingCard(page) {
  const card = page.getByTestId('cfo-weekly-briefing-card').first();
  await card.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await page.getByTestId('cfo-weekly-briefing-generated-at').first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  return card;
}

async function captureFailure(page, accountKey, label) {
  await ensureDir(OUTPUT_DIR);
  const filePath = path.join(OUTPUT_DIR, `${accountKey}-${label}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
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
    await openCfoPage(page);

    const card = await waitForBriefingCard(page);
    const firstGeneratedAt = (await page.getByTestId('cfo-weekly-briefing-generated-at').first().innerText()).trim();
    const firstStatus = (await page.getByTestId('cfo-weekly-briefing-status').first().innerText()).trim();
    const firstCardText = (await card.innerText()).trim();

    if (!firstGeneratedAt) {
      throw new Error('Weekly briefing generated_at is empty on first load.');
    }
    if (!firstCardText.includes('Briefing')) {
      throw new Error('Weekly briefing card text is missing.');
    }

    result.checks.push({
      key: 'first_load',
      generated_at: firstGeneratedAt,
      status: firstStatus,
    });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await page.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

    const refreshedCard = await waitForBriefingCard(page);
    const secondGeneratedAt = (await page.getByTestId('cfo-weekly-briefing-generated-at').first().innerText()).trim();
    const secondStatus = (await page.getByTestId('cfo-weekly-briefing-status').first().innerText()).trim();
    const refreshedCardText = (await refreshedCard.innerText()).trim();

    if (firstGeneratedAt !== secondGeneratedAt) {
      throw new Error(`Weekly briefing timestamp changed after reload: ${firstGeneratedAt} -> ${secondGeneratedAt}`);
    }
    if (!/cache/i.test(secondStatus)) {
      throw new Error(`Weekly briefing should be cached after reload, got status "${secondStatus}".`);
    }
    if (!refreshedCardText.includes('Briefing')) {
      throw new Error('Weekly briefing card text is missing after reload.');
    }

    result.checks.push({
      key: 'reload_idempotence',
      generated_at: secondGeneratedAt,
      status: secondStatus,
    });
    result.passed = true;
  } catch (error) {
    result.failures.push(error instanceof Error ? error.message : String(error));
    result.screenshot = await captureFailure(page, account.key, 'failure').catch(() => null);
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
          window.localStorage.setItem('cashpilot_gdpr_consent', JSON.stringify({
            necessary: true,
            cookies: true,
            analytics: true,
            marketing: true,
          }));
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
