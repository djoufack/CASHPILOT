import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = (process.env.NAV_SMOKE_BASE_URL || process.env.SMOKE_UI_BASE_URL || 'http://127.0.0.1:4173')
  .trim()
  .replace(/\/+$/, '');
const OUTPUT_DIR = path.resolve('artifacts', 'playwright-navigation');
const HEADLESS = !['0', 'false', 'no'].includes(String(process.env.PLAYWRIGHT_HEADLESS || 'true').trim().toLowerCase());
const DEFAULT_TIMEOUT = Number.parseInt(process.env.PLAYWRIGHT_TIMEOUT || '30000', 10);
const LOGIN_TEXT = /login|connexion|se connecter|inloggen|sign in|anmelden/i;

const VIEWPORTS = [
  { key: 'mobile', width: 390, height: 844, expectCompactLogin: true },
  { key: 'tablet', width: 820, height: 1180, expectCompactLogin: true },
  { key: 'desktop', width: 1440, height: 900, expectCompactLogin: false },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function capture(page, viewportKey, label) {
  await ensureDir(OUTPUT_DIR);
  const screenshotPath = path.join(OUTPUT_DIR, `${viewportKey}-${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function waitForLandingReady(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#preloader').waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await page.waitForTimeout(400);
}

async function dismissDemoBanner(page) {
  const closeButton = page.locator('.demo-banner-close').first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  }
}

async function getOverflowMetrics(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const docScrollWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
    const docClientWidth = root.clientWidth;
    return {
      scrollWidth: docScrollWidth,
      clientWidth: docClientWidth,
      overflow: docScrollWidth - docClientWidth,
    };
  });
}

async function assertNoHorizontalOverflow(page, viewportKey, routeKey) {
  const metrics = await getOverflowMetrics(page);
  assert(
    metrics.overflow <= 2,
    `[${viewportKey}] Horizontal overflow on ${routeKey}: overflow=${metrics.overflow}px (scroll=${metrics.scrollWidth}, client=${metrics.clientWidth})`,
  );
}

async function assertAuthRouteLoaded(page, viewportKey, sourceKey) {
  await page.waitForURL((url) => url.pathname === '/login' || url.pathname.startsWith('/app'), {
    timeout: DEFAULT_TIMEOUT,
  });

  const pathname = new URL(page.url()).pathname;
  if (pathname.startsWith('/app')) {
    return;
  }

  const emailInput = page.locator('input#email, input[type="email"]').first();
  const passwordInput = page.locator('input#password, input[type="password"]').first();
  await emailInput.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT }).catch(() => {});
  await passwordInput.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT }).catch(() => {});
  const signInButton = page
    .locator('form button[type="submit"], button')
    .filter({ hasText: /connexion|se connecter|sign in|login|anmelden/i })
    .first();
  const loginReady = (await emailInput.isVisible().catch(() => false))
    && (await passwordInput.isVisible().catch(() => false))
    && (await signInButton.isVisible().catch(() => true));
  assert(loginReady, `[${viewportKey}] Login UI not visible after ${sourceKey}`);
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: 'fr-BE',
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(DEFAULT_TIMEOUT);

  const result = {
    viewport: viewport.key,
    width: viewport.width,
    height: viewport.height,
    passed: false,
    checks: [],
    screenshots: {},
    errors: [],
  };

  try {
    await waitForLandingReady(page);
    await dismissDemoBanner(page);
    await assertNoHorizontalOverflow(page, viewport.key, 'landing');
    result.checks.push('landing-no-horizontal-overflow');

    const compactLogin = page.locator('nav .mobile-nav-actions .mobile-login-btn').first();
    const desktopLogin = page.locator('nav .nav-actions button').filter({ hasText: LOGIN_TEXT }).first();
    const menuButton = page.locator('button.mobile-menu-btn').first();

    const compactVisible = await compactLogin.isVisible().catch(() => false);
    const desktopVisible = await desktopLogin.isVisible().catch(() => false);
    const menuVisible = await menuButton.isVisible().catch(() => false);

    if (viewport.expectCompactLogin) {
      assert(compactVisible, `[${viewport.key}] Compact login button must be visible in navbar`);
      assert(menuVisible, `[${viewport.key}] Mobile menu button must be visible in navbar`);
      result.checks.push('landing-compact-login-visible');
      result.checks.push('landing-mobile-menu-visible');

      await compactLogin.click();
      await assertAuthRouteLoaded(page, viewport.key, 'landing-compact-login');
      result.checks.push('landing-compact-login-navigation');
    } else {
      assert(desktopVisible, `[${viewport.key}] Desktop login button must be visible in navbar`);
      assert(!menuVisible, `[${viewport.key}] Mobile menu button should be hidden on desktop`);
      result.checks.push('landing-desktop-login-visible');
      result.checks.push('landing-mobile-menu-hidden');

      await desktopLogin.click();
      await assertAuthRouteLoaded(page, viewport.key, 'landing-desktop-login');
      result.checks.push('landing-desktop-login-navigation');
    }

    await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
    await page.locator('#preloader').waitFor({ state: 'hidden', timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await dismissDemoBanner(page);

    if (viewport.expectCompactLogin) {
      await menuButton.click();
      const menuLogin = page.locator('#mobile-menu .mobile-actions button').filter({ hasText: LOGIN_TEXT }).first();
      assert(await menuLogin.isVisible().catch(() => false), `[${viewport.key}] Login button must be visible in mobile menu`);
      result.checks.push('landing-mobile-menu-login-visible');
    }

    await page.goto(`${BASE_URL}/pricing`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: DEFAULT_TIMEOUT }).catch(() => {});
    await assertNoHorizontalOverflow(page, viewport.key, 'pricing');
    const pricingHeading = page
      .locator('h1, h2')
      .filter({ hasText: /tarif|pricing|plan/i })
      .first();
    await pricingHeading.waitFor({ state: 'visible', timeout: DEFAULT_TIMEOUT }).catch(() => {});
    assert(await pricingHeading.isVisible().catch(() => false), `[${viewport.key}] Pricing page heading must be visible`);
    result.checks.push('pricing-page-visible');
    result.checks.push('pricing-no-horizontal-overflow');

    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await assertNoHorizontalOverflow(page, viewport.key, 'login');
    await assertAuthRouteLoaded(page, viewport.key, 'direct-login-route');
    result.checks.push('login-page-visible');
    result.checks.push('login-no-horizontal-overflow');

    result.screenshots.final = await capture(page, viewport.key, 'final');
    result.passed = true;
  } catch (error) {
    result.errors.push(error.message);
    result.screenshots.failure = await capture(page, viewport.key, 'failure');
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  await ensureDir(OUTPUT_DIR);
  const browser = await launchBrowser();
  const startedAt = new Date().toISOString();

  try {
    const results = [];
    for (const viewport of VIEWPORTS) {
      results.push(await runViewport(browser, viewport));
    }

    const summary = {
      baseUrl: BASE_URL,
      startedAt,
      finishedAt: new Date().toISOString(),
      passed: results.every((entry) => entry.passed),
      results,
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
