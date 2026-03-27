import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-dashboard');
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

const DASHBOARD_HEADING_PATTERNS = [
  /Dashboard/i,
  /Tableau de bord/i,
  /Vue d['’]ensemble/i,
  /Overview/i,
  /Overzicht/i,
];

const KPI_PATTERNS = [
  {
    key: 'revenue',
    label: 'KPI revenue',
    patterns: [/Chiffre d['’]?affaires/i, /Revenue/i, /Omzet/i],
  },
  {
    key: 'margin',
    label: 'KPI margin',
    patterns: [/Marge/i, /Margin/i, /Marge bénéficiaire/i, /Winstmarge/i],
  },
  {
    key: 'expenses',
    label: 'KPI expenses',
    patterns: [/D[eé]penses/i, /Charges/i, /Expenses/i, /Kosten/i],
  },
  {
    key: 'occupancy',
    label: 'KPI occupancy',
    patterns: [/Occupation/i, /Taux d['’]?occupation/i, /Occupancy/i, /Bezettingsgraad/i],
  },
  {
    key: 'cashFlow',
    label: 'KPI cash flow',
    patterns: [/Net Cash Flow/i, /Cash Flow/i, /Flux de trésorerie/i, /Tr[eé]sorerie nette/i, /Tr[eé]sorerie/i, /Kasstroom/i],
  },
];

const CORE_DRILLDOWN_LINK_TARGETS = [
  '/app/invoices?status=sent,paid',
  '/app/expenses?view=list',
];

const ROLE_DRILLDOWN_LINK_TARGETS = [
  '/app/cash-flow',
  '/app/timesheets?view=list&project=all',
];

const ROLE_SELECTOR_LABEL_PATTERNS = [
  /Mode des données/i,
  /Data mode/i,
  /Datamodus/i,
  /Mode de vue/i,
  /View mode/i,
  /R[ôo]le/i,
  /Role/i,
];

const ALERT_PANEL_PATTERNS = [
  /Alertes proactives/i,
  /Proactive alerts/i,
  /Radar d['’]alertes/i,
  /Alert radar/i,
  /Financial alert radar/i,
  /Alertes financières/i,
  /Waarschuwingsradar/i,
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

async function goToDashboard(page) {
  await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/app(?:[?#].*)?$/, { timeout: DEFAULT_TIMEOUT });
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

async function countVisibleTextMatches(page, patterns) {
  const matches = [];
  for (const pattern of patterns) {
    const locator = page.getByText(pattern, { exact: false }).first();
    if (await locator.isVisible().catch(() => false)) {
      matches.push(String(pattern));
    }
  }
  return matches;
}

async function checkDashboardHeading(page) {
  const match = await firstVisibleTextMatch(page, DASHBOARD_HEADING_PATTERNS);
  if (!match) {
    throw new Error(`Dashboard heading not found. Tried: ${DASHBOARD_HEADING_PATTERNS.map(String).join(', ')}`);
  }
  return { matched: match };
}

async function checkKpiCards(page) {
  const matched = [];
  for (const kpi of KPI_PATTERNS) {
    const hit = await firstVisibleTextMatch(page, kpi.patterns);
    if (hit) {
      matched.push({ key: kpi.key, label: kpi.label, matched: hit });
    }
  }

  if (matched.length < 3) {
    throw new Error(`Expected at least 3 KPI cards, found ${matched.length}: ${matched.map((item) => item.key).join(', ') || 'none'}`);
  }

  return { matched };
}

async function checkDrilldownLinks(page) {
  const matchedCoreHrefs = [];
  const missingCore = [];

  for (const href of CORE_DRILLDOWN_LINK_TARGETS) {
    const link = page.locator(`a[href="${href}"]`).first();
    if (await link.isVisible().catch(() => false)) {
      matchedCoreHrefs.push(href);
      continue;
    }

    missingCore.push(href);
  }

  if (missingCore.length > 0) {
    throw new Error(`Missing core drill-down links: ${missingCore.join(', ')}`);
  }

  const matchedRoleSpecific = [];
  for (const href of ROLE_DRILLDOWN_LINK_TARGETS) {
    const link = page.locator(`a[href="${href}"]`).first();
    if (await link.isVisible().catch(() => false)) {
      matchedRoleSpecific.push(href);
    }
  }

  if (matchedRoleSpecific.length === 0) {
    throw new Error(
      `Expected at least one role-specific drill-down link, found none. Tried: ${ROLE_DRILLDOWN_LINK_TARGETS.join(', ')}`
    );
  }

  return { matchedCoreHrefs, matchedRoleSpecific };
}

async function checkRoleViewSelector(page) {
  const label = await firstVisibleTextMatch(page, ROLE_SELECTOR_LABEL_PATTERNS);
  if (!label) {
    return { status: 'skipped', reason: 'role view selector not present on /app' };
  }

  const combobox = page.getByRole('combobox').first();
  const buttonGroup = page.getByRole('button').filter({ hasText: /R[ôo]le|Role|Mode|View|Vue|Data|Donn[eé]es|Datamodus/i }).first();

  if (await combobox.isVisible().catch(() => false)) {
    return { status: 'passed', matchedLabel: label, control: 'combobox' };
  }

  if (await buttonGroup.isVisible().catch(() => false)) {
    return { status: 'passed', matchedLabel: label, control: 'button-group' };
  }

  throw new Error(`Role view selector label was found (${label}) but no combobox/button control was visible.`);
}

async function checkProactiveAlertsPanel(page) {
  const label = await firstVisibleTextMatch(page, ALERT_PANEL_PATTERNS);
  if (!label) {
    return { status: 'skipped', reason: 'proactive alerts panel not present on /app' };
  }

  const noAlertsPatterns = [/Aucune alerte/i, /No alerts/i, /Geen waarschuwingen/i, /sains/i, /healthy/i];
  const noAlerts = await firstVisibleTextMatch(page, noAlertsPatterns);
  if (noAlerts) {
    return { status: 'passed', matchedLabel: label, state: noAlerts };
  }

  const alertItemPatterns = [
    /Critique/i,
    /Critical/i,
    /Warning/i,
    /Attention/i,
    /A surveiller/i,
    /Alert/i,
    /Alerte/i,
  ];

  const alerts = await countVisibleTextMatches(page, alertItemPatterns);
  if (alerts.length > 0) {
    return { status: 'passed', matchedLabel: label, alerts };
  }

  throw new Error(`Proactive alerts panel was found (${label}) but no alert state/content was visible.`);
}

async function runCheck(page, accountKey, check, fn, required = true) {
  try {
    const detail = await fn(page);
    const status = detail?.status === 'skipped' ? 'skipped' : 'passed';
    return {
      key: check,
      status,
      required,
      detail,
      screenshot: null,
      error: null,
    };
  } catch (error) {
    return {
      key: check,
      status: 'failed',
      required,
      detail: null,
      screenshot: await captureFailure(page, accountKey, check),
      error: error.message,
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
    dashboardPath: '/app',
    passed: false,
    login: false,
    checks: [],
    failures: [],
  };

  try {
    await login(page, account);
    result.login = true;

    await goToDashboard(page);

    const checks = [
      ['dashboard_heading', checkDashboardHeading, true],
      ['kpi_cards', checkKpiCards, true],
      ['drilldown_links', checkDrilldownLinks, true],
      ['role_view_selector', checkRoleViewSelector, true],
      ['proactive_alerts_panel', checkProactiveAlertsPanel, true],
    ];

    for (const [key, fn, required] of checks) {
      const checkResult = await runCheck(page, account.key, key, fn, required);
      result.checks.push(checkResult);
      if (checkResult.status === 'failed') {
        result.failures.push(`${key}: ${checkResult.error}`);
      }
    }

    result.passed = result.checks.every((check) => check.status !== 'failed');
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
