import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-pilotage-alert-actions');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const BROWSER_CHANNELS = [process.env.PLAYWRIGHT_CHANNEL || 'msedge', 'chrome'].filter(Boolean);

const ACCOUNTS = [
  {
    key: 'FR',
    email: process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_FR_PASSWORD',
  },
  {
    key: 'BE',
    email: process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_BE_PASSWORD',
  },
  {
    key: 'OHADA',
    email: process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_OHADA_PASSWORD',
  },
];

const PILOTAGE_HEADING_PATTERNS = [/Pilotage/i, /Steering/i, /Sturing/i];
const ALERT_PANEL_PATTERNS = [/Alertes Financi[eè]res/i, /Financial Alerts/i, /Financi[eë]le waarschuwingen/i];
const NO_ALERT_PATTERNS = [/Aucune alerte/i, /No alerts/i, /Geen waarschuwingen/i, /healthy indicators/i, /gezonde indicatoren/i];
const ACTION_LABEL_PATTERNS = [
  /Ouvrir la tr[eé]sorerie/i,
  /Ouvrir le pilotage/i,
  /Open cash flow/i,
  /Open .*steering/i,
  /Kasstroom openen/i,
  /sturing openen/i,
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return String(value).trim();
}

function ensureDir(dirPath) {
  return fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
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
  }

  throw new Error(`Unable to launch Playwright browser. Tried ${launchErrors.join(' | ')}`);
}

async function captureFailure(page, accountKey, label) {
  const screenshotPath = path.join(OUTPUT_DIR, `${accountKey}-${label}.png`);
  await ensureDir(OUTPUT_DIR);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
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
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);
}

async function goToPilotage(page) {
  await page.goto(`${BASE_URL}/app/pilotage`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app\/pilotage(?:[?#].*)?$/, { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissOverlays(page);
  await page.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
}

async function firstVisibleTextMatch(page, patterns) {
  for (const pattern of patterns) {
    const locator = page.getByText(pattern, { exact: false }).first();
    if (await locator.isVisible().catch(() => false)) {
      return String(pattern);
    }
  }
  return null;
}

async function checkPilotageHeading(page) {
  const matched = await firstVisibleTextMatch(page, PILOTAGE_HEADING_PATTERNS);
  if (!matched) {
    throw new Error(`Pilotage heading not found. Tried: ${PILOTAGE_HEADING_PATTERNS.map(String).join(', ')}`);
  }
  return { matched };
}

async function checkAlertPanelAndOneClickAction(page) {
  const matchedPanel = await firstVisibleTextMatch(page, ALERT_PANEL_PATTERNS);
  if (!matchedPanel) {
    throw new Error(`Alert panel not found. Tried: ${ALERT_PANEL_PATTERNS.map(String).join(', ')}`);
  }

  const noAlertState = await firstVisibleTextMatch(page, NO_ALERT_PATTERNS);
  if (noAlertState) {
    return { mode: 'no-alert', matchedPanel, state: noAlertState };
  }

  let actionLink = null;
  for (const pattern of ACTION_LABEL_PATTERNS) {
    const candidate = page.getByRole('link', { name: pattern }).first();
    if (await candidate.isVisible().catch(() => false)) {
      actionLink = candidate;
      break;
    }
  }

  if (!actionLink) {
    throw new Error('No one-click alert action link found in Pilotage alerts.');
  }

  const href = await actionLink.getAttribute('href');
  const label = ((await actionLink.textContent()) || '').trim();
  if (!href) {
    throw new Error('Alert action link is missing href.');
  }

  await actionLink.click({ force: true });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});

  const currentUrl = new URL(page.url());
  const expectedUrl = new URL(href, BASE_URL);
  const landedPath = `${currentUrl.pathname}${currentUrl.search}`;

  const pathMatches = currentUrl.pathname === expectedUrl.pathname;
  const queryMatches = !expectedUrl.search || currentUrl.search.includes(expectedUrl.search.replace(/^\?/, ''));
  if (!pathMatches || !queryMatches) {
    throw new Error(`Action link did not land on expected destination. Expected ${expectedUrl.pathname}${expectedUrl.search}, got ${landedPath}`);
  }

  return {
    mode: 'clicked',
    matchedPanel,
    href,
    label,
    landedPath,
  };
}

async function runCheck(page, accountKey, key, fn) {
  try {
    const detail = await fn(page);
    return { key, status: 'passed', detail, error: null, screenshot: null };
  } catch (error) {
    return {
      key,
      status: 'failed',
      detail: null,
      error: error.message,
      screenshot: await captureFailure(page, accountKey, key),
    };
  }
}

async function runAccount(browser, account) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    locale: 'fr-FR',
    ignoreHTTPSErrors: true,
  });

  await context.addInitScript((language) => {
    window.localStorage.setItem('cashpilot_language', language);
    window.localStorage.setItem('cashpilot-onboarding-done', 'true');
    window.localStorage.setItem(
      'cashpilot_gdpr_consent',
      JSON.stringify({ necessary: true, cookies: true, analytics: true, marketing: true })
    );
  }, 'fr');

  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);

  const result = {
    key: account.key,
    email: account.email,
    passed: false,
    login: false,
    checks: [],
    failures: [],
  };

  try {
    await login(page, account);
    result.login = true;
    await goToPilotage(page);

    const checks = [
      ['pilotage_heading', checkPilotageHeading],
      ['alert_panel_one_click_action', checkAlertPanelAndOneClickAction],
    ];

    for (const [key, fn] of checks) {
      const checkResult = await runCheck(page, account.key, key, fn);
      result.checks.push(checkResult);
      if (checkResult.status === 'failed') {
        result.failures.push(`${key}: ${checkResult.error}`);
      }
    }

    result.passed = result.checks.every((check) => check.status === 'passed');
  } catch (error) {
    result.failures.push(`fatal: ${error.message}`);
    result.screenshot = await captureFailure(page, account.key, 'fatal');
    result.passed = false;
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  const startedAt = new Date().toISOString();
  let browser = null;
  let fatalError = null;
  let accounts = [];

  try {
    for (const account of ACCOUNTS) {
      account.password = requireEnv(account.passwordEnv);
    }

    browser = await launchBrowser();
    accounts = await Promise.all(ACCOUNTS.map((account) => runAccount(browser, account)));
  } catch (error) {
    fatalError = error.message;
    process.exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  const summary = {
    baseUrl: BASE_URL,
    startedAt,
    finishedAt: new Date().toISOString(),
    passed: fatalError ? false : accounts.every((account) => account.passed),
    fatalError,
    accounts,
  };

  await writeJson(path.join(OUTPUT_DIR, 'summary.json'), summary);
  console.log(JSON.stringify(summary, null, 2));

  if (!summary.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
