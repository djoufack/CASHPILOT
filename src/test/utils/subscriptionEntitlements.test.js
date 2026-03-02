import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENT_KEYS,
  filterCategorizedNavigation,
  filterEntitledItems,
  filterFlatNavigation,
} from '@/utils/subscriptionEntitlements';

describe('subscriptionEntitlements', () => {
  it('filters categorized navigation by feature key', () => {
    const categories = [
      { id: 'dashboard', type: 'direct', path: '/app' },
      {
        id: 'management',
        type: 'category',
        items: [
          { path: '/app/analytics', featureKey: ENTITLEMENT_KEYS.ANALYTICS_REPORTS },
          { path: '/app/projects' },
        ],
      },
      {
        id: 'peppol',
        type: 'direct',
        path: '/app/peppol',
        featureKey: ENTITLEMENT_KEYS.PEPPOL_EINVOICING,
      },
    ];

    const visible = filterCategorizedNavigation(
      categories,
      (featureKey) => featureKey !== ENTITLEMENT_KEYS.PEPPOL_EINVOICING,
    );

    expect(visible).toHaveLength(2);
    expect(visible[1].items).toHaveLength(2);
    expect(visible.find((item) => item.id === 'peppol')).toBeUndefined();
  });

  it('filters flat navigation and trims extra separators', () => {
    const items = [
      { type: 'separator', label: 'Before' },
      { path: '/app/scenarios', featureKey: ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL },
      { type: 'separator', label: 'After locked item' },
      { path: '/app/settings' },
      { type: 'separator', label: 'Trailing' },
    ];

    const visible = filterFlatNavigation(items, () => false);

    expect(visible).toEqual([{ path: '/app/settings' }]);
  });

  it('filters generic tab definitions by feature key', () => {
    const tabs = [
      { value: 'profile' },
      { value: 'team', featureKey: ENTITLEMENT_KEYS.ORGANIZATION_TEAM },
    ];

    expect(filterEntitledItems(tabs, () => false)).toEqual([{ value: 'profile' }]);
  });
});
