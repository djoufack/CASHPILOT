import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-pilotage-kpi-threshold-subscription');
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

const MANAGE_THRESHOLD_PATTERNS = [/Gérer les seuils/i, /Manage thresholds/i, /Drempels beheren/i];
const SAVE_PATTERNS = [/Enregistrer/i, /Save/i, /Opslaan/i];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return String(value).trim();
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

async function firstVisibleButton(page, patterns) {
  for (const pattern of patterns) {
    const candidate = page.getByRole('button', { name: pattern }).first();
    if (await candidate.isVisible().catch(() => false)) {
      return candidate;
    }
  }
  return null;
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

async function openThresholdDialog(page) {
  const trigger = await firstVisibleButton(page, MANAGE_THRESHOLD_PATTERNS);
  if (!trigger) {
    throw new Error('Unable to find the pilotage threshold management button.');
  }
  await trigger.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await trigger.click();

  const dialog = page.getByRole('dialog').last();
  await dialog.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  return dialog;
}

async function saveAndClose(dialog) {
  let saveButton = null;
  for (const pattern of SAVE_PATTERNS) {
    const candidate = dialog.getByRole('button', { name: pattern }).first();
    if (await candidate.isVisible().catch(() => false)) {
      saveButton = candidate;
      break;
    }
  }

  if (!saveButton) {
    throw new Error('Unable to find the pilotage threshold save button.');
  }

  await saveButton.click();
  await dialog.waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT }).catch(() => {});
}

async function runAccount(browser, account, index) {
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

    const dialog = await openThresholdDialog(page);
    const spinbuttons = dialog.getByRole('spinbutton');
    const count = await spinbuttons.count();
    if (count < 8) {
      throw new Error(`Expected 8 pilotage threshold inputs, found ${count}.`);
    }

    const targetInput = spinbuttons.nth(2);
    const originalValue = await targetInput.inputValue();
    const targetValue = index === 0 ? '1.80' : index === 1 ? '1.75' : '1.65';
    await targetInput.fill(targetValue);
    await saveAndClose(dialog);

    const reopenedDialog = await openThresholdDialog(page);
    const reopenedInput = reopenedDialog.getByRole('spinbutton').nth(2);
    const persistedValue = await reopenedInput.inputValue();
    const parsedTarget = Number.parseFloat(targetValue);
    const parsedPersisted = Number.parseFloat(persistedValue);
    const isNumericallyEqual = Number.isFinite(parsedTarget) && Number.isFinite(parsedPersisted)
      && Math.abs(parsedPersisted - parsedTarget) < 0.000001;

    if (!isNumericallyEqual) {
      throw new Error(`Persisted threshold mismatch for ${account.key}: expected ${targetValue}, got ${persistedValue}`);
    }

    await saveAndClose(reopenedDialog);

    const restoreDialog = await openThresholdDialog(page);
    const restoreInput = restoreDialog.getByRole('spinbutton').nth(2);
    await restoreInput.fill(originalValue || '1.20');
    await saveAndClose(restoreDialog);

    result.checks.push({
      key: 'threshold_persistence',
      status: 'passed',
      detail: { originalValue, targetValue, persistedValue },
    });
    result.passed = true;
  } catch (error) {
    result.failures.push(error.message);
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
    accounts = await Promise.all(ACCOUNTS.map((account, index) => runAccount(browser, account, index)));
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
