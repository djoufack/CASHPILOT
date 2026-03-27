import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-pilotage-snapshot-share');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const BROWSER_CHANNELS = [process.env.PLAYWRIGHT_CHANNEL || 'msedge', 'chrome'].filter(Boolean);

const ACCOUNTS = [
  {
    key: 'FR',
    email: process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_FR_PASSWORD',
    defaultPassword: 'PilotageFR#2026!',
  },
  {
    key: 'BE',
    email: process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_BE_PASSWORD',
    defaultPassword: 'PilotageBE#2026!',
  },
  {
    key: 'OHADA',
    email: process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
    passwordEnv: 'PILOTAGE_OHADA_PASSWORD',
    defaultPassword: 'PilotageOHADA#2026!',
  },
];

const PILOTAGE_HEADING_PATTERNS = [/Pilotage/i, /Steering/i, /Sturing/i];
const SHARE_TRIGGER_PATTERNS = [/Partager/i, /Share/i, /Delen/i];
const SHARE_DIALOG_PATTERNS = [/Partage public/i, /Public sharing/i, /Publiek delen/i];
const SHARE_GENERATE_PATTERNS = [/Générer un lien/i, /Generate a link/i, /Link genereren/i];

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
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

async function checkSnapshotShareDialog(page) {
  let matchedTrigger = null;

  for (const pattern of SHARE_TRIGGER_PATTERNS) {
    const candidate = page.getByRole('button', { name: pattern }).first();
    if (await candidate.isVisible().catch(() => false)) {
      matchedTrigger = String(pattern);
      await candidate.click({ force: true });
      await page.waitForTimeout(250);
      break;
    }
  }

  if (!matchedTrigger) {
    throw new Error('Snapshot share trigger not found on Pilotage page.');
  }

  const dialogMatched = await firstVisibleTextMatch(page, SHARE_DIALOG_PATTERNS);
  if (!dialogMatched) {
    throw new Error(`Snapshot share dialog not found. Tried: ${SHARE_DIALOG_PATTERNS.map(String).join(', ')}`);
  }

  let generateButton = null;
  for (const pattern of SHARE_GENERATE_PATTERNS) {
    const candidate = page.getByRole('button', { name: pattern }).first();
    if (await candidate.isVisible().catch(() => false)) {
      generateButton = String(pattern);
      break;
    }
  }

  if (!generateButton) {
    throw new Error('Snapshot share generate button not visible.');
  }

  return {
    matchedTrigger,
    dialogMatched,
    generateButton,
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
      ['snapshot_share_dialog', checkSnapshotShareDialog],
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
  const browser = await launchBrowser();
  const results = [];

  try {
    for (const account of ACCOUNTS) {
      const password = String(process.env[account.passwordEnv] || account.defaultPassword || '').trim();
      if (!password) {
        throw new Error(`Missing demo password for ${account.key}`);
      }
      results.push(await runAccount(browser, { ...account, password }));
    }
  } finally {
    await browser.close();
  }

  await ensureDir(OUTPUT_DIR);
  const summary = {
    baseUrl: BASE_URL,
    timestamp: new Date().toISOString(),
    results,
  };
  await fs.writeFile(path.join(OUTPUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));

  const failed = results.filter((result) => !result.passed);
  for (const result of results) {
    console.log(`[${result.key}] ${result.passed ? 'PASS' : 'FAIL'}`);
    for (const check of result.checks) {
      console.log(`  - ${check.key}: ${check.status}${check.error ? ` (${check.error})` : ''}`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`Pilotage snapshot share smoke failed for: ${failed.map((result) => result.key).join(', ')}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
