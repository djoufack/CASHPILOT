export const ENTITLEMENT_KEYS = {
  ACCOUNTING_FINANCIAL_STATEMENTS: 'accounting.financial_statements',
  ANALYTICS_REPORTS: 'analytics.reports',
  SCENARIOS_FINANCIAL: 'scenarios.financial',
  BANK_RECONCILIATION: 'bank.reconciliation',
  DEVELOPER_WEBHOOKS: 'developer.webhooks',
  ORGANIZATION_TEAM: 'organization.team',
  PEPPOL_EINVOICING: 'peppol.einvoicing',
};

export const ENTITLEMENT_PLANS = {
  [ENTITLEMENT_KEYS.ACCOUNTING_FINANCIAL_STATEMENTS]: 'Starter',
  [ENTITLEMENT_KEYS.ANALYTICS_REPORTS]: 'Pro',
  [ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL]: 'Pro',
  [ENTITLEMENT_KEYS.BANK_RECONCILIATION]: 'Business',
  [ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS]: 'Business',
  [ENTITLEMENT_KEYS.ORGANIZATION_TEAM]: 'Enterprise',
  [ENTITLEMENT_KEYS.PEPPOL_EINVOICING]: 'Enterprise',
};

export const ENTITLEMENT_LABELS = {
  [ENTITLEMENT_KEYS.ACCOUNTING_FINANCIAL_STATEMENTS]: 'États financiers',
  [ENTITLEMENT_KEYS.ANALYTICS_REPORTS]: 'Rapports analytiques',
  [ENTITLEMENT_KEYS.SCENARIOS_FINANCIAL]: 'Scénarios financiers',
  [ENTITLEMENT_KEYS.BANK_RECONCILIATION]: 'Rapprochement bancaire',
  [ENTITLEMENT_KEYS.DEVELOPER_WEBHOOKS]: 'API & Webhooks',
  [ENTITLEMENT_KEYS.ORGANIZATION_TEAM]: 'Multi-utilisateurs',
  [ENTITLEMENT_KEYS.PEPPOL_EINVOICING]: 'Peppol e-invoicing',
};

const isAllowed = (item, hasEntitlement) => !item.featureKey || hasEntitlement(item.featureKey);

export const filterCategorizedNavigation = (categories, hasEntitlement) =>
  categories.flatMap((category) => {
    if (category.type === 'direct') {
      return isAllowed(category, hasEntitlement) ? [category] : [];
    }

    const items = (category.items || []).filter((item) => item.type === 'subgroup' || isAllowed(item, hasEntitlement));
    // Remove subgroup labels that have no following items
    const cleaned = items.filter((item, i) => {
      if (item.type !== 'subgroup') return true;
      // Keep subgroup only if the next item is NOT another subgroup (i.e. it has children)
      const next = items[i + 1];
      return next && next.type !== 'subgroup';
    });
    return cleaned.length > 0 ? [{ ...category, items: cleaned }] : [];
  });

export const filterFlatNavigation = (items, hasEntitlement) => {
  const filtered = [];
  let previousWasSeparator = true;

  items.forEach((item) => {
    if (item.type === 'separator') {
      if (!previousWasSeparator) {
        filtered.push(item);
        previousWasSeparator = true;
      }
      return;
    }

    if (!isAllowed(item, hasEntitlement)) {
      return;
    }

    filtered.push(item);
    previousWasSeparator = false;
  });

  if (filtered[filtered.length - 1]?.type === 'separator') {
    filtered.pop();
  }

  return filtered;
};

export const filterEntitledItems = (items, hasEntitlement) => items.filter((item) => isAllowed(item, hasEntitlement));

export const getEntitlementPlanLabel = (featureKey) => ENTITLEMENT_PLANS[featureKey] || 'Premium';

export const getEntitlementLabel = (featureKey) => ENTITLEMENT_LABELS[featureKey] || 'Fonctionnalité premium';
