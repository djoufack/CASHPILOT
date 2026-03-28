import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-prj-gantt-dependencies');
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
  const json = process.env.PRJ_GANTT_DEPENDENCIES_SMOKE_ACCOUNTS_JSON;
  if (json && String(json).trim()) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('PRJ_GANTT_DEPENDENCIES_SMOKE_ACCOUNTS_JSON must be a non-empty array');
    }

    return parsed.map((account, index) => {
      if (!account?.email || !account?.password) {
        throw new Error(`PRJ_GANTT_DEPENDENCIES_SMOKE_ACCOUNTS_JSON entry ${index} must include email and password`);
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
        process.env.PRJ_GANTT_DEPENDENCIES_SMOKE_FR_EMAIL || process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
      password: requirePassword('PRJ_GANTT_DEPENDENCIES_SMOKE_FR_PASSWORD', 'PILOTAGE_FR_PASSWORD'),
    },
    {
      key: 'BE',
      email:
        process.env.PRJ_GANTT_DEPENDENCIES_SMOKE_BE_EMAIL || process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
      password: requirePassword('PRJ_GANTT_DEPENDENCIES_SMOKE_BE_PASSWORD', 'PILOTAGE_BE_PASSWORD'),
    },
    {
      key: 'OHADA',
      email:
        process.env.PRJ_GANTT_DEPENDENCIES_SMOKE_OHADA_EMAIL ||
        process.env.PILOTAGE_OHADA_EMAIL ||
        'pilotage.ohada.demo@cashpilot.cloud',
      password: requirePassword('PRJ_GANTT_DEPENDENCIES_SMOKE_OHADA_PASSWORD', 'PILOTAGE_OHADA_PASSWORD'),
    },
  ];

  const accounts = fallbackAccounts.filter((account) => account.password);
  if (accounts.length === 0) {
    throw new Error(
      'No PRJ-01 smoke accounts configured. Set PRJ_GANTT_DEPENDENCIES_SMOKE_ACCOUNTS_JSON or demo password env vars.'
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

async function ensureProjectAndOpenDetail(page, account) {
  await page.goto(`${BASE_URL}/app/projects`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await page.getByRole('heading', { name: /Projects/i }).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  let detailPath = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href]'));
    const candidate = links.find((link) => /^\/app\/projects\/[^/]+$/.test(link.getAttribute('href') || ''));
    return candidate ? candidate.getAttribute('href') : null;
  });

  if (!detailPath) {
    const now = Date.now();
    await page.getByRole('button', { name: /New Project/i }).first().click();
    await page.getByLabel(/Project Name/i).fill(`Smoke PRJ01 ${account.key} ${now}`);
    await page.getByRole('button', { name: /Create Project/i }).click();
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});

    detailPath = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const candidate = links.find((link) => /^\/app\/projects\/[^/]+$/.test(link.getAttribute('href') || ''));
      return candidate ? candidate.getAttribute('href') : null;
    });
  }

  if (!detailPath) {
    throw new Error('Unable to find or create a project detail link');
  }

  await page.goto(`${BASE_URL}${detailPath}`, { waitUntil: 'domcontentloaded' });
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
    await ensureProjectAndOpenDetail(page, account);
    result.checks.push('project-detail-opened');

    const ganttTab = page.getByRole('tab', { name: /Gantt|projects\.gantt\.title/i }).first();
    await ganttTab.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await ganttTab.click();
    result.checks.push('gantt-tab-opened');

    await page.getByText(/Pilotage Gantt & dépendances/i).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    await page.getByText(/Liens de dépendance/i).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    result.checks.push('gantt-insights-visible');

    const dependencyToggle = page
      .getByRole('button', { name: /Créer dépendance|Mode dépendance actif/i })
      .first();
    await dependencyToggle.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await dependencyToggle.click();
    await page.getByRole('button', { name: /Mode dépendance actif/i }).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    result.checks.push('dependency-mode-activated');

    const ganttFallback = page.getByText(/Aucune tâche avec des dates définies|Chargement du diagramme de Gantt/i).first();
    const ganttContainer = page.locator('.gantt-container').first();
    if (await ganttContainer.isVisible().catch(() => false)) {
      result.checks.push('gantt-chart-visible');
    } else {
      await ganttFallback.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      result.checks.push('gantt-fallback-visible');
    }

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
