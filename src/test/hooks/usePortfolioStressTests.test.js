import { describe, expect, it } from 'vitest';
import { buildPortfolioStressTests } from '@/hooks/usePortfolioStressTests';

describe('buildPortfolioStressTests', () => {
  it('derives stress scenarios from live portfolio totals', () => {
    const scenarios = buildPortfolioStressTests({
      companies: 4,
      overdueCompanies: 1,
      bookedRevenue: { EUR: 120000 },
      collectedCash: { EUR: 80000 },
      outstandingReceivables: { EUR: 22000 },
      quotePipeline: { EUR: 35000 },
      activeProjects: 7,
      openQuotes: 6,
    });

    expect(scenarios).toHaveLength(3);
    expect(scenarios[0]).toMatchObject({
      key: 'revenueShock',
      metrics: expect.arrayContaining([
        expect.objectContaining({
          key: 'bookedRevenue',
          baseline: { EUR: 120000 },
          stressed: { EUR: 108000 },
          deltaPercent: -10,
        }),
      ]),
    });
    expect(scenarios[1]).toMatchObject({
      key: 'collectionShock',
      metrics: expect.arrayContaining([
        expect.objectContaining({
          key: 'collectedCash',
          baseline: { EUR: 80000 },
          stressed: { EUR: 68000 },
        }),
        expect.objectContaining({
          key: 'outstandingReceivables',
          baseline: { EUR: 22000 },
          stressed: { EUR: 25300 },
        }),
      ]),
    });
    expect(scenarios[2]).toMatchObject({
      key: 'pipelineShock',
      metrics: expect.arrayContaining([
        expect.objectContaining({
          key: 'quotePipeline',
          baseline: { EUR: 35000 },
          stressed: { EUR: 28000 },
        }),
        expect.objectContaining({
          key: 'openQuotes',
          baseline: 6,
          stressed: 5,
        }),
      ]),
    });
  });
});
