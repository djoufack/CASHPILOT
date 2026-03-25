/* global process */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CANONICAL_STRIPE_STATUSES = ['none', 'active', 'trialing', 'past_due', 'canceled'];

const readProjectFile = (relativePath) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

const normalizeStripeStatus = (status) => (CANONICAL_STRIPE_STATUSES.includes(status) ? status : 'none');

describe('admin billing Stripe-only contract', () => {
  it.each(CANONICAL_STRIPE_STATUSES)('keeps canonical status "%s"', (status) => {
    expect(normalizeStripeStatus(status)).toBe(status);
  });

  it('maps missing status to none', () => {
    expect(normalizeStripeStatus(null)).toBe('none');
    expect(normalizeStripeStatus(undefined)).toBe('none');
  });

  it('removes legacy inactive and free-plan fallbacks from the admin billing contract', () => {
    const useAdminBillingSource = readProjectFile('src/hooks/useAdminBilling.js');
    const adminBillingManagerSource = readProjectFile('src/components/admin/AdminBillingManager.jsx');

    expect(useAdminBillingSource).not.toContain("subscription_status: 'inactive'");
    expect(useAdminBillingSource).not.toContain("|| 'inactive'");
    expect(adminBillingManagerSource).not.toContain('No plan (free)');
    expect(adminBillingManagerSource).not.toContain("|| 'inactive'");
  });
});
