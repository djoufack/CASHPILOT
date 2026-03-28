import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.SMOKE_UI_BASE_URL || 'https://cashpilot.tech').trim().replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-sales-esign');
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
  const json = process.env.SALES_SMOKE_ACCOUNTS_JSON;
  if (json && String(json).trim()) {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('SALES_SMOKE_ACCOUNTS_JSON must be a non-empty array');
    }

    return parsed.map((account, index) => {
      if (!account?.email || !account?.password) {
        throw new Error(`SALES_SMOKE_ACCOUNTS_JSON entry ${index} must include email and password`);
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
      email: process.env.SALES_SMOKE_FR_EMAIL || process.env.PILOTAGE_FR_EMAIL || 'pilotage.fr.demo@cashpilot.cloud',
      password: requirePassword('SALES_SMOKE_FR_PASSWORD', 'PILOTAGE_FR_PASSWORD'),
    },
    {
      key: 'BE',
      email: process.env.SALES_SMOKE_BE_EMAIL || process.env.PILOTAGE_BE_EMAIL || 'pilotage.be.demo@cashpilot.cloud',
      password: requirePassword('SALES_SMOKE_BE_PASSWORD', 'PILOTAGE_BE_PASSWORD'),
    },
    {
      key: 'OHADA',
      email:
        process.env.SALES_SMOKE_OHADA_EMAIL || process.env.PILOTAGE_OHADA_EMAIL || 'pilotage.ohada.demo@cashpilot.cloud',
      password: requirePassword('SALES_SMOKE_OHADA_PASSWORD', 'PILOTAGE_OHADA_PASSWORD'),
    },
  ];

  const accounts = fallbackAccounts.filter((account) => account.password);
  if (accounts.length === 0) {
    throw new Error('No sales smoke accounts configured. Set SALES_SMOKE_ACCOUNTS_JSON or demo password env vars.');
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

async function openQuotes(page) {
  await page.goto(`${BASE_URL}/app/quotes`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await page.locator('body').waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
}

async function firstDataRow(page) {
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  if (count === 0) {
    throw new Error('No quote rows available for sales e-sign smoke');
  }
  return rows.first();
}

async function clickIfVisible(locator) {
  if (await locator.isVisible().catch(() => false)) {
    await locator.click();
    return true;
  }
  return false;
}

async function readClipboardText(page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const value = await page.evaluate(async () => {
      try {
        if (!navigator?.clipboard?.readText) return '';
        return (await navigator.clipboard.readText()) || '';
      } catch {
        return '';
      }
    });
    if (value) {
      return value;
    }
    await page.waitForTimeout(250);
  }
  return '';
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

    await page.getByText(/Type de document|Document type|Documenttype/i).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    await page.getByText(/Signature/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    result.checks.push('sales-columns-visible');

    const row = await firstDataRow(page);
    await row.getByText(/Devis|Quote|Offerte|Contrat|Contract/i).first().waitFor({
      state: 'visible',
      timeout: DEFAULT_TIMEOUT,
    });
    result.checks.push('document-type-visible');

    const convertButton = row.getByRole('button', { name: /Convertir en contrat|Convert to contract|Omzetten naar contract/i }).first();
    if (await clickIfVisible(convertButton)) {
      await row.getByText(/Contrat|Contract/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      result.checks.push('contract-converted');
    } else {
      result.checks.push('contract-conversion-not-required');
    }

    let signatureUrl = '';
    let shouldOpenSignaturePage = false;
    const requestButton = page
      .getByRole('button', { name: /Demander signature|Request signature|Handtekening aanvragen/i })
      .first();
    if (await requestButton.isVisible().catch(() => false)) {
      await requestButton.click();

      const dialog = page.getByRole('dialog').last();
      await dialog.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      result.checks.push('signature-dialog-opened');

      const signerEmailInput = dialog.getByLabel(/Email du signataire|Signer email|E-mail ondertekenaar/i).first();
      await signerEmailInput.fill(`esign+${account.key.toLowerCase()}@cashpilot.test`);
      await dialog.getByRole('button', { name: /Envoyer la demande|Send request|Verzoek verzenden/i }).click();

      const signatureUrlField = dialog.locator('input[readonly]').first();
      await signatureUrlField.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
      signatureUrl = await signatureUrlField.inputValue();
      if (!signatureUrl) {
        throw new Error('Signature URL was not generated');
      }
      result.checks.push('signature-link-generated');
      shouldOpenSignaturePage = true;
    } else {
      const copyButton = page.getByRole('button', { name: /Copier le lien|Copy link|Link kopiëren/i }).first();
      if (!(await copyButton.isVisible().catch(() => false))) {
        throw new Error('No signature request or copy-link action available in quotes table');
      }
      await copyButton.click();
      signatureUrl = await readClipboardText(page);
      if (!signatureUrl) {
        throw new Error('Unable to read copied signature URL from clipboard');
      }
      result.checks.push('signature-link-copied');
    }

    if (shouldOpenSignaturePage) {
      const signaturePage = await page.context().newPage();
      signaturePage.setDefaultTimeout(DEFAULT_TIMEOUT);
      try {
        await signaturePage.goto(signatureUrl, { waitUntil: 'domcontentloaded' });
        await signaturePage.getByText(/Signer le|Sign|Offerte ondertekenen|Contract undertekenen/i).first().waitFor({
          state: 'visible',
          timeout: DEFAULT_TIMEOUT,
        });
        result.checks.push('public-sign-page-opened');
      } finally {
        await signaturePage.close();
      }
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
  const browser = await launchBrowser();

  try {
    const results = [];
    for (const account of accounts) {
      const context = await browser.newContext({
        locale: 'fr-BE',
        ignoreHTTPSErrors: true,
        permissions: ['clipboard-read', 'clipboard-write'],
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
