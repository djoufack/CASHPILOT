import { describe, it, expect } from 'vitest';
import {
  ENTITLEMENT_KEYS,
  ENTITLEMENT_PLANS,
  ENTITLEMENT_LABELS,
  getEntitlementPlanLabel,
  getEntitlementLabel,
  filterCategorizedNavigation,
  filterFlatNavigation,
  filterEntitledItems,
} from '@/utils/subscriptionEntitlements';

// ============================================================================
// ENTITLEMENT_KEYS
// ============================================================================
describe('ENTITLEMENT_KEYS', () => {
  it('contains all expected feature keys', () => {
    expect(ENTITLEMENT_KEYS.ACCOUNTING_FINANCIAL_STATEMENTS).toBe('accounting.financial_statements');
    expect(ENTITLEMENT_KEYS.ANALYTICS_REPORTS).toBe('analytics.reports');
    expect(ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL).toBe('scenarios.financial');
    expect(ENTITLEMENT_KEYS.BANK_RECONCILIATION).toBe('bank.reconciliation');
    expect(ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS).toBe('developer.webhooks');
    expect(ENTITLEMENT_KEYS.ORGANIZATION_TEAM).toBe('organization.team');
    expect(ENTITLEMENT_KEYS.PEPPOL_EINVOICING).toBe('peppol.einvoicing');
  });
});

// ============================================================================
// ENTITLEMENT_PLANS mapping
// ============================================================================
describe('ENTITLEMENT_PLANS', () => {
  it('maps accounting to Starter plan', () => {
    expect(ENTITLEMENT_PLANS['accounting.financial_statements']).toBe('Starter');
  });

  it('maps analytics and scenarios to Pro plan', () => {
    expect(ENTITLEMENT_PLANS['analytics.reports']).toBe('Pro');
    expect(ENTITLEMENT_PLANS['scenarios.financial']).toBe('Pro');
  });

  it('maps bank and webhooks to Business plan', () => {
    expect(ENTITLEMENT_PLANS['bank.reconciliation']).toBe('Business');
    expect(ENTITLEMENT_PLANS['developer.webhooks']).toBe('Business');
  });

  it('maps team and peppol to Enterprise plan', () => {
    expect(ENTITLEMENT_PLANS['organization.team']).toBe('Enterprise');
    expect(ENTITLEMENT_PLANS['peppol.einvoicing']).toBe('Enterprise');
  });
});

// ============================================================================
// getEntitlementPlanLabel
// ============================================================================
describe('getEntitlementPlanLabel', () => {
  it('returns correct plan for known feature key', () => {
    expect(getEntitlementPlanLabel(ENTITLEMENT_KEYS.ANALYTICS_REPORTS)).toBe('Pro');
  });

  it('returns correct plan for accounting feature', () => {
    expect(getEntitlementPlanLabel(ENTITLEMENT_KEYS.ACCOUNTING_FINANCIAL_STATEMENTS)).toBe('Starter');
  });

  it('returns "Premium" for unknown feature key', () => {
    expect(getEntitlementPlanLabel('unknown.feature')).toBe('Premium');
  });

  it('returns "Premium" for undefined key', () => {
    expect(getEntitlementPlanLabel(undefined)).toBe('Premium');
  });
});

// ============================================================================
// getEntitlementLabel
// ============================================================================
describe('getEntitlementLabel', () => {
  it('returns correct label for known feature key', () => {
    expect(getEntitlementLabel(ENTITLEMENT_KEYS.ANALYTICS_REPORTS)).toBe('Rapports analytiques');
  });

  it('returns correct label for peppol feature', () => {
    expect(getEntitlementLabel(ENTITLEMENT_KEYS.PEPPOL_EINVOICING)).toBe('Peppol e-invoicing');
  });

  it('returns default label for unknown feature key', () => {
    expect(getEntitlementLabel('nonexistent.key')).toBe('Fonctionnalité premium');
  });

  it('returns default label for null key', () => {
    expect(getEntitlementLabel(null)).toBe('Fonctionnalité premium');
  });
});

// ============================================================================
// filterCategorizedNavigation — extended
// ============================================================================
describe('filterCategorizedNavigation — extended', () => {
  it('allows everything when hasEntitlement always returns true', () => {
    const categories = [
      { id: 'a', type: 'direct', path: '/a', featureKey: ENTITLEMENT_KEYS.PEPPOL_EINVOICING },
      {
        id: 'b',
        type: 'category',
        items: [
          { path: '/b1', featureKey: ENTITLEMENT_KEYS.ANALYTICS_REPORTS },
          { path: '/b2', featureKey: ENTITLEMENT_KEYS.BANK_RECONCILIATION },
        ],
      },
    ];
    const result = filterCategorizedNavigation(categories, () => true);
    expect(result).toHaveLength(2);
    expect(result[1].items).toHaveLength(2);
  });

  it('removes categories with all items filtered out', () => {
    const categories = [
      {
        id: 'locked',
        type: 'category',
        items: [
          { path: '/x', featureKey: ENTITLEMENT_KEYS.PEPPOL_EINVOICING },
        ],
      },
    ];
    const result = filterCategorizedNavigation(categories, () => false);
    expect(result).toHaveLength(0);
  });

  it('keeps items without featureKey', () => {
    const categories = [
      {
        id: 'mixed',
        type: 'category',
        items: [
          { path: '/free' },
          { path: '/locked', featureKey: ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS },
        ],
      },
    ];
    const result = filterCategorizedNavigation(categories, () => false);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
    expect(result[0].items[0].path).toBe('/free');
  });

  it('removes orphan subgroup labels', () => {
    const categories = [
      {
        id: 'nav',
        type: 'category',
        items: [
          { type: 'subgroup', label: 'Group A' },
          { path: '/locked', featureKey: ENTITLEMENT_KEYS.PEPPOL_EINVOICING },
          { type: 'subgroup', label: 'Group B' },
          { path: '/free' },
        ],
      },
    ];
    const result = filterCategorizedNavigation(categories, () => false);
    expect(result).toHaveLength(1);
    // Group A has no children after filtering, Group B has /free
    expect(result[0].items).toHaveLength(2);
    expect(result[0].items[0].label).toBe('Group B');
    expect(result[0].items[1].path).toBe('/free');
  });
});

// ============================================================================
// filterFlatNavigation — extended
// ============================================================================
describe('filterFlatNavigation — extended', () => {
  it('returns empty array for all-separator input', () => {
    const items = [
      { type: 'separator' },
      { type: 'separator' },
    ];
    const result = filterFlatNavigation(items, () => true);
    expect(result).toEqual([]);
  });

  it('preserves separators between allowed items', () => {
    const items = [
      { path: '/a' },
      { type: 'separator' },
      { path: '/b' },
    ];
    const result = filterFlatNavigation(items, () => true);
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe('separator');
  });

  it('collapses consecutive separators when items are removed', () => {
    const items = [
      { path: '/a' },
      { type: 'separator' },
      { path: '/locked', featureKey: 'locked.feature' },
      { type: 'separator' },
      { path: '/b' },
    ];
    const result = filterFlatNavigation(items, () => false);
    // Both locked items removed, separators collapse
    expect(result).toHaveLength(3);
    expect(result[0].path).toBe('/a');
    expect(result[1].type).toBe('separator');
    expect(result[2].path).toBe('/b');
  });

  it('returns empty array for empty input', () => {
    expect(filterFlatNavigation([], () => true)).toEqual([]);
  });
});

// ============================================================================
// filterEntitledItems — extended
// ============================================================================
describe('filterEntitledItems — extended', () => {
  it('keeps all items without featureKey', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(filterEntitledItems(items, () => false)).toEqual(items);
  });

  it('filters items with featureKey when not entitled', () => {
    const items = [
      { id: 1 },
      { id: 2, featureKey: 'pro.feature' },
    ];
    expect(filterEntitledItems(items, () => false)).toEqual([{ id: 1 }]);
  });

  it('returns empty array for empty input', () => {
    expect(filterEntitledItems([], () => true)).toEqual([]);
  });
});
