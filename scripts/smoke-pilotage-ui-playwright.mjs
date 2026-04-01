import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-smoke');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const BROWSER_CHANNELS = [
  process.env.PLAYWRIGHT_CHANNEL || 'msedge',
  'chrome',
].filter(Boolean);

const DEMO_ACCOUNT_TEMPLATES = [
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

const PAGE_CHECKS = [
  {
    key: 'gedHub',
    path: '/app/ged-hub',
    expectedText: (account) => account.expectations.gedHub,
  },
  {
    key: 'purchases',
    path: '/app/purchases',
    expectedText: (account) => account.expectations.purchases,
  },
  {
    key: 'supplierInvoices',
    path: '/app/supplier-invoices',
    expectedText: (account) => account.expectations.supplierInvoices,
  },
  {
    key: 'stock',
    path: '/app/stock',
    expectedText: (account) => account.expectations.stock,
    beforeCheck: async (page) => {
      const inventoryTab = page.getByRole('tab', { name: /Inventory|Inventaire/i }).first();
      if (await inventoryTab.isVisible().catch(() => false)) {
        await inventoryTab.click();
      }
    },
  },
  {
    key: 'bankConnections',
    path: '/app/bank-connections',
    expectedText: (account) => account.expectations.bankConnections,
  },
  {
    key: 'peppol',
    path: '/app/peppol',
    expectedText: (account) => account.expectations.peppol,
  },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return String(value).trim();
}

function optionalEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function shortCompanyFragment(companyName) {
  return String(companyName || '').trim().slice(0, 18);
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

  try {
    return await chromium.launch({
      headless: HEADLESS,
    });
  } catch (error) {
    launchErrors.push(`bundled: ${error.message}`);
  }

  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) {
    return chromium.launch({
      headless: HEADLESS,
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
  }

  throw new Error(`Unable to launch Playwright browser. Tried ${launchErrors.join(' | ')}`);
}

async function captureFailure(page, accountKey, label) {
  const screenshotPath = path.join(OUTPUT_DIR, `${accountKey}-${label}.png`);
  await ensureDir(OUTPUT_DIR);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function waitForExpectedText(page, expectedText, timeout = DEFAULT_TIMEOUT) {
  if (!expectedText) {
    throw new Error('Missing expected text for page check');
  }

  await page.getByText(expectedText, { exact: false }).first().waitFor({ state: 'visible', timeout });
}

async function login(page, account) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});

  if (!page.url().includes('/app')) {
    await page.goto(`${BASE_URL}/app`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  }

  await page.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await dismissInterferingOverlays(page);
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

async function selectTargetCompany(page, account) {
  await dismissInterferingOverlays(page);

  const targetName = account.targetCompany.company_name;
  const targetFragment = shortCompanyFragment(targetName);
  const companyNameFragments = [targetName, ...(account.companyNames || [])]
    .map((name) => shortCompanyFragment(name))
    .filter(Boolean);

  const triggerPattern =
    companyNameFragments.length > 0
      ? new RegExp(companyNameFragments.map((fragment) => escapeRegex(fragment)).join('|'), 'i')
      : /Portfolio|CashPilot|SAS|SRL|SARL|BV/i;

  const resolveCompanySwitcherTrigger = async () => {
    const directSwitcher = page.locator('header button[class*="bg-white/5"][class*="border-white/10"]').first();
    if (await directSwitcher.isVisible().catch(() => false)) {
      return directSwitcher;
    }
    return page.getByRole('banner').locator('button').filter({ hasText: triggerPattern }).first();
  };
  const isTargetText = (text) => text.includes(targetName) || text.includes(targetFragment);

  let trigger = await resolveCompanySwitcherTrigger();
  await trigger.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  let currentText = ((await trigger.textContent()) || '').trim();

  if (!isTargetText(currentText)) {
    await page.evaluate((companyId) => {
      window.localStorage.setItem('cashpilot.activeCompanyId', companyId);
      window.dispatchEvent(new CustomEvent('cashpilot:active-company-changed', { detail: companyId }));
    }, account.targetCompany.id);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await dismissInterferingOverlays(page);

    trigger = await resolveCompanySwitcherTrigger();
    await trigger.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    currentText = ((await trigger.textContent()) || '').trim();
  }

  if (!isTargetText(currentText)) {
    await trigger.click({ force: true });
    await page.waitForTimeout(250);
    const companyDropdown = page.locator('div.absolute.left-0.mt-1.w-56');
    await companyDropdown.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

    const targetByName = companyDropdown.locator('button').filter({ hasText: new RegExp(escapeRegex(targetName), 'i') }).first();
    const fallbackTarget = companyDropdown.locator('button').filter({ hasText: /Portfolio/i }).first();
    const addCompanyButton = companyDropdown.locator('button').filter({ hasText: /Ajouter|Add/i }).first();

    let target = null;
    if (await targetByName.isVisible().catch(() => false)) {
      target = targetByName;
    } else if (await fallbackTarget.isVisible().catch(() => false)) {
      target = fallbackTarget;
    } else {
      const firstSelectable = companyDropdown.locator('button').first();
      const firstText = ((await firstSelectable.textContent()) || '').trim();
      const addText = ((await addCompanyButton.textContent()) || '').trim();
      if (await firstSelectable.isVisible().catch(() => false) && firstText && firstText !== addText) {
        target = firstSelectable;
      }
    }

    if (!target) {
      throw new Error(`Unable to find a company option for ${account.key}.`);
    }

    await target.click({ force: true });
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await dismissInterferingOverlays(page);
    trigger = await resolveCompanySwitcherTrigger();
    currentText = ((await trigger.textContent()) || '').trim();
  }

  if (!isTargetText(currentText)) {
    throw new Error(`Company switch did not land on target company for ${account.key}. Current: "${currentText}"`);
  }

  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
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
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await dismissInterferingOverlays(page);

    if (typeof check.beforeCheck === 'function') {
      await check.beforeCheck(page, account);
    }

    await waitForExpectedText(page, result.expectedText);
    result.passed = true;
  } catch (error) {
    result.error = error.message;
    result.screenshot = await captureFailure(page, account.key, check.key);
  }

  return result;
}

async function getUserByEmail(serviceClient, email) {
  let page = 1;
  while (page <= 20) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = (data?.users || []).find((entry) => String(entry.email || '').toLowerCase() === email.toLowerCase());
    if (user) return user;
    if (!data?.users?.length) break;
    page += 1;
  }
  return null;
}

async function fetchRows(query, label) {
  const { data, error } = await query;
  if (error) {
    throw new Error(`${label}: ${error.message}`);
  }
  return data || [];
}

function pickFirstText(rows, pickers) {
  for (const row of rows) {
    for (const picker of pickers) {
      const value = picker(row);
      if (value != null && String(value).trim()) {
        return String(value).trim();
      }
    }
  }
  return null;
}

async function loadExpectations(serviceClient, userId, company) {
  const purchasesRows = await fetchRows(
    serviceClient
      .from('supplier_orders')
      .select('order_number')
      .eq('user_id', userId)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(10),
    `supplier_orders for ${company.company_name}`,
  );

  const supplierInvoiceRows = await fetchRows(
    serviceClient
      .from('supplier_invoices')
      .select('invoice_number')
      .eq('user_id', userId)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(10),
    `supplier_invoices for ${company.company_name}`,
  );

  const productRows = await fetchRows(
    serviceClient
      .from('products')
      .select('product_name, sku')
      .eq('user_id', userId)
      .eq('company_id', company.id)
      .eq('is_active', true)
      .order('product_name', { ascending: true })
      .limit(20),
    `products for ${company.company_name}`,
  );

  const bankConnectionRows = await fetchRows(
    serviceClient
      .from('bank_connections')
      .select('account_name, institution_name')
      .eq('user_id', userId)
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(10),
    `bank_connections for ${company.company_name}`,
  );

  const peppolInvoiceRows = await fetchRows(
    serviceClient
      .from('invoices')
      .select('invoice_number, peppol_status')
      .eq('user_id', userId)
      .eq('company_id', company.id)
      .in('peppol_status', ['pending', 'sent', 'delivered', 'accepted', 'error', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(10),
    `peppol invoices for ${company.company_name}`,
  );

  const expectations = {
    gedHub: pickFirstText(peppolInvoiceRows, [(row) => row.invoice_number]) ||
      pickFirstText(supplierInvoiceRows, [(row) => row.invoice_number]),
    purchases: pickFirstText(purchasesRows, [(row) => row.order_number]),
    supplierInvoices: pickFirstText(supplierInvoiceRows, [(row) => row.invoice_number]),
    stock: pickFirstText(productRows, [(row) => row.product_name, (row) => row.sku]),
    // Bank integrations can be intentionally disconnected on demo tenants.
    bankConnections: firstNonEmpty(
      pickFirstText(bankConnectionRows, [(row) => row.account_name, (row) => row.institution_name]),
      'Connexions bancaires',
    ),
    peppol: firstNonEmpty(
      company.peppol_endpoint_id,
      pickFirstText(peppolInvoiceRows, [(row) => row.invoice_number]),
    ),
  };

  const missing = Object.entries(expectations)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing live expectations for ${company.company_name}: ${missing.join(', ')}`);
  }

  return expectations;
}

async function buildRuntimeAccounts() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const runtimes = [];
  for (const template of DEMO_ACCOUNT_TEMPLATES) {
    const user = await getUserByEmail(serviceClient, template.email);
    if (!user) {
      throw new Error(`Demo user not found: ${template.email}`);
    }

    const companies = await fetchRows(
      serviceClient
        .from('company')
        .select('id, company_name, peppol_endpoint_id')
        .eq('user_id', user.id)
        .order('company_name', { ascending: true }),
      `company rows for ${template.email}`,
    );
    const { data: preferenceData, error: preferenceError } = await serviceClient
      .from('user_company_preferences')
      .select('active_company_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (preferenceError && preferenceError.code !== 'PGRST116') {
      throw new Error(`user_company_preferences for ${template.email}: ${preferenceError.message}`);
    }

    const preferredCompanyId = preferenceData?.active_company_id || null;
    const targetCompany = companies.find((company) => company.id === preferredCompanyId)
      || companies.find((company) => /Portfolio/i.test(company.company_name || ''))
      || companies[0]
      || null;

    if (!targetCompany) {
      throw new Error(`Need at least 1 company for ${template.email} to run the smoke test`);
    }

    runtimes.push({
      key: template.key,
      email: template.email,
      password: requireEnv(template.passwordEnv),
      companyNames: companies.map((company) => company.company_name).filter(Boolean),
      targetCompany,
      expectations: await loadExpectations(serviceClient, user.id, targetCompany),
    });
  }

  return runtimes;
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
    targetCompany: account.targetCompany.company_name,
    expectations: account.expectations,
    passed: false,
    login: false,
    switchedCompany: false,
    pageChecks: [],
    failures: [],
  };

  try {
    await login(page, account);
    accountResult.login = true;

    await selectTargetCompany(page, account);
    accountResult.switchedCompany = true;

    const pageChecks = [];
    for (const check of PAGE_CHECKS) {
      pageChecks.push(await runPageCheck(page, account, check));
    }
    accountResult.pageChecks = pageChecks;
    accountResult.failures = pageChecks
      .filter((check) => !check.passed)
      .map((check) => `${check.key}: ${check.error}`);
    accountResult.passed = pageChecks.every((check) => check.passed);
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
    const runtimeAccounts = await buildRuntimeAccounts();
    const accounts = await Promise.all(runtimeAccounts.map((account) => smokeAccount(browser, account)));

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








