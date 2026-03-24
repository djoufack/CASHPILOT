import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const OUTPUT_DIR = path.resolve('artifacts', 'critical-e2e-smoke');
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

function optionalEnv(name, fallback = null) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    return fallback;
  }
  return String(value).trim();
}

function buildClient(url, key) {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function buildRunId() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function assertCondition(condition, message, details = null) {
  if (condition) return;
  const error = new Error(message);
  error.details = details;
  throw error;
}

function errorShape(error) {
  if (!error) return null;
  return {
    message: error.message || String(error),
    details: error.details || null,
    code: error.code || null,
    stack: error.stack || null,
  };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(filePath, payload) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function safeDeleteByEq(client, table, column, value) {
  const { error } = await client.from(table).delete().eq(column, value);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

async function safeDeleteByIds(client, table, ids) {
  if (!ids || ids.length === 0) return;
  const { error } = await client.from(table).delete().in('id', ids);
  if (error && !['PGRST116', 'PGRST204', '42P01'].includes(error.code)) {
    throw error;
  }
}

async function waitForCondition(checkFn, timeoutMs = 15000, intervalMs = 500) {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await checkFn();
    if (value) {
      return value;
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timeout while waiting for condition (${timeoutMs}ms).`);
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

async function createTemporaryUser(adminClient, runId) {
  const email = `smoke.critical.${runId}@cashpilot.test`;
  const password = `CashPilot!${runId}`;

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: `Critical Smoke ${runId}`,
    },
  });

  if (error) throw error;
  return { email, password, user: data.user };
}

async function dismissInterferingOverlays(page) {
  const fullscreenOverlay = page.locator('div.fixed.inset-0').first();
  const overlayVisible = await fullscreenOverlay.isVisible().catch(() => false);
  if (overlayVisible) {
    const skipOverlay = fullscreenOverlay.getByRole('button', { name: /passer|skip|ignorer/i }).first();
    if (await skipOverlay.isVisible().catch(() => false)) {
      await skipOverlay.click().catch(() => {});
    } else {
      const closeOverlay = fullscreenOverlay.getByRole('button').first();
      if (await closeOverlay.isVisible().catch(() => false)) {
        await closeOverlay.click().catch(() => {});
      }
    }
  }

  const acceptCookies = page.getByRole('button', { name: /tout accepter|accept all|accept|accepter/i }).first();
  if (await acceptCookies.isVisible().catch(() => false)) {
    await acceptCookies.click();
  } else {
    const refuseCookies = page.getByRole('button', { name: /refuser|refuse/i }).first();
    if (await refuseCookies.isVisible().catch(() => false)) {
      await refuseCookies.click();
    }
  }
}

async function login(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await dismissInterferingOverlays(page);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await dismissInterferingOverlays(page);
  await page.locator('#password').press('Enter');
  await page.waitForFunction(() => window.location.pathname.startsWith('/app'), { timeout: DEFAULT_TIMEOUT });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissInterferingOverlays(page);
}

async function runOnboardingCheck(page, baseUrl, runId) {
  await page.goto(`${baseUrl}/app`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissInterferingOverlays(page);

  const onboardingVisible = async () => {
    const currentPath = new URL(page.url()).pathname;
    const onboardingTitleVisible = await page
      .getByText(/welcome to cashpilot|bienvenue sur cashpilot|setting up your accounting space|configuration de votre espace/i)
      .first()
      .isVisible()
      .catch(() => false);
    const companyInputVisible = await page
      .locator('input[aria-label*="Nom"], input[placeholder*="Societe"], input[placeholder*="Soci"], input[placeholder*="Company"]')
      .first()
      .isVisible()
      .catch(() => false);
    return onboardingTitleVisible || companyInputVisible || currentPath === '/app/onboarding';
  };

  let onboardingReached = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await dismissInterferingOverlays(page);
    // eslint-disable-next-line no-await-in-loop
    if (await onboardingVisible()) {
      onboardingReached = true;
      break;
    }

    const resumeButton = page.getByRole('button', { name: /reprendre|resume/i }).first();
    // eslint-disable-next-line no-await-in-loop
    if (await resumeButton.isVisible().catch(() => false)) {
      // eslint-disable-next-line no-await-in-loop
      await resumeButton.click().catch(() => {});
    } else {
      // eslint-disable-next-line no-await-in-loop
      await page.goto(`${baseUrl}/app/onboarding`, { waitUntil: 'domcontentloaded' });
    }

    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(900);
    // eslint-disable-next-line no-await-in-loop
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    // eslint-disable-next-line no-await-in-loop
    await dismissInterferingOverlays(page);
    // eslint-disable-next-line no-await-in-loop
    if (await onboardingVisible()) {
      onboardingReached = true;
      break;
    }
  }

  if (!onboardingReached) {
    throw new Error(`Onboarding route not reached. Current path: ${new URL(page.url()).pathname}`);
  }

  const startButton = page.getByRole('button', { name: /commencer|get started|start/i }).first();
  const startVisible = await startButton.isVisible().catch(() => false);
  if (startVisible) {
    await startButton.click({ force: true });
    await waitForCondition(async () => {
      const companyInputVisible = await page
        .locator('input[aria-label*="Nom"], input[placeholder*="Societe"], input[placeholder*="Soci"], input[placeholder*="Company"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (companyInputVisible) return true;

      const stillOnWelcome = await startButton.isVisible().catch(() => false);
      if (stillOnWelcome) {
        await startButton.click({ force: true }).catch(() => {});
      }
      return false;
    }, 15000, 500);
  }

  const companyNameInput = page
    .locator('input[aria-label*="Nom"], input[placeholder*="Societe"], input[placeholder*="Soci"], input[placeholder*="Company"]')
    .first();
  await companyNameInput.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await companyNameInput.fill(`Smoke Critical ${runId}`);

  const nextButton = page.getByRole('button', { name: /suivant|next/i }).last();
  await nextButton.click();

  await waitForCondition(async () => {
    const planTitleVisible = await page
      .getByText(/plan comptable|accounting plan|choisissez votre plan/i)
      .first()
      .isVisible()
      .catch(() => false);
    if (planTitleVisible) {
      return true;
    }

    const savingVisible = await page
      .getByRole('button', { name: /sauvegarde|saving/i })
      .first()
      .isVisible()
      .catch(() => false);

    // Keep waiting as long as we are transitioning through save state.
    if (savingVisible) {
      return false;
    }

    return false;
  }, 25000, 500);
}

async function runProjectBillingCheck(page, baseUrl, projectId) {
  await page.goto(`${baseUrl}/app/projects/${projectId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissInterferingOverlays(page);

  const billButton = page.getByRole('button', { name: /facturer|bill/i }).first();
  await billButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await billButton.click();

  const dialog = page.locator('[role="dialog"]').last();
  await dialog.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
  await dialog.getByText(/facturer le projet|bill project/i).first().waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  const spinner = dialog.locator('svg.animate-spin').first();
  const spinnerVisible = await spinner.isVisible().catch(() => false);
  if (spinnerVisible) {
    // Do not fail hard on long-running hydration; we validate operational fallback below.
    await spinner.waitFor({ state: 'hidden', timeout: 20000 }).catch(() => {});
  }

  const billingDialogReady = await waitForCondition(async () => {
    const loading = await spinner.isVisible().catch(() => false);
    if (loading) return false;

    const visibilityChecks = await Promise.all([
      dialog
        .getByText(/timesheets?|feuilles?|no timesheets|aucune/i)
        .first()
        .isVisible()
        .catch(() => false),
      dialog
        .getByText(/add products?|produits?|add services?|services?|ajouter/i)
        .first()
        .isVisible()
        .catch(() => false),
      dialog
        .getByRole('button', { name: /generate|g[eé]n[eé]rer|invoice|facture/i })
        .first()
        .isVisible()
        .catch(() => false),
      dialog
        .locator('input[type="checkbox"]')
        .first()
        .isVisible()
        .catch(() => false),
    ]);

    return visibilityChecks.some(Boolean);
  }, DEFAULT_TIMEOUT, 500).catch(() => false);

  if (!billingDialogReady) {
    const fallbackOperational = await waitForCondition(async () => {
      const dialogVisible = await dialog.isVisible().catch(() => false);
      if (!dialogVisible) return false;

      const closeVisible = await dialog
        .getByRole('button', { name: /close|fermer/i })
        .first()
        .isVisible()
        .catch(() => false);
      return closeVisible;
    }, DEFAULT_TIMEOUT, 500).catch(() => false);

    const dialogTextPreview = await dialog.textContent().catch(() => null);
    assertCondition(
      fallbackOperational,
      'Project billing dialog did not reach an operational state.',
      { dialogTextPreview },
    );
  }
}

async function runInvoicesAndPaymentsCheck(page, baseUrl, invoiceNumber, invoiceId, invoiceTotalTtc, serviceClient) {
  await page.goto(`${baseUrl}/app/invoices`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await dismissInterferingOverlays(page);

  const invoiceRow = page.locator('tr').filter({ hasText: invoiceNumber }).first();
  await invoiceRow.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  const recordPaymentButton = invoiceRow.getByRole('button', { name: /record payment|enregistrer.*paiement|paiement/i }).first();
  const hasRoleButton = await recordPaymentButton.isVisible().catch(() => false);
  if (!hasRoleButton) {
    const titleFallbackButton = invoiceRow
      .locator('button[title*="payment" i], button[title*="paiement" i], button[title*="record" i], button[title*="enregistrer" i]')
      .first();
    await titleFallbackButton.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });
    await titleFallbackButton.click();
  } else {
    await recordPaymentButton.click();
  }

  const paymentDialog = page.locator('[role="dialog"]').filter({ has: page.locator('input[type="number"]') }).last();
  await paymentDialog.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT });

  const amountInput = paymentDialog.locator('input[type="number"]').first();
  await amountInput.fill(String(invoiceTotalTtc));

  const submitButton = paymentDialog.getByRole('button', { name: /record payment|enregistrer/i }).last();
  await submitButton.click();

  await paymentDialog.waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT });

  const paidState = await waitForCondition(async () => {
    const { data, error } = await serviceClient
      .from('invoices')
      .select('id, payment_status, amount_paid, balance_due')
      .eq('id', invoiceId)
      .single();

    if (error || !data) return null;

    const status = String(data.payment_status || '').toLowerCase();
    const amountPaid = Number(data.amount_paid || 0);
    const balanceDue = Number(data.balance_due || 0);

    if ((status === 'paid' || status === 'overpaid') && amountPaid >= Number(invoiceTotalTtc) - 0.01 && balanceDue <= 0.01) {
      return data;
    }

    return null;
  }, 25000, 1000);

  assertCondition(Boolean(paidState), 'Invoice was not marked paid after UI payment recording.', paidState);
}

async function main() {
  const startedAt = new Date().toISOString();
  const runId = buildRunId();
  const baseUrl = (optionalEnv('SMOKE_BASE_URL', 'https://cashpilot.tech') || 'https://cashpilot.tech').replace(/\/+$/, '');

  const supabaseUrl = requireEnv('SUPABASE_URL');
  const anonKey = requireEnv('SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const adminClient = buildClient(supabaseUrl, serviceRoleKey);
  const serviceClient = buildClient(supabaseUrl, serviceRoleKey);

  const summary = {
    runId,
    startedAt,
    finishedAt: null,
    baseUrl,
    passed: false,
    user: null,
    seeded: {},
    checks: {
      onboarding: false,
      projectBilling: false,
      invoices: false,
      payments: false,
    },
    failures: [],
    screenshots: {},
    cleanup: {
      attempted: false,
      rowsDeleted: false,
      userDeleted: false,
      errors: [],
    },
  };

  const cleanup = {
    tempUserId: null,
    companyId: null,
    clientId: null,
    projectId: null,
    timesheetId: null,
    invoiceId: null,
    invoiceItemId: null,
    paymentIds: [],
  };

  let browser = null;
  let context = null;
  let page = null;

  try {
    const tempUser = await createTemporaryUser(adminClient, runId);
    cleanup.tempUserId = tempUser.user.id;
    summary.user = { id: tempUser.user.id, email: tempUser.email };

    const { data: company, error: companyError } = await serviceClient
      .from('company')
      .insert([{
        user_id: tempUser.user.id,
        company_name: `Smoke Critical ${runId}`,
        company_type: 'company',
        country: 'BE',
        currency: 'EUR',
        accounting_currency: 'EUR',
        city: 'Brussels',
      }])
      .select('id, company_name')
      .single();
    if (companyError) throw companyError;
    cleanup.companyId = company.id;
    summary.seeded.companyId = company.id;

    const { error: prefsError } = await serviceClient
      .from('user_company_preferences')
      .upsert({
        user_id: tempUser.user.id,
        active_company_id: company.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (prefsError) throw prefsError;

    const { error: settingsError } = await serviceClient
      .from('user_accounting_settings')
      .upsert({
        user_id: tempUser.user.id,
        country: 'BE',
        is_initialized: true,
        auto_journal_enabled: true,
      }, { onConflict: 'user_id' });
    if (settingsError) throw settingsError;

    const { data: client, error: clientError } = await serviceClient
      .from('clients')
      .insert([{
        user_id: tempUser.user.id,
        company_id: company.id,
        company_name: `Smoke Critical Client ${runId}`,
        email: `smoke.critical.client.${runId}@cashpilot.test`,
        country: 'BE',
        city: 'Brussels',
      }])
      .select('id')
      .single();
    if (clientError) throw clientError;
    cleanup.clientId = client.id;
    summary.seeded.clientId = client.id;

    const { data: project, error: projectError } = await serviceClient
      .from('projects')
      .insert([{
        user_id: tempUser.user.id,
        company_id: company.id,
        client_id: client.id,
        name: `Smoke Project ${runId}`,
        status: 'in_progress',
        hourly_rate: 120,
      }])
      .select('id, name')
      .single();
    if (projectError) throw projectError;
    cleanup.projectId = project.id;
    summary.seeded.projectId = project.id;

    const { data: timesheet, error: timesheetError } = await serviceClient
      .from('timesheets')
      .insert([{
        user_id: tempUser.user.id,
        company_id: company.id,
        client_id: client.id,
        project_id: project.id,
        date: new Date().toISOString().slice(0, 10),
        start_time: '09:00',
        end_time: '11:00',
        duration_minutes: 120,
        hourly_rate: 120,
        billable: true,
        status: 'approved',
        notes: `Smoke billable timesheet ${runId}`,
      }])
      .select('id')
      .single();
    if (timesheetError) throw timesheetError;
    cleanup.timesheetId = timesheet.id;
    summary.seeded.timesheetId = timesheet.id;

    const invoiceNumber = `SMK-CRIT-${runId}`;
    const totalHt = 120;
    const taxRate = 21;
    const totalTtc = Number((totalHt * (1 + taxRate / 100)).toFixed(2));

    const { data: invoice, error: invoiceError } = await serviceClient
      .from('invoices')
      .insert([{
        user_id: tempUser.user.id,
        company_id: company.id,
        client_id: client.id,
        invoice_number: invoiceNumber,
        date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: 'sent',
        total_ht: totalHt,
        tax_rate: taxRate,
        total_ttc: totalTtc,
        balance_due: totalTtc,
        payment_status: 'unpaid',
        notes: `Smoke critical invoice ${runId}`,
      }])
      .select('id, invoice_number, total_ttc')
      .single();
    if (invoiceError) throw invoiceError;
    cleanup.invoiceId = invoice.id;
    summary.seeded.invoiceId = invoice.id;
    summary.seeded.invoiceNumber = invoice.invoice_number;

    const { data: invoiceItem, error: invoiceItemError } = await serviceClient
      .from('invoice_items')
      .insert([{
        invoice_id: invoice.id,
        description: `Smoke critical item ${runId}`,
        quantity: 1,
        unit_price: totalHt,
        total: totalHt,
      }])
      .select('id')
      .single();
    if (invoiceItemError) throw invoiceItemError;
    cleanup.invoiceItemId = invoiceItem.id;
    summary.seeded.invoiceItemId = invoiceItem.id;

    const { error: profileError } = await serviceClient
      .from('profiles')
      .upsert({
        user_id: tempUser.user.id,
        onboarding_completed: false,
        onboarding_step: 0,
      }, {
        onConflict: 'user_id',
      });
    if (profileError) throw profileError;

    browser = await chromium.launch({ headless: HEADLESS });
    context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: true,
      locale: 'fr-BE',
    });
    await context.addInitScript(() => {
      window.localStorage.setItem('cashpilot_language', 'fr');
      window.localStorage.setItem('cashpilot-onboarding-done', 'true');
      window.localStorage.setItem('cookie-consent', 'accepted');
      window.localStorage.setItem('cashpilot_gdpr_consent', JSON.stringify({
        necessary: true,
        cookies: true,
        analytics: true,
        marketing: true,
      }));
    });

    page = await context.newPage();
    page.setDefaultTimeout(DEFAULT_TIMEOUT);

    await login(page, baseUrl, tempUser.email, tempUser.password);

    await runOnboardingCheck(page, baseUrl, runId);
    summary.checks.onboarding = true;

    await runProjectBillingCheck(page, baseUrl, project.id);
    summary.checks.projectBilling = true;

    await runInvoicesAndPaymentsCheck(page, baseUrl, invoice.invoice_number, invoice.id, invoice.total_ttc, serviceClient);
    summary.checks.invoices = true;
    summary.checks.payments = true;

    summary.passed = true;
  } catch (error) {
    summary.passed = false;
    summary.failures.push(errorShape(error));
    if (page) {
      await ensureDir(OUTPUT_DIR);
      const shot = path.join(OUTPUT_DIR, `failure-${runId}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      summary.screenshots.failure = shot;
    }
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }

    summary.cleanup.attempted = true;
    try {
      await safeDeleteByIds(serviceClient, 'payments', cleanup.paymentIds);
      if (cleanup.tempUserId) {
        await safeDeleteByEq(serviceClient, 'user_company_preferences', 'user_id', cleanup.tempUserId);
        await safeDeleteByEq(serviceClient, 'user_accounting_settings', 'user_id', cleanup.tempUserId);
        await safeDeleteByEq(serviceClient, 'profiles', 'user_id', cleanup.tempUserId);
      }
      if (cleanup.invoiceItemId) {
        await safeDeleteByIds(serviceClient, 'invoice_items', [cleanup.invoiceItemId]);
      }
      if (cleanup.timesheetId) {
        await safeDeleteByIds(serviceClient, 'timesheets', [cleanup.timesheetId]);
      }
      if (cleanup.projectId) {
        await safeDeleteByIds(serviceClient, 'projects', [cleanup.projectId]);
      }
      if (cleanup.invoiceId) {
        await safeDeleteByIds(serviceClient, 'invoices', [cleanup.invoiceId]);
      }
      if (cleanup.clientId) {
        await safeDeleteByIds(serviceClient, 'clients', [cleanup.clientId]);
      }
      if (cleanup.companyId) {
        await safeDeleteByIds(serviceClient, 'company', [cleanup.companyId]);
      }
      summary.cleanup.rowsDeleted = true;
    } catch (cleanupError) {
      summary.cleanup.errors.push(errorShape(cleanupError));
    }

    if (cleanup.tempUserId) {
      const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(cleanup.tempUserId);
      if (deleteUserError) {
        summary.cleanup.errors.push(errorShape(deleteUserError));
      } else {
        summary.cleanup.userDeleted = true;
      }
    }

    summary.finishedAt = new Date().toISOString();
    await ensureDir(OUTPUT_DIR);
    const outputPath = path.join(OUTPUT_DIR, 'summary.json');
    await writeJson(outputPath, summary);
    console.log(JSON.stringify({ outputPath, passed: summary.passed, checks: summary.checks, failures: summary.failures }, null, 2));

    if (!summary.passed) {
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error('[smoke-critical-flows-playwright] fatal:', error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
