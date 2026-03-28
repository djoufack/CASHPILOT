import { useMemo } from 'react';

const round2 = (value) => Math.round(Number(value || 0) * 100) / 100;

const toCount = (value) => Math.max(0, Math.round(Number(value || 0)));

const cloneMoneyGroup = (group = {}) =>
  Object.fromEntries(Object.entries(group).map(([currency, value]) => [currency, round2(value)]));

const scaleMoneyGroup = (group = {}, factor = 1) =>
  Object.fromEntries(Object.entries(group).map(([currency, value]) => [currency, round2(Number(value || 0) * factor)]));

export function buildPortfolioStressTests(portfolioTotals = {}) {
  const bookedRevenue = cloneMoneyGroup(portfolioTotals.bookedRevenue);
  const collectedCash = cloneMoneyGroup(portfolioTotals.collectedCash);
  const outstandingReceivables = cloneMoneyGroup(portfolioTotals.outstandingReceivables);
  const quotePipeline = cloneMoneyGroup(portfolioTotals.quotePipeline);
  const activeProjects = toCount(portfolioTotals.activeProjects);
  const openQuotes = toCount(portfolioTotals.openQuotes);

  return [
    {
      key: 'revenueShock',
      severity: 'warning',
      titleKey: 'portfolio.stressTests.revenueShockTitle',
      descriptionKey: 'portfolio.stressTests.revenueShockDescription',
      metrics: [
        {
          key: 'bookedRevenue',
          labelKey: 'portfolio.stressTests.metrics.bookedRevenue',
          kind: 'money',
          baseline: bookedRevenue,
          stressed: scaleMoneyGroup(bookedRevenue, 0.9),
          deltaPercent: -10,
        },
        {
          key: 'activeProjects',
          labelKey: 'portfolio.stressTests.metrics.activeProjects',
          kind: 'count',
          baseline: activeProjects,
          stressed: toCount(activeProjects * 0.95),
          deltaPercent: -5,
        },
      ],
    },
    {
      key: 'collectionShock',
      severity: 'danger',
      titleKey: 'portfolio.stressTests.collectionShockTitle',
      descriptionKey: 'portfolio.stressTests.collectionShockDescription',
      metrics: [
        {
          key: 'collectedCash',
          labelKey: 'portfolio.stressTests.metrics.collectedCash',
          kind: 'money',
          baseline: collectedCash,
          stressed: scaleMoneyGroup(collectedCash, 0.85),
          deltaPercent: -15,
        },
        {
          key: 'outstandingReceivables',
          labelKey: 'portfolio.stressTests.metrics.outstandingReceivables',
          kind: 'money',
          baseline: outstandingReceivables,
          stressed: scaleMoneyGroup(outstandingReceivables, 1.15),
          deltaPercent: 15,
        },
      ],
    },
    {
      key: 'pipelineShock',
      severity: 'warning',
      titleKey: 'portfolio.stressTests.pipelineShockTitle',
      descriptionKey: 'portfolio.stressTests.pipelineShockDescription',
      metrics: [
        {
          key: 'quotePipeline',
          labelKey: 'portfolio.stressTests.metrics.quotePipeline',
          kind: 'money',
          baseline: quotePipeline,
          stressed: scaleMoneyGroup(quotePipeline, 0.8),
          deltaPercent: -20,
        },
        {
          key: 'openQuotes',
          labelKey: 'portfolio.stressTests.metrics.openQuotes',
          kind: 'count',
          baseline: openQuotes,
          stressed: toCount(openQuotes * 0.85),
          deltaPercent: -15,
        },
      ],
    },
  ];
}

export function usePortfolioStressTests(portfolioTotals = {}) {
  return useMemo(() => buildPortfolioStressTests(portfolioTotals), [portfolioTotals]);
}
