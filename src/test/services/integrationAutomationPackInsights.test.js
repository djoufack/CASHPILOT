import { describe, expect, it } from 'vitest';
import { buildIntegrationAutomationPackInsights } from '@/services/integrationAutomationPackInsights';

describe('buildIntegrationAutomationPackInsights', () => {
  it('returns safe defaults when no packs are provided', () => {
    const result = buildIntegrationAutomationPackInsights([]);

    expect(result.totalCount).toBe(0);
    expect(result.installedCount).toBe(0);
    expect(result.readinessPct).toBe(0);
    expect(result.status).toBe('critical');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('computes provider distribution and readiness', () => {
    const result = buildIntegrationAutomationPackInsights([
      { provider: 'zapier', status: 'installed' },
      { provider: 'zapier', status: 'ready' },
      { provider: 'make', status: 'installed' },
    ]);

    expect(result.totalCount).toBe(3);
    expect(result.installedCount).toBe(2);
    expect(result.readinessPct).toBeCloseTo(66.67, 1);
    expect(result.byProvider.zapier).toBe(2);
    expect(result.byProvider.make).toBe(1);
    expect(result.status).toBe('attention');
  });

  it('returns ready status when all packs are installed', () => {
    const result = buildIntegrationAutomationPackInsights([
      { provider: 'zapier', status: 'installed' },
      { provider: 'make', status: 'installed' },
    ]);

    expect(result.status).toBe('ready');
    expect(result.readinessPct).toBe(100);
    expect(result.recommendations).toEqual([]);
  });
});
